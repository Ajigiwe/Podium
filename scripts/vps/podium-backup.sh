#!/bin/bash
# Podium nightly backup: Postgres + MinIO + recordings + config, tarred and
# GPG-encrypted, uploaded offsite via rclone (b2:podium-backup) when configured.
# Local copies always kept in /var/backups/podium as a fallback.
# Emails only on failure (via Resend), so silence = success.

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
set -u

LOG=/var/log/podium-backup.log
STAGE=/var/backups/podium
PASSFILE=/root/.backup-passphrase
TS=$(date +%F_%H%M)
HOST=$(hostname)
ARCHIVE="podium-${TS}.tar.gz.gpg"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

alert_fail() {
  [ -r /etc/ssh-alert.env ] && . /etc/ssh-alert.env
  [ -n "${RESEND_API_KEY:-}" ] && [ -n "${ALERT_TO:-}" ] && \
  curl -s -o /dev/null -m 10 -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' \
    -d "{\"from\":\"Podium Security <security@podiumclass.online>\",\"to\":[\"$ALERT_TO\"],\"subject\":\"[Podium VPS] BACKUP FAILED\",\"html\":\"<p style=\\\"font-family:sans-serif\\\">Nightly backup failed on <b>$HOST</b>. Check <code>/var/log/podium-backup.log</code>.</p><pre style=\\\"font-family:monospace\\\">${1:-unknown error}</pre>\"}"
  true
}

mkdir -p "$STAGE" /var/lib/podium-backup
exec 9>/var/lib/podium-backup/lock
flock -n 9 || { log "SKIP another run holds the lock"; exit 0; }

[ -r "$PASSFILE" ] || { log "FATAL no passphrase file $PASSFILE"; alert_fail "missing $PASSFILE"; exit 1; }

log "=== backup start $TS ==="
rm -rf "${STAGE:?}/current"
mkdir -p "$STAGE/current"
cd "$STAGE/current" || exit 1

# 1. Postgres dump (podium DB)
if ! runuser -u postgres -- pg_dump podium > podium-db.sql 2>>"$LOG"; then
  log "FATAL pg_dump failed"; alert_fail "pg_dump failed"; exit 1
fi
log "pg_dump ok ($(du -h podium-db.sql | cut -f1))"

# 2. MinIO object data
tar -C /opt/minio -czf minio-data.tar.gz data 2>>"$LOG" || { log "FATAL minio tar failed"; alert_fail "minio tar failed"; exit 1; }
log "minio ok ($(du -h minio-data.tar.gz | cut -f1))"

# 3. Class recordings
tar -C /var -czf recordings.tar.gz recordings 2>>"$LOG" || { log "FATAL recordings tar failed"; alert_fail "recordings tar failed"; exit 1; }
log "recordings ok ($(du -h recordings.tar.gz | cut -f1))"

# 4. Config: app env, compose, nginx, alert env, custom units
tar -czf config.tar.gz \
  /opt/podium/.env.local /opt/podium/docker-compose.yml \
  /etc/nginx/nginx.conf /etc/nginx/sites-enabled /etc/nginx/sites-available \
  /etc/ssh-alert.env /etc/systemd/system/ssh-spike.timer /etc/systemd/system/ssh-spike.service \
  /etc/systemd/system/block-attacker-ip.service /etc/pam.d/sshd \
  2>>"$LOG" || { log "FATAL config tar failed"; alert_fail "config tar failed"; exit 1; }
log "config ok"

# 5. Encrypt the whole bundle
tar -czf - . | gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-file "$PASSFILE" -o "$STAGE/$ARCHIVE" 2>>"$LOG" \
  || { log "FATAL encryption failed"; alert_fail "encryption failed"; exit 1; }
sha256sum "$STAGE/$ARCHIVE" > "$STAGE/$ARCHIVE.sha256"
rm -rf "$STAGE/current"
log "encrypted bundle: $ARCHIVE ($(du -h "$STAGE/$ARCHIVE" | cut -f1))"

# 6. Offsite upload when B2 remote is configured
if rclone listremotes 2>/dev/null | grep -qi '^b2:'; then
  if rclone copy "$STAGE/$ARCHIVE" "b2:podium-backup" --transfers 2 >>"$LOG" 2>&1 \
     && rclone copy "$STAGE/$ARCHIVE.sha256" "b2:podium-backup" >>"$LOG" 2>&1; then
    rclone delete "b2:podium-backup" --min-age 14d >>"$LOG" 2>&1
    log "OFFSITE uploaded to b2:podium-backup"
  else
    log "WARN offsite upload failed (local copy retained)"
  fi
else
  log "OFFSITE SKIPPED - rclone b2 remote not configured yet"
fi

# 7. Local retention: keep the 7 most recent bundles
ls -1t "$STAGE"/podium-*.tar.gz.gpg 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$STAGE"/podium-*.tar.gz.gpg.sha256 2>/dev/null | tail -n +8 | xargs -r rm -f

log "=== backup done OK ==="
exit 0
