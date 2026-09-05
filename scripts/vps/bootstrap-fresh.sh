#!/bin/bash
# Podium VPS bootstrap: run ONCE on a fresh Ubuntu 24.04 install.
# Hardens SSH, installs Docker + tools, clones the repo. Idempotent-ish.
set -euo pipefail

PUBKEY_LOCAL="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHMcHU6uZQ9fIIojdgeArVSRSahYqXe0/5JiP5KsAqps codebuff-loadtest"
REPO_URL="https://github.com/Ajigiwe/Podium.git"

echo "== 1. SSH hardening =="
mkdir -p /root/.ssh && chmod 700 /root/.ssh
grep -qF "$PUBKEY_LOCAL" /root/.ssh/authorized_keys 2>/dev/null || echo "$PUBKEY_LOCAL" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

SSHD=/etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' $SSHD
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' $SSHD
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' $SSHD
rm -f /etc/ssh/sshd_config.d/50-cloud-init.conf
systemctl reload ssh 2>/dev/null || systemctl reload sshd || true
echo "   password auth disabled, key installed"

echo "== 2. Base packages =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git fail2ban ufw postgresql postgresql-contrib gpg jq > /dev/null
systemctl enable --now fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
maxretry = 6
bantime = 1h
findtime = 10m
EOF
systemctl restart fail2ban
echo "   fail2ban active"

echo "== 3. Firewall =="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 7880/tcp
ufw allow 7881/tcp
ufw allow 5349/tcp
ufw allow 3000/tcp
ufw --force enable
echo "   ufw active (22/80/443/7880/7881/5349/3000)"

echo "== 4. Docker =="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
fi
systemctl enable --now docker
docker --version

echo "== 5. Node.js 20 (for admin scripts) =="
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null
fi
node --version

echo "== 6. Clone repo =="
cd /opt
[ -d podium ] || git clone $REPO_URL podium
cd podium
echo "   cloned $(git rev-parse --short HEAD)"

echo "== 7. rclone (backups) =="
command -v rclone >/dev/null || curl -s https://rclone.org/install.sh | bash > /dev/null 2>&1
rclone version | head -1

echo "== BOOTSTRAP DONE =="
echo "Next: create /opt/podium/.env.local with fresh secrets, then docker compose up"
