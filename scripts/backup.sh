# scripts/backup.sh - Database Backup Script
#!/bin/bash

set -e

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dreammaker_backup_$DATE"

echo "💾 Creating backup: $BACKUP_NAME"

# Create backup directory
mkdir -p $BACKUP_DIR

# MongoDB backup
echo "🗄️  Backing up MongoDB..."
if command -v mongodump >/dev/null 2>&1; then
    mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/$BACKUP_NAME/mongodb"
else
    docker-compose exec mongo mongodump --uri="$MONGODB_URI" --out="/backup/$BACKUP_NAME/mongodb"
fi

# Files backup
echo "📁 Backing up uploaded files..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME/uploads.tar.gz" uploads/

# Configuration backup
echo "⚙️  Backing up configuration..."
cp .env "$BACKUP_DIR/$BACKUP_NAME/.env.backup"
cp docker-compose.prod.yml "$BACKUP_DIR/$BACKUP_NAME/docker-compose.backup.yml"

# Create backup archive
echo "📦 Creating backup archive..."
cd $BACKUP_DIR
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME/"
rm -rf "$BACKUP_NAME/"

# Upload to S3 if configured
if [ -n "$S3_BACKUP_BUCKET" ]; then
    echo "☁️  Uploading backup to S3..."
    aws s3 cp "$BACKUP_NAME.tar.gz" "s3://$S3_BACKUP_BUCKET/backups/"
fi

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find . -name "dreammaker_backup_*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_NAME.tar.gz"

---