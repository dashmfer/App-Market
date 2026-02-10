#!/bin/bash
#
# Database Backup Script
#
# Usage:
#   ./scripts/db-backup.sh
#
# Requires:
#   - DATABASE_URL or DIRECT_URL env var set
#   - pg_dump installed (comes with PostgreSQL)
#
# Recommended: Run via cron daily
#   0 3 * * * cd /path/to/App-Market && ./scripts/db-backup.sh
#

set -euo pipefail

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/appmarket_${TIMESTAMP}.sql.gz"
RETAIN_DAYS=30

# Use DIRECT_URL (bypasses connection pooling) or fallback to DATABASE_URL
DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "ERROR: Set DATABASE_URL or DIRECT_URL environment variable"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting database backup at $(date)"
echo "[Backup] Output: $BACKUP_FILE"

pg_dump "$DB_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[Backup] Complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Clean up old backups
DELETED=$(find "$BACKUP_DIR" -name "appmarket_*.sql.gz" -mtime +${RETAIN_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[Backup] Cleaned up $DELETED backups older than ${RETAIN_DAYS} days"
fi

echo "[Backup] Done at $(date)"
