# scripts/restore.sh - Database Restore Script
#!/bin/bash

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -la backups/dreammaker_backup_*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="restore_$(date +%Y%m%d_%H%M%S)"

echo "🔄 Restoring from backup: $BACKUP_FILE"

# Confirm restore
read -p "⚠️  This will overwrite the current database. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

# Extract backup
echo "📦 Extracting backup..."
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR" --strip-components=1

# Stop services
echo "⏸️  Stopping services..."
docker-compose -f docker-compose.prod.yml stop backend

# Restore MongoDB
echo "🗄️  Restoring MongoDB..."
if [ -d "$RESTORE_DIR/mongodb" ]; then
    mongorestore --uri="$MONGODB_URI" --drop "$RESTORE_DIR/mongodb"
fi

# Restore files
echo "📁 Restoring uploaded files..."
if [ -f "$RESTORE_DIR/uploads.tar.gz" ]; then
    tar -xzf "$RESTORE_DIR/uploads.tar.gz"
fi

# Start services
echo "▶️  Starting services..."
docker-compose -f docker-compose.prod.yml start backend

# Clean up
rm -rf "$RESTORE_DIR"

echo "✅ Restore completed successfully"

---