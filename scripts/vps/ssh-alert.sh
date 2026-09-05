#!/bin/bash
# SSH successful-login email alert. Invoked from /etc/pam.d/sshd via pam_exec.
# Fail-open: always exits 0 so a broken alert pipeline can never block logins.

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[ "$PAM_TYPE" = "open_session" ] || exit 0
[ -r /etc/ssh-alert.env ] && . /etc/ssh-alert.env
[ -n "$RESEND_API_KEY" ] || exit 0

LOG=/var/log/ssh-alert.log
USER_NAME=$(printf '%s' "${PAM_USER:-unknown}" | tr -cd 'A-Za-z0-9._-')
IP=$(printf '%s' "${PAM_RHOST:-unknown}" | tr -cd 'A-Za-z0-9.:_-')
[ -n "$IP" ] || IP="unknown"

# Skip trusted IPs (the owner's own connection)
for t in $TRUSTED_IPS 127.0.0.1 ::1; do
  if [ "$IP" = "$t" ]; then
    echo "$(date '+%F %T') SKIP  trusted-ip=$IP user=$USER_NAME" >> "$LOG" 2>/dev/null
    exit 0
  fi
done

TS=$(date '+%Y-%m-%d %H:%M:%S %Z')
HOST=$(hostname)

CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 10 -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"Podium Security <security@podiumclass.online>\",\"to\":[\"$ALERT_TO\"],\"subject\":\"[Podium VPS] SSH login: $USER_NAME from $IP\",\"html\":\"<h2 style=\\\"margin:0 0 8px;font-family:sans-serif\\\">SSH login detected</h2><p style=\\\"font-family:sans-serif\\\">Successful SSH login on <b>$HOST</b> (161.97.176.191).</p><table cellpadding=\\\"4\\\" style=\\\"font-family:sans-serif\\\"><tr><td><b>User</b></td><td>$USER_NAME</td></tr><tr><td><b>Source IP</b></td><td>$IP</td></tr><tr><td><b>Time</b></td><td>$TS</td></tr></table><p style=\\\"font-family:sans-serif;color:#b91c1c\\\"><b>If this wasn't you,</b> the server may be compromised — check <code>who</code> and <code>last -a</code> immediately.</p>\"}")

echo "$(date '+%F %T') LOGIN code=$CODE ip=$IP user=$USER_NAME" >> "$LOG" 2>/dev/null
exit 0
