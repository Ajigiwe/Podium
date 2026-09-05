#!/bin/bash
# Failed SSH login spike detector. Runs every 5 min via systemd timer.
# Emails once per hour if failed logins in the last 10 minutes hit the threshold.
# Fail-open: alerting problems must never affect SSH itself.

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[ -r /etc/ssh-alert.env ] && . /etc/ssh-alert.env
[ -n "$RESEND_API_KEY" ] || exit 0

LOG=/var/log/ssh-alert.log
THRESHOLD="${SPIKE_THRESHOLD:-15}"
WINDOW_MIN="${SPIKE_WINDOW_MIN:-10}"
COOLDOWN_MIN="${SPIKE_COOLDOWN_MIN:-60}"

SINCE=$(date -d "-${WINDOW_MIN} min" '+%F %T')
COUNT=$(journalctl -u ssh --since "$SINCE" --no-pager 2>/dev/null | grep -cE 'Failed password|Invalid user| Connection closed by authenticating' || true)

if [ "$COUNT" -lt "$THRESHOLD" ]; then
  echo "$(date '+%F %T') SPIPE ok count=$COUNT" >> "$LOG" 2>/dev/null
  exit 0
fi

STATE=/var/lib/ssh-alert/last-spike
NOW=$(date +%s)
LAST=0
[ -r "$STATE" ] && LAST=$(cat "$STATE" 2>/dev/null || echo 0)
if [ $((NOW - LAST)) -lt $((COOLDOWN_MIN * 60)) ]; then
  echo "$(date '+%F %T') SPIPE cooldown count=$COUNT" >> "$LOG" 2>/dev/null
  exit 0
fi
mkdir -p /var/lib/ssh-alert && echo "$NOW" > "$STATE"

# Top source IPs for the report
TOP=$(journalctl -u ssh --since "$SINCE" --no-pager 2>/dev/null | grep -oE 'from [0-9a-fA-F:.]+' | awk '{print $2}' | sort | uniq -c | sort -rn | head -5 | awk '{printf "%sx%s ", $2, $1}')
[ -n "$TOP" ] || TOP="n/a"

TS=$(date '+%Y-%m-%d %H:%M:%S %Z')
HOST=$(hostname)

curl -s -o /dev/null -m 10 -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"Podium Security <security@podiumclass.online>\",\"to\":[\"$ALERT_TO\"],\"subject\":\"[Podium VPS] FAILED-LOGIN SPIKE: $COUNT attempts in ${WINDOW_MIN} min\",\"html\":\"<h2 style=\\\"margin:0 0 8px;font-family:sans-serif\\\">Failed login spike</h2><p style=\\\"font-family:sans-serif\\\"><b>$COUNT failed SSH attempts</b> in the last ${WINDOW_MIN} minutes on <b>$HOST</b> (161.97.176.191).</p><p style=\\\"font-family:sans-serif\\\">Top sources: <code>$TOP</code></p><p style=\\\"font-family:sans-serif;color:#b91c1c\\\">Password auth is disabled, so these attempts cannot succeed — this is background brute-force noise unless accompanied by a login alert.</p>\"}" 

echo "$(date '+%F %T') SPIPE ALERT count=$COUNT top=$TOP" >> "$LOG" 2>/dev/null
exit 0
