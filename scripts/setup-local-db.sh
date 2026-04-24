#!/bin/bash
# Setup local PostgreSQL database for docbot development
#
# Prerequisites:
#   - PostgreSQL installed (brew install postgresql@16 on macOS)
#   - PostgreSQL running (brew services start postgresql@16)
#
# This script creates:
#   - A database user: docbot
#   - A database: docbot
#   - Required extensions

set -e

DB_USER="${DATABASE_USER:-docbot}"
DB_PASS="${DATABASE_PASSWORD:-docbot}"
DB_NAME="${DATABASE_NAME:-docbot}"

echo "Setting up local PostgreSQL database..."
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    echo "Error: PostgreSQL is not running"
    echo "Start it with: brew services start postgresql@16"
    exit 1
fi

# Create user if it doesn't exist
echo "Creating database user..."
psql postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "  User already exists"

# Create database if it doesn't exist
echo "Creating database..."
psql postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "  Database already exists"

# Grant privileges
echo "Granting privileges..."
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Enable extensions (as superuser, then grant to user)
echo "Enabling extensions..."
psql $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";" 2>/dev/null || true

echo ""
echo "Database setup complete!"
echo ""
echo "To run migrations:"
echo "  npm run db:migrate"
echo ""
echo "To check migration status:"
echo "  npm run db:migrate:status"
