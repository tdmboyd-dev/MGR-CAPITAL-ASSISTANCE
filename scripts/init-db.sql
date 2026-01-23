-- =============================================================================
-- MGR CAPITAL ASSISTANCE — Database Initialization Script
-- This script runs when the PostgreSQL container is first created
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application user (optional - for least privilege)
-- DO $$
-- BEGIN
--     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mgr_app') THEN
--         CREATE ROLE mgr_app WITH LOGIN PASSWORD 'app_password';
--     END IF;
-- END
-- $$;

-- Grant permissions (uncomment if using separate app user)
-- GRANT CONNECT ON DATABASE mgr_capital TO mgr_app;
-- GRANT USAGE ON SCHEMA public TO mgr_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mgr_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mgr_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mgr_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mgr_app;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'MGR Capital Assistance database initialized successfully';
END
$$;
