#!/bin/bash
# =============================================================================
# MGR CAPITAL ASSISTANCE — Deployment Script
# Sovereign deployment automation for production environments
#
# Usage:
#   ./scripts/deploy.sh [command]
#
# Commands:
#   setup     - Initial setup (certs, env, volumes)
#   deploy    - Deploy/update the application
#   migrate   - Run database migrations
#   seed      - Seed the database
#   backup    - Create a backup
#   restore   - Restore from backup
#   logs      - View application logs
#   stop      - Stop all services
#   clean     - Remove all containers and volumes (DESTRUCTIVE)
#   airgap    - Prepare for air-gap deployment (export images)
#
# Environment:
#   Requires .env file with all secrets configured
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env"
CERTS_DIR="$PROJECT_ROOT/certs"
BACKUP_DIR="$PROJECT_ROOT/backups"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    local deps=("docker" "docker-compose" "openssl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is required but not installed."
            exit 1
        fi
    done
}

check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env file not found at $ENV_FILE"
        log_info "Copy .env.template to .env and configure it:"
        log_info "  cp .env.template .env"
        exit 1
    fi
    source "$ENV_FILE"
}

# =============================================================================
# SSL Certificate Generation
# =============================================================================

generate_self_signed_certs() {
    log_info "Generating self-signed SSL certificates..."

    mkdir -p "$CERTS_DIR"

    # Generate DH parameters (if not exists)
    if [ ! -f "$CERTS_DIR/dhparam.pem" ]; then
        log_info "Generating DH parameters (this may take a while)..."
        openssl dhparam -out "$CERTS_DIR/dhparam.pem" 2048
    fi

    # Generate self-signed certificate
    if [ ! -f "$CERTS_DIR/selfsigned.crt" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$CERTS_DIR/selfsigned.key" \
            -out "$CERTS_DIR/selfsigned.crt" \
            -subj "/C=US/ST=State/L=City/O=MGR Capital/OU=IT/CN=localhost"

        # Set proper permissions
        chmod 600 "$CERTS_DIR/selfsigned.key"
        chmod 644 "$CERTS_DIR/selfsigned.crt"

        log_success "SSL certificates generated at $CERTS_DIR"
    else
        log_info "SSL certificates already exist"
    fi

    # Copy certs to nginx volume location
    mkdir -p "$PROJECT_ROOT/nginx/certs"
    cp "$CERTS_DIR/selfsigned.crt" "$PROJECT_ROOT/nginx/certs/"
    cp "$CERTS_DIR/selfsigned.key" "$PROJECT_ROOT/nginx/certs/"
    cp "$CERTS_DIR/dhparam.pem" "$PROJECT_ROOT/nginx/certs/"
}

# =============================================================================
# Setup Command
# =============================================================================

cmd_setup() {
    log_info "Running initial setup..."

    check_dependencies

    # Check/create .env file
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$PROJECT_ROOT/.env.template" ]; then
            cp "$PROJECT_ROOT/.env.template" "$ENV_FILE"
            log_warn "Created .env from template. Please configure it before deploying."

            # Generate random secrets
            JWT_SECRET=$(openssl rand -base64 32)
            JWT_REFRESH_SECRET=$(openssl rand -base64 32)
            DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
            REDIS_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9')
            BACKUP_PASSPHRASE=$(openssl rand -base64 32)

            # Update .env with generated secrets
            sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
            sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|" "$ENV_FILE"
            sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" "$ENV_FILE"
            sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASSWORD|" "$ENV_FILE"
            sed -i "s|BACKUP_PASSPHRASE=.*|BACKUP_PASSPHRASE=$BACKUP_PASSPHRASE|" "$ENV_FILE"

            log_success "Generated random secrets in .env"
        else
            log_error ".env.template not found"
            exit 1
        fi
    fi

    # Generate SSL certificates
    generate_self_signed_certs

    # Create required directories
    mkdir -p "$PROJECT_ROOT/backups"
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/uploads"
    mkdir -p "$PROJECT_ROOT/frontend/dist"

    # Create placeholder index.html if frontend not built
    if [ ! -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
        cat > "$PROJECT_ROOT/frontend/dist/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>MGR Capital Assistance</title>
    <style>
        body { font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
        .container { text-align: center; }
        h1 { color: #00d4ff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>MGR Capital Assistance</h1>
        <p>Backend API is running. Frontend coming soon.</p>
        <p><a href="/api/health" style="color: #00d4ff;">Check API Health</a></p>
    </div>
</body>
</html>
EOF
    fi

    log_success "Setup complete!"
    log_info "Next steps:"
    log_info "  1. Review and update .env file"
    log_info "  2. Run: ./scripts/deploy.sh deploy"
}

# =============================================================================
# Deploy Command
# =============================================================================

cmd_deploy() {
    log_info "Deploying MGR Capital Assistance..."

    check_env_file

    # Ensure certs exist
    if [ ! -f "$PROJECT_ROOT/nginx/certs/selfsigned.crt" ]; then
        generate_self_signed_certs
    fi

    # Pull/build images
    log_info "Building containers..."
    docker-compose -f "$COMPOSE_FILE" build

    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d

    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 10

    # Run migrations
    cmd_migrate

    log_success "Deployment complete!"
    log_info "Application is available at:"
    log_info "  HTTP:  http://localhost:${HTTP_PORT:-80}"
    log_info "  HTTPS: https://localhost:${HTTPS_PORT:-443}"
}

# =============================================================================
# Migration Command
# =============================================================================

cmd_migrate() {
    log_info "Running database migrations..."

    docker-compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

    log_success "Migrations complete!"
}

# =============================================================================
# Seed Command
# =============================================================================

cmd_seed() {
    log_info "Seeding database..."

    docker-compose -f "$COMPOSE_FILE" exec -T backend npx prisma db seed

    log_success "Database seeded!"
}

# =============================================================================
# Backup Command
# =============================================================================

cmd_backup() {
    log_info "Creating backup..."

    check_env_file

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

    mkdir -p "$BACKUP_DIR"

    # Backup database
    docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump -U "${DB_USER:-postgres}" "${DB_NAME:-mgr_capital}" | gzip > "$BACKUP_FILE"

    # Encrypt if passphrase is set
    if [ -n "$BACKUP_PASSPHRASE" ]; then
        openssl enc -aes-256-cbc -salt -pbkdf2 -in "$BACKUP_FILE" -out "${BACKUP_FILE}.enc" -pass pass:"$BACKUP_PASSPHRASE"
        rm "$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE}.enc"
    fi

    log_success "Backup created: $BACKUP_FILE"
}

# =============================================================================
# Restore Command
# =============================================================================

cmd_restore() {
    if [ -z "$1" ]; then
        log_error "Please specify backup file: ./scripts/deploy.sh restore <backup_file>"
        exit 1
    fi

    BACKUP_FILE="$1"

    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    log_warn "This will overwrite the current database. Continue? (y/N)"
    read -r response
    if [ "$response" != "y" ]; then
        log_info "Restore cancelled"
        exit 0
    fi

    check_env_file

    log_info "Restoring from backup..."

    # Decrypt if encrypted
    if [[ "$BACKUP_FILE" == *.enc ]]; then
        TEMP_FILE="/tmp/restore_$$.sql.gz"
        openssl enc -d -aes-256-cbc -pbkdf2 -in "$BACKUP_FILE" -out "$TEMP_FILE" -pass pass:"$BACKUP_PASSPHRASE"
        BACKUP_FILE="$TEMP_FILE"
    fi

    # Restore
    gunzip -c "$BACKUP_FILE" | docker-compose -f "$COMPOSE_FILE" exec -T db psql -U "${DB_USER:-postgres}" "${DB_NAME:-mgr_capital}"

    # Cleanup temp file
    [ -n "$TEMP_FILE" ] && rm -f "$TEMP_FILE"

    log_success "Restore complete!"
}

# =============================================================================
# Logs Command
# =============================================================================

cmd_logs() {
    SERVICE="${1:-}"

    if [ -n "$SERVICE" ]; then
        docker-compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
    else
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

# =============================================================================
# Stop Command
# =============================================================================

cmd_stop() {
    log_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Services stopped"
}

# =============================================================================
# Clean Command
# =============================================================================

cmd_clean() {
    log_warn "This will remove ALL containers, volumes, and data. This is DESTRUCTIVE!"
    log_warn "Continue? (type 'yes' to confirm)"
    read -r response
    if [ "$response" != "yes" ]; then
        log_info "Clean cancelled"
        exit 0
    fi

    log_info "Removing all containers and volumes..."
    docker-compose -f "$COMPOSE_FILE" down -v --remove-orphans

    log_success "Cleanup complete"
}

# =============================================================================
# Air-Gap Command
# =============================================================================

cmd_airgap() {
    log_info "Preparing for air-gap deployment..."

    AIRGAP_DIR="$PROJECT_ROOT/airgap_bundle"
    mkdir -p "$AIRGAP_DIR"

    # Pull all required images
    log_info "Pulling required images..."
    docker pull postgres:15-alpine
    docker pull redis:7-alpine
    docker pull nginx:alpine
    docker pull node:20-alpine

    # Build backend image
    log_info "Building backend image..."
    docker-compose -f "$COMPOSE_FILE" build backend

    # Export images
    log_info "Exporting images to tarballs..."
    docker save postgres:15-alpine | gzip > "$AIRGAP_DIR/postgres-15-alpine.tar.gz"
    docker save redis:7-alpine | gzip > "$AIRGAP_DIR/redis-7-alpine.tar.gz"
    docker save nginx:alpine | gzip > "$AIRGAP_DIR/nginx-alpine.tar.gz"
    docker save mgr-capital-assistance_backend | gzip > "$AIRGAP_DIR/mgr-backend.tar.gz"

    # Copy project files
    log_info "Copying project files..."
    cp "$COMPOSE_FILE" "$AIRGAP_DIR/"
    cp -r "$PROJECT_ROOT/nginx" "$AIRGAP_DIR/"
    cp -r "$PROJECT_ROOT/scripts" "$AIRGAP_DIR/"
    cp "$PROJECT_ROOT/.env.template" "$AIRGAP_DIR/"

    # Create import script
    cat > "$AIRGAP_DIR/import-images.sh" << 'EOF'
#!/bin/bash
echo "Importing Docker images..."
gunzip -c postgres-15-alpine.tar.gz | docker load
gunzip -c redis-7-alpine.tar.gz | docker load
gunzip -c nginx-alpine.tar.gz | docker load
gunzip -c mgr-backend.tar.gz | docker load
echo "Import complete!"
EOF
    chmod +x "$AIRGAP_DIR/import-images.sh"

    log_success "Air-gap bundle created at: $AIRGAP_DIR"
    log_info "Transfer this directory to the air-gapped system and run:"
    log_info "  cd airgap_bundle && ./import-images.sh"
    log_info "  ./scripts/deploy.sh setup"
    log_info "  ./scripts/deploy.sh deploy"
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
    setup)
        cmd_setup
        ;;
    deploy)
        cmd_deploy
        ;;
    migrate)
        cmd_migrate
        ;;
    seed)
        cmd_seed
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore "$2"
        ;;
    logs)
        cmd_logs "$2"
        ;;
    stop)
        cmd_stop
        ;;
    clean)
        cmd_clean
        ;;
    airgap)
        cmd_airgap
        ;;
    *)
        echo "MGR Capital Assistance — Deployment Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  setup     Initial setup (certs, env, volumes)"
        echo "  deploy    Deploy/update the application"
        echo "  migrate   Run database migrations"
        echo "  seed      Seed the database"
        echo "  backup    Create a backup"
        echo "  restore   Restore from backup"
        echo "  logs      View application logs"
        echo "  stop      Stop all services"
        echo "  clean     Remove all containers and volumes"
        echo "  airgap    Prepare for air-gap deployment"
        exit 1
        ;;
esac
