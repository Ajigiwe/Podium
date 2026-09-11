#!/bin/bash
# Retires community classes that were created but then never started.
# Runs hourly via podium-stale-classes.timer.
# Fail-open: a failure here never affects classes or the app — it only logs.

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ENV_FILE=/opt/podium/.env.local
LOG=/var/log/podium-stale-classes.log

[ -r "$ENV_FILE" ] || exit 0

# Value may be bare, single- or double-quoted; strip whichever is present.
CRON_SECRET=$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | head -1 | tr -d '\r' | sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')
if [ -z "$CRON_SECRET" ]; then
  echo "$(date '+%F %T') SKIP no CRON_SECRET in $ENV_FILE" >> "$LOG" 2>/dev/null
  exit 0
fi

# The app container uses host networking, so it answers on loopback.
RESPONSE=$(curl -s -m 90 -X POST "http://127.0.0.1:3000/api/cron/close-stale-classes" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"olderThanHours":24}' 2>/dev/null || true)

[ -n "$RESPONSE" ] || RESPONSE='{"error":"no response from app"}'
echo "$(date '+%F %T') $RESPONSE" >> "$LOG" 2>/dev/null
exit 0
