#!/bin/bash
# Reinstalls SSH login alerts + spike alerts on a fresh server.
# Requires: /opt/podium/.env.local with RESEND_API_KEY, /usr/local/sbin scripts.
set -euo pipefail

echo "== Alert scripts =="
# scripts are scp'd alongside this file; assume ssh-alert.sh + ssh-spike.sh are in /usr/local/sbin already
chmod 755 /usr/local/sbin/ssh-alert.sh /usr/local/sbin/ssh-spike.sh 2>/dev/null || true

echo "== Alert env =="
KEY=$(grep '^RESEND_API_KEY=' /opt/podium/.env.local | cut -d= -f2-)
printf 'RESEND_API_KEY=%s\nALERT_TO=minatoflash82@gmail.com\nTRUSTED_IPS=154.162.99.81\n' "$KEY" > /etc/ssh-alert.env
chmod 600 /etc/ssh-alert.env

echo "== PAM hook =="
grep -q 'ssh-alert.sh' /etc/pam.d/sshd || printf '\n# Podium SSH login alert (fail-open, optional)\nsession optional pam_exec.so /usr/local/sbin/ssh-alert.sh\n' >> /etc/pam.d/sshd

echo "== Spike timer =="
systemctl daemon-reload
systemctl enable --now ssh-spike.timer 2>/dev/null || true
systemctl is-active ssh-spike.timer && echo "   alerts armed"
