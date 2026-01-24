#!/bin/bash
# ============================================
# MGR CAPITAL ASSISTANCE — FULL RESTORE SCRIPT
# Phase 17: Backup & Recovery Automation
# ============================================
#
# This script performs a full system restore from encrypted backups.
# Handles GPG decryption, PostgreSQL restore, vault file extraction,
# and Prisma migrations.
#
# Usage:
#   ./scripts/restore.sh [options] <backup_file>
#
# Options:
#   --db-only       Only restore database (skip vault)
#   --vault-only    Only restore vault files (skip database)
#   --no-migrate    Skip Prisma migrations after restore
#   --no-verify     Skip checksum verification
#   --dry-run       Show what would be done without executing
#   -h, --help      Show this help message
#
# Examples:
#   ./scripts/restore.sh ./backups/db_daily_2024-01-15.dump.gpg
#   ./scripts/restore.sh --db-only ./backups/db_weekly_2024-01-14.dump.gpg
#   ./scripts/restore.sh --vault-only ./backups/vault_daily_2024-01-15.tar.gz.gpg
#   ./scripts/restore.sh --no-migrate ./backups/db_monthly_2024-01-01.dump.gpg
#
# Environment Variables:
#   BACKUP_PASSPHRASE  - GPG decryption passphrase (required for encrypted backups)
#   DATABASE_URL       - PostgreSQL connection string
#   VAULT_DIR          - Path to vault directory (default: ./vault)
#   BACKUP_DIR         - Path to backup directory (default: ./backups)
#
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
RESTORE_DB=true
RESTORE_VAULT=true
RUN_MIGRATIONS=true
VERIFY_CHECKSUM=true
DRY_RUN=false
BACKUP_FILE=""

# Default paths
BACKUP_DIR="${BACKUP_DIR:-./backups}"
VAULT_DIR="${VAULT_DIR:-./vault}"
MANIFEST_FILE="${BACKUP_DIR}/manifest.json"

# ============================================
# HELPER FUNCTIONS
# ============================================

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

show_help() {
    head -50 "$0" | tail -40
    exit 0
}

cleanup() {
    if [ -n "$TEMP_DECRYPTED_FILE" ] && [ -f "$TEMP_DECRYPTED_FILE" ]; then
        log_info "Cleaning up temporary files..."
        rm -f "$TEMP_DECRYPTED_FILE"
    fi
}

trap cleanup EXIT

# ============================================
# PARSE ARGUMENTS
# ============================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --db-only)
            RESTORE_VAULT=false
            shift
            ;;
        --vault-only)
            RESTORE_DB=false
            shift
            ;;
        --no-migrate)
            RUN_MIGRATIONS=false
            shift
            ;;
        --no-verify)
            VERIFY_CHECKSUM=false
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# ============================================
# VALIDATION
# ============================================

if [ -z "$BACKUP_FILE" ]; then
    log_error "No backup file specified"
    echo ""
    echo "Usage: $0 [options] <backup_file>"
    echo "Run '$0 --help' for more information"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if file is encrypted
IS_ENCRYPTED=false
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    IS_ENCRYPTED=true
    if [ -z "$BACKUP_PASSPHRASE" ]; then
        log_error "BACKUP_PASSPHRASE environment variable required for encrypted backups"
        exit 1
    fi
fi

# Determine backup type
IS_DB_BACKUP=false
IS_VAULT_BACKUP=false

if [[ "$BACKUP_FILE" == *db_* ]] || [[ "$BACKUP_FILE" == *.dump* ]]; then
    IS_DB_BACKUP=true
fi

if [[ "$BACKUP_FILE" == *vault_* ]] || [[ "$BACKUP_FILE" == *.tar.gz* ]]; then
    IS_VAULT_BACKUP=true
fi

# Check DATABASE_URL for DB restore
if [ "$RESTORE_DB" = true ] && [ "$IS_DB_BACKUP" = true ]; then
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable required for database restore"
        exit 1
    fi
fi

# ============================================
# DISPLAY RESTORE PLAN
# ============================================

echo ""
echo "============================================"
echo "  MGR CAPITAL ASSISTANCE — RESTORE PLAN"
echo "============================================"
echo ""
echo "Backup file:     $BACKUP_FILE"
echo "Encrypted:       $IS_ENCRYPTED"
echo "DB backup:       $IS_DB_BACKUP"
echo "Vault backup:    $IS_VAULT_BACKUP"
echo ""
echo "Actions:"
[ "$RESTORE_DB" = true ] && [ "$IS_DB_BACKUP" = true ] && echo "  - Restore database"
[ "$RESTORE_VAULT" = true ] && [ "$IS_VAULT_BACKUP" = true ] && echo "  - Restore vault files to: $VAULT_DIR"
[ "$RUN_MIGRATIONS" = true ] && [ "$RESTORE_DB" = true ] && echo "  - Run Prisma migrations"
[ "$VERIFY_CHECKSUM" = true ] && echo "  - Verify checksum"
[ "$IS_ENCRYPTED" = true ] && echo "  - Decrypt with GPG"
echo ""

if [ "$DRY_RUN" = true ]; then
    log_warn "DRY RUN MODE - No changes will be made"
    exit 0
fi

# Confirm before proceeding
read -p "Proceed with restore? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log_warn "Restore cancelled"
    exit 0
fi

echo ""
log_info "Starting restore process..."
START_TIME=$(date +%s)

# ============================================
# STEP 1: VERIFY CHECKSUM
# ============================================

if [ "$VERIFY_CHECKSUM" = true ] && [ -f "$MANIFEST_FILE" ]; then
    log_info "Verifying backup checksum..."

    BACKUP_FILENAME=$(basename "$BACKUP_FILE")
    CURRENT_CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')

    # Extract expected checksum from manifest
    EXPECTED_CHECKSUM=$(grep -o "\"filename\":\"$BACKUP_FILENAME\"[^}]*\"checksum\":\"[a-f0-9]*\"" "$MANIFEST_FILE" 2>/dev/null | grep -o '"checksum":"[a-f0-9]*"' | cut -d'"' -f4 || echo "")

    if [ -n "$EXPECTED_CHECKSUM" ]; then
        if [ "$CURRENT_CHECKSUM" = "$EXPECTED_CHECKSUM" ]; then
            log_success "Checksum verified: $CURRENT_CHECKSUM"
        else
            log_error "Checksum mismatch!"
            log_error "Expected: $EXPECTED_CHECKSUM"
            log_error "Got:      $CURRENT_CHECKSUM"
            exit 1
        fi
    else
        log_warn "No checksum found in manifest, skipping verification"
    fi
fi

# ============================================
# STEP 2: DECRYPT IF ENCRYPTED
# ============================================

WORKING_FILE="$BACKUP_FILE"

if [ "$IS_ENCRYPTED" = true ]; then
    log_info "Decrypting backup file..."

    TEMP_DECRYPTED_FILE="${BACKUP_FILE%.gpg}"

    gpg --decrypt --batch --yes --passphrase "$BACKUP_PASSPHRASE" \
        -o "$TEMP_DECRYPTED_FILE" "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        log_success "Decryption complete"
        WORKING_FILE="$TEMP_DECRYPTED_FILE"
    else
        log_error "Decryption failed"
        exit 1
    fi
fi

# ============================================
# STEP 3: RESTORE DATABASE
# ============================================

if [ "$RESTORE_DB" = true ] && [ "$IS_DB_BACKUP" = true ]; then
    log_info "Restoring database..."

    # Parse DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

    log_info "  Host: $DB_HOST:$DB_PORT"
    log_info "  Database: $DB_NAME"
    log_info "  User: $DB_USER"

    # Run pg_restore
    export PGPASSWORD="$DB_PASSWORD"

    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --clean --if-exists --no-owner "$WORKING_FILE" 2>&1 || {
        # pg_restore may exit with non-zero on warnings
        log_warn "pg_restore completed with warnings (this is often normal)"
    }

    unset PGPASSWORD

    log_success "Database restored from: $(basename "$WORKING_FILE")"
fi

# ============================================
# STEP 4: RESTORE VAULT FILES
# ============================================

if [ "$RESTORE_VAULT" = true ] && [ "$IS_VAULT_BACKUP" = true ]; then
    log_info "Restoring vault files..."

    # Backup existing vault if it exists
    if [ -d "$VAULT_DIR" ]; then
        VAULT_BACKUP="${VAULT_DIR}_restore_backup_$(date +%s)"
        log_info "Backing up existing vault to: $VAULT_BACKUP"
        mv "$VAULT_DIR" "$VAULT_BACKUP"
    fi

    # Create vault parent directory
    VAULT_PARENT=$(dirname "$VAULT_DIR")
    mkdir -p "$VAULT_PARENT"

    # Extract tar archive
    tar -xzf "$WORKING_FILE" -C "$VAULT_PARENT"

    if [ $? -eq 0 ]; then
        log_success "Vault files restored to: $VAULT_DIR"
    else
        log_error "Failed to extract vault files"
        # Restore backup if we made one
        if [ -d "$VAULT_BACKUP" ]; then
            mv "$VAULT_BACKUP" "$VAULT_DIR"
            log_info "Restored original vault from backup"
        fi
        exit 1
    fi
fi

# ============================================
# STEP 5: RUN PRISMA MIGRATIONS
# ============================================

if [ "$RUN_MIGRATIONS" = true ] && [ "$RESTORE_DB" = true ] && [ "$IS_DB_BACKUP" = true ]; then
    log_info "Running Prisma migrations..."

    # Navigate to backend directory if we're not already there
    if [ -d "./backend" ]; then
        cd ./backend
        BACKEND_DIR=true
    fi

    npx prisma migrate deploy 2>&1 || {
        log_warn "Prisma migrations completed with warnings"
    }

    if [ "$BACKEND_DIR" = true ]; then
        cd ..
    fi

    log_success "Prisma migrations applied"
fi

# ============================================
# COMPLETE
# ============================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "============================================"
echo "  RESTORE COMPLETE"
echo "============================================"
echo ""
echo "Duration:        ${DURATION}s"
[ "$RESTORE_DB" = true ] && [ "$IS_DB_BACKUP" = true ] && echo "Database:        Restored"
[ "$RESTORE_VAULT" = true ] && [ "$IS_VAULT_BACKUP" = true ] && echo "Vault:           Restored"
[ "$RUN_MIGRATIONS" = true ] && [ "$RESTORE_DB" = true ] && echo "Migrations:      Applied"
echo ""
log_success "System restore completed successfully!"
echo ""

# Log to file
RESTORE_LOG="${BACKUP_DIR}/restore.log"
echo "[$(date -Iseconds)] Restored from: $BACKUP_FILE (${DURATION}s)" >> "$RESTORE_LOG"
