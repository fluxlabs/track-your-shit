#!/bin/bash
# Control Tower - Demo Data Seed Wrapper
# Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
#
# Seeds the Control Tower database with realistic demo data for screenshots.
# Usage: bash scripts/seed-demo.sh

set -euo pipefail

DB_DIR="$HOME/Library/Application Support/net.fluxlabs.control-tower"
DB_PATH="$DB_DIR/control-tower.db"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_FILE="$SCRIPT_DIR/seed-demo-data.sql"
SEED_EXTENDED="$SCRIPT_DIR/seed-demo-extended.sql"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Control Tower Demo Data Seeder ==="
echo ""

# Check sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}Error: sqlite3 is not installed.${NC}"
    exit 1
fi

# Check seed file exists
if [ ! -f "$SEED_FILE" ]; then
    echo -e "${RED}Error: Seed file not found at $SEED_FILE${NC}"
    exit 1
fi

# Check if DB exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${YELLOW}Warning: Database not found at $DB_PATH${NC}"
    echo "Run the Control Tower app at least once to create the database, then re-run this script."
    exit 1
fi

# Backup existing DB
BACKUP_PATH="$DB_PATH.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "Backing up database to: ${YELLOW}$BACKUP_PATH${NC}"
cp "$DB_PATH" "$BACKUP_PATH"

# Run seed SQL
echo "Seeding core demo data..."
sqlite3 "$DB_PATH" < "$SEED_FILE"

if [ -f "$SEED_EXTENDED" ]; then
    echo "Seeding extended demo data (12 additional projects)..."
    sqlite3 "$DB_PATH" < "$SEED_EXTENDED"
fi

# Verify
PROJECT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM projects WHERE id LIKE 'proj-%';")
TASK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE id LIKE 't-%';")
EXEC_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM executions WHERE id LIKE 'exec-%';")
KNOWLEDGE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM knowledge WHERE id LIKE 'kn-%';")
DECISION_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM decisions WHERE id LIKE 'dec-%';")

echo ""
echo -e "${GREEN}Demo data seeded successfully!${NC}"
echo "  Projects:   $PROJECT_COUNT"
echo "  Tasks:      $TASK_COUNT"
echo "  Executions: $EXEC_COUNT"
echo "  Knowledge:  $KNOWLEDGE_COUNT"
echo "  Decisions:  $DECISION_COUNT"
echo ""
echo "Backup saved: $BACKUP_PATH"
echo "Launch Control Tower to see the demo data."
