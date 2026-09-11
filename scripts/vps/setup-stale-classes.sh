#!/bin/bash
# Installs (or reinstalls) the hourly never-started community class sweep.
# Requires: the app running on 127.0.0.1:3000 with CRON_SECRET in /opt/podium/.env.local.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "== Sweep script =="
install -m 755 "$DIR/close-stale-classes.sh" /usr/local/sbin/close-stale-classes.sh

echo "== Systemd units =="
install -m 644 "$DIR/podium-stale-classes.service" /etc/systemd/system/podium-stale-classes.service
install -m 644 "$DIR/podium-stale-classes.timer" /etc/systemd/system/podium-stale-classes.timer

systemctl daemon-reload
systemctl enable --now podium-stale-classes.timer

echo "== Status =="
systemctl is-active podium-stale-classes.timer && echo "   sweep armed (hourly)"
systemctl list-timers podium-stale-classes.timer --no-pager | head -3
