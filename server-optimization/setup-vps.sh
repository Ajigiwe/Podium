#!/bin/bash

# LiveKit VPS Optimization Script
# Targets: Ubuntu/Debian on Contabo VPS (8 Cores, 24GB RAM)

set -e

echo "🚀 Starting LiveKit System Optimization..."

# 1. Increase System Limits
echo "📋 Increasing system limits..."
cat <<EOF | sudo tee -a /etc/security/limits.conf
*                soft    nofile          65536
*                hard    nofile          65536
root             soft    nofile          65536
root             hard    nofile          65536
*                soft    nproc           65536
*                hard    nproc           65536
EOF

# 2. Network Performance Tuning (sysctl)
echo "🌐 Tuning network stack..."
cat <<EOF | sudo tee -a /etc/sysctl.conf
# Network performance tuning
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_slow_start_after_idle = 0
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_tw_reuse = 1
fs.file-max = 2097152
EOF

sudo sysctl -p

# 3. Enable BBR Congestion Control
echo "⚡ Enabling BBR..."
sudo modprobe tcp_bbr
echo "tcp_bbr" | sudo tee -a /etc/modules
sudo sysctl -w net.core.default_qdisc=fq
sudo sysctl -w net.ipv4.tcp_congestion_control=bbr

# 4. Tune Existing Redis performance
# Redis is likely already installed (per your egress.yaml). 
# These settings optimize it for high-concurrency LiveKit state management.

echo "⚙️ Optimizing Redis for performance..."
# We append these to redis.conf if they aren't already there
if ! grep -q "maxmemory 2gb" /etc/redis/redis.conf; then
    cat <<EOF | sudo tee -a /etc/redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save ""
appendonly no
EOF
    echo "✅ Redis performance settings applied."
else
    echo "ℹ️ Redis optimization settings already present."
fi

sudo systemctl restart redis
sudo systemctl enable redis

# 5. Open Firewall Ports
echo "🛡️ Configuring Firewall (UFW)..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 7880/tcp       # LiveKit API
    sudo ufw allow 7881/tcp       # LiveKit TCP fallback
    sudo ufw allow 50000:60000/udp # RTC UDP range
    sudo ufw allow 3478/udp        # TURN
    sudo ufw allow 40000:40100/udp # TURN Relay range
    sudo ufw reload
fi

echo "✅ Optimization complete! Please restart LiveKit or REBOOT the server for all changes to take effect."
echo "   Command: sudo reboot"
