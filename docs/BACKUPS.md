# MGR Capital Assistance — Backup Strategy

## Overview

This document outlines the backup procedures for the MGR Capital Assistance platform. All backups are sovereign (self-hosted) with no external SaaS dependencies.

## Components to Backup

### 1. PostgreSQL Database
The primary data store containing all cases, users, documents metadata, ledger entries, audit logs, and configuration.

### 2. Document Vault
Local filesystem storage containing all uploaded and generated documents (PDFs, client IDs, signed agreements).

### 3. Application Configuration
Environment files, secrets, and configuration that are not in version control.

---

## PostgreSQL Backup Commands

### Full Database Dump

```bash
# Basic dump (all data, all tables)
pg_dump -h localhost -U postgres -d mgr_capital -F c -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).dump

# With compression
pg_dump -h localhost -U postgres -d mgr_capital -F c -Z 9 -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).dump.gz

# SQL format (readable, larger)
pg_dump -h localhost -U postgres -d mgr_capital -F p -f /backups/db/mgr_capital_$(date +%Y%m%d_%H%M%S).sql
```

### Schema Only Backup

```bash
pg_dump -h localhost -U postgres -d mgr_capital --schema-only -f /backups/schema/schema_$(date +%Y%m%d).sql
```

### Data Only Backup

```bash
pg_dump -h localhost -U postgres -d mgr_capital --data-only -F c -f /backups/data/data_$(date +%Y%m%d_%H%M%S).dump
```

### Specific Tables Backup

```bash
# Critical tables only (users, cases, ledger)
pg_dump -h localhost -U postgres -d mgr_capital \
  -t "User" -t "Case" -t "LedgerEntry" -t "Document" \
  -F c -f /backups/critical/critical_$(date +%Y%m%d_%H%M%S).dump
```

---

## Restore Commands

### Full Restore

```bash
# Drop existing and restore
pg_restore -h localhost -U postgres -d mgr_capital -c -F c /backups/db/mgr_capital_YYYYMMDD_HHMMSS.dump

# Restore to new database
createdb -h localhost -U postgres mgr_capital_restored
pg_restore -h localhost -U postgres -d mgr_capital_restored -F c /backups/db/mgr_capital_YYYYMMDD_HHMMSS.dump
```

### SQL Format Restore

```bash
psql -h localhost -U postgres -d mgr_capital -f /backups/db/mgr_capital_YYYYMMDD_HHMMSS.sql
```

---

## Cron Schedules

### Recommended Backup Schedule

```cron
# /etc/cron.d/mgr-backups

# Hourly: Document vault incremental
0 * * * * root rsync -av --delete /app/storage/documents/ /backups/documents/hourly/

# Every 6 hours: Database snapshot
0 */6 * * * root /opt/mgr/scripts/backup_db.sh >> /var/log/mgr-backup.log 2>&1

# Daily at 2 AM: Full database dump + document archive
0 2 * * * root /opt/mgr/scripts/daily_backup.sh >> /var/log/mgr-backup.log 2>&1

# Weekly on Sunday at 3 AM: Full archive + offsite sync
0 3 * * 0 root /opt/mgr/scripts/weekly_backup.sh >> /var/log/mgr-backup.log 2>&1

# Monthly on 1st at 4 AM: Long-term archive
0 4 1 * * root /opt/mgr/scripts/monthly_archive.sh >> /var/log/mgr-backup.log 2>&1
```

### Backup Script Example (`/opt/mgr/scripts/backup_db.sh`)

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="mgr_capital"

# Create backup
pg_dump -h localhost -U postgres -d $DB_NAME -F c -Z 9 \
  -f "$BACKUP_DIR/mgr_capital_$TIMESTAMP.dump.gz"

# Verify backup
pg_restore --list "$BACKUP_DIR/mgr_capital_$TIMESTAMP.dump.gz" > /dev/null 2>&1

echo "[$TIMESTAMP] Database backup completed successfully"
```

---

## Retention Policy

### Backup Retention Schedule

| Backup Type | Frequency | Retention Period |
|-------------|-----------|------------------|
| Hourly snapshots | Every hour | 24 hours |
| 6-hour snapshots | Every 6 hours | 7 days |
| Daily backups | Daily at 2 AM | 30 days |
| Weekly backups | Sunday at 3 AM | 90 days |
| Monthly archives | 1st of month | 1 year |
| Annual archives | January 1st | 7 years (legal) |

### Retention Script Example

```bash
#!/bin/bash
# Clean old backups

# Remove hourly backups older than 24 hours
find /backups/documents/hourly/ -mtime +1 -delete

# Remove 6-hour snapshots older than 7 days
find /backups/db/6hour/ -mtime +7 -name "*.dump.gz" -delete

# Remove daily backups older than 30 days
find /backups/db/daily/ -mtime +30 -name "*.dump.gz" -delete

# Remove weekly backups older than 90 days
find /backups/db/weekly/ -mtime +90 -name "*.dump.gz" -delete

# Keep monthly backups for 1 year
find /backups/db/monthly/ -mtime +365 -name "*.dump.gz" -delete
```

---

## Encryption Guidance

### At-Rest Encryption

All backups should be encrypted before storage:

```bash
# Encrypt backup with GPG
gpg --cipher-algo AES256 --symmetric --batch --passphrase-file /etc/mgr/backup-key \
  -o "$BACKUP_DIR/mgr_capital_$TIMESTAMP.dump.gz.gpg" \
  "$BACKUP_DIR/mgr_capital_$TIMESTAMP.dump.gz"

# Remove unencrypted version
rm "$BACKUP_DIR/mgr_capital_$TIMESTAMP.dump.gz"
```

### Decrypt for Restore

```bash
gpg --decrypt --batch --passphrase-file /etc/mgr/backup-key \
  -o /tmp/restore.dump.gz \
  /backups/db/mgr_capital_YYYYMMDD.dump.gz.gpg
```

### Key Management

1. **Store encryption keys separately from backups**
2. **Use hardware security modules (HSM) in production**
3. **Rotate keys annually**
4. **Document key recovery procedures**

---

## Document Vault Backup

### Sync Command

```bash
# Local backup
rsync -av --delete \
  /app/storage/documents/ \
  /backups/documents/$(date +%Y%m%d)/

# Compress archive
tar -czvf /backups/documents/vault_$(date +%Y%m%d).tar.gz \
  /backups/documents/$(date +%Y%m%d)/
```

### Incremental Backup with rsync

```bash
rsync -av --delete --backup --backup-dir=/backups/documents/incremental/$(date +%Y%m%d_%H%M) \
  /app/storage/documents/ \
  /backups/documents/current/
```

---

## Disaster Recovery Procedures

### Recovery Time Objectives (RTO/RPO)

| Scenario | RPO (Max Data Loss) | RTO (Time to Recover) |
|----------|--------------------|-----------------------|
| Database corruption | 6 hours | 2 hours |
| Full server failure | 6 hours | 4 hours |
| Ransomware attack | 24 hours | 8 hours |
| Natural disaster | 24 hours | 24 hours |

### Recovery Steps

1. **Assess the situation** - Determine scope and cause
2. **Isolate affected systems** - Prevent further damage
3. **Select recovery point** - Choose backup to restore
4. **Restore database** - Use pg_restore commands above
5. **Restore documents** - Use rsync to restore vault
6. **Verify integrity** - Run validation scripts
7. **Test functionality** - Verify system operations
8. **Document incident** - Create post-mortem report

### Validation Script

```bash
#!/bin/bash
# Validate backup integrity

BACKUP_FILE=$1

# Check file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found"
  exit 1
fi

# Verify pg_dump format
pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Backup file is corrupted"
  exit 1
fi

echo "Backup validation passed"
```

---

## Monitoring & Alerts

### Backup Monitoring Checks

1. **Backup completion** - Verify backup job completed
2. **Backup size** - Alert if size differs >20% from average
3. **Backup age** - Alert if newest backup is >8 hours old
4. **Disk space** - Alert if backup disk is >80% full
5. **Integrity check** - Weekly validation of random backup

### Alert Configuration

```bash
# Check backup age
NEWEST_BACKUP=$(ls -t /backups/db/*.dump.gz | head -1)
BACKUP_AGE=$(($(date +%s) - $(stat -c %Y "$NEWEST_BACKUP")))

if [ $BACKUP_AGE -gt 28800 ]; then  # 8 hours
  echo "ALERT: Database backup is $((BACKUP_AGE/3600)) hours old" | \
    mail -s "MGR Backup Alert" alerts@mgrcapital.com
fi
```

---

## Offsite Storage

### Recommended Approach

1. **Primary**: On-premises backup server (separate from production)
2. **Secondary**: Encrypted backup to sovereign cloud storage
3. **Tertiary**: Physical media stored in secure offsite location

### Sovereign Cloud Options (No US Data Centers)

- Self-hosted MinIO/S3-compatible storage
- European-based providers with GDPR compliance
- Private colocation with your own hardware

### Sync to Offsite

```bash
# Sync to offsite server via SSH
rsync -avz --progress \
  -e "ssh -i /etc/mgr/offsite-key" \
  /backups/db/daily/ \
  backup@offsite.mgrcapital.internal:/backups/mgr/

# Verify sync
ssh -i /etc/mgr/offsite-key backup@offsite.mgrcapital.internal \
  "ls -la /backups/mgr/ | tail -5"
```

---

## Testing Schedule

### Backup Test Procedures

| Test | Frequency | Procedure |
|------|-----------|-----------|
| Backup verification | Daily | Automated pg_restore --list |
| Partial restore | Weekly | Restore single table to test DB |
| Full restore | Monthly | Restore to staging environment |
| DR drill | Quarterly | Full disaster recovery simulation |

### Full Restore Test Script

```bash
#!/bin/bash
# Monthly restore test

TEST_DB="mgr_capital_test_$(date +%Y%m%d)"
BACKUP_FILE=$(ls -t /backups/db/daily/*.dump.gz | head -1)

# Create test database
createdb -h localhost -U postgres $TEST_DB

# Restore
pg_restore -h localhost -U postgres -d $TEST_DB -F c $BACKUP_FILE

# Validate row counts
psql -h localhost -U postgres -d $TEST_DB -c "SELECT 'User' as table, count(*) FROM \"User\" UNION ALL SELECT 'Case', count(*) FROM \"Case\" UNION ALL SELECT 'LedgerEntry', count(*) FROM \"LedgerEntry\";"

# Cleanup
dropdb -h localhost -U postgres $TEST_DB

echo "Restore test completed successfully"
```

---

## Contact Information

- **Primary DBA**: [Internal contact]
- **Secondary DBA**: [Internal contact]
- **After-hours emergency**: [Internal contact]
- **Offsite storage vendor**: [Internal contact]

---

*Last updated: 2026-01-21*
*Document owner: MGR Capital IT Operations*
