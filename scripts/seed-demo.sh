#!/bin/bash
# Track Your Shit - Demo Data Seed Wrapper
# Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
#
# Seeds the Track Your Shit database with realistic demo data for screenshots.
# Usage: bash scripts/seed-demo.sh [--clean]

set -euo pipefail

DB_DIR="$HOME/Library/Application Support/net.fluxlabs.track-your-shit"
DB_PATH="$DB_DIR/track-your-shit.db"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEED_FILE="$SCRIPT_DIR/seed-demo-data.sql"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Track Your Shit — Demo Data Seeder ===${NC}"
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
    echo "Run the app at least once to create the database, then re-run this script."
    exit 1
fi

# Handle --clean flag: wipe demo data before seeding
if [[ "${1:-}" == "--clean" ]]; then
    echo -e "${YELLOW}Cleaning existing demo data...${NC}"
    # Delete in dependency order; ignore missing tables
    for stmt in \
        "DELETE FROM test_results WHERE id LIKE 'tres-%'" \
        "DELETE FROM test_runs WHERE id LIKE 'tr-%'" \
        "DELETE FROM costs WHERE id LIKE 'cost-%'" \
        "DELETE FROM tasks WHERE id LIKE 't-%'" \
        "DELETE FROM phases WHERE id LIKE 'ph-%'" \
        "DELETE FROM roadmaps WHERE id LIKE 'rm-%'" \
        "DELETE FROM activity_log WHERE id LIKE 'act-%'" \
        "DELETE FROM decisions WHERE id LIKE 'dec-%'" \
        "DELETE FROM knowledge WHERE id LIKE 'kn-%'" \
        "DELETE FROM gsd_todos WHERE id LIKE 'todo-%'" \
        "DELETE FROM gsd_milestones WHERE id LIKE 'ms-%'" \
        "DELETE FROM gsd_requirements WHERE id LIKE 'req-%'" \
        "DELETE FROM snippets WHERE id LIKE 'snip-%'" \
        "DELETE FROM cost_thresholds WHERE id LIKE 'ct-%'" \
        "DELETE FROM app_logs WHERE id LIKE 'log-%'" \
        "DELETE FROM notifications WHERE id LIKE 'notif-%'" \
        "DELETE FROM projects WHERE id LIKE 'proj-%'"; do
        sqlite3 "$DB_PATH" "$stmt" 2>/dev/null || true
    done
    echo -e "${GREEN}Cleaned.${NC}"
fi

# Backup existing DB
BACKUP_PATH="$DB_PATH.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "Backing up database to: ${YELLOW}$(basename "$BACKUP_PATH")${NC}"
cp "$DB_PATH" "$BACKUP_PATH"

# Run seed SQL
echo "Seeding demo data..."
sqlite3 "$DB_PATH" < "$SEED_FILE"

# Verify
PROJECT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM projects WHERE id LIKE 'proj-%';")
TASK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE id LIKE 't-%';")
TODO_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM gsd_todos WHERE id LIKE 'todo-%';")
KNOWLEDGE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM knowledge WHERE id LIKE 'kn-%';")
DECISION_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM decisions WHERE id LIKE 'dec-%';")
NOTIF_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM notifications WHERE id LIKE 'notif-%';")
LOG_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM app_logs WHERE id LIKE 'log-%';")

echo ""
echo -e "${GREEN}Demo data seeded successfully!${NC}"
echo "  Projects:      $PROJECT_COUNT"
echo "  Tasks:         $TASK_COUNT"
echo "  GSD Todos:     $TODO_COUNT"
echo "  Knowledge:     $KNOWLEDGE_COUNT"
echo "  Decisions:     $DECISION_COUNT"
echo "  Notifications: $NOTIF_COUNT"
echo "  Logs:          $LOG_COUNT"
echo ""
echo -e "Backup saved: ${YELLOW}$(basename "$BACKUP_PATH")${NC}"
echo "Launch Track Your Shit to see the demo data."
