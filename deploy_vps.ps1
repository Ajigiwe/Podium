# deploy_vps.ps1
# Automated deployment script for Podium LMS (Next.js + LiveKit) on Linux VPS

$vps_ip = "161.97.176.191"
$key_path = ".\.ssh_vps_key"

# Ensure we use UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=============================================" -ForegroundColor Green
Write-Host "Starting Podium LMS VPS Setup and Deployment" -ForegroundColor Green
Write-Host "Target VPS: $vps_ip" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Check if git key exists
if (!(Test-Path $key_path)) {
    Write-Error "SSH key not found at $key_path. Please generate it first."
    exit
}

# 2. Package current repository using git archive (excludes node_modules, .next, etc.)
Write-Host "`n[1/6] Packaging project files..." -ForegroundColor Cyan
if (Test-Path "project.tar.gz") { Remove-Item "project.tar.gz" }
git archive --format=tar.gz -o project.tar.gz HEAD
if (!(Test-Path "project.tar.gz")) {
    Write-Error "Failed to package project using git archive."
    exit
}
Write-Host "Successfully created project.tar.gz" -ForegroundColor Green

# 3. Copy files to VPS
Write-Host "`n[2/6] Uploading files to VPS (project.tar.gz and .env.local)..." -ForegroundColor Cyan
scp -i $key_path -o StrictHostKeyChecking=no project.tar.gz root@${vps_ip}:/opt/project.tar.gz
scp -i $key_path -o StrictHostKeyChecking=no .env.local root@${vps_ip}:/opt/.env.local
Remove-Item "project.tar.gz"
Write-Host "Files uploaded successfully." -ForegroundColor Green

# 4. Remote setup: Docker, Nginx, Directory structures
Write-Host "`n[3/6] Installing Docker, Nginx, and setting up directories on VPS..." -ForegroundColor Cyan
$remoteSetupCmd = @'
# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "Docker is already installed."
fi

# Install Nginx and Certbot
echo "Installing Nginx and Certbot..."
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Setup Directories
echo "Setting up application folders..."
mkdir -p /opt/podium
mkdir -p /var/recordings
chmod 777 /var/recordings

# Extract Project
echo "Extracting project files..."
tar -xzf /opt/project.tar.gz -C /opt/podium
mv /opt/.env.local /opt/podium/.env.local
rm /opt/project.tar.gz

# Setup Nginx configuration
echo "Configuring Nginx..."
cat << 'EOF' > /etc/nginx/sites-available/podium
server {
    listen 80;
    server_name podiumclass.online;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/podium /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
'@

ssh -i $key_path -o StrictHostKeyChecking=no root@$vps_ip $remoteSetupCmd
Write-Host "Remote base setup completed." -ForegroundColor Green

# 5. LiveKit Generation Setup instructions
Write-Host "`n[4/6] LiveKit Setup Guide" -ForegroundColor Yellow
Write-Host "LiveKit needs to run its interactive setup generator." -ForegroundColor Yellow
Write-Host "Please follow these steps in a moment when the SSH shell opens:" -ForegroundColor Yellow
Write-Host "1. Paste this command and run it: cd /opt && mkdir -p livekit && cd livekit && docker run --rm -it -v `$PWD:/output livekit/generate" -ForegroundColor Yellow
Write-Host "2. Answer the prompts:" -ForegroundColor Yellow
Write-Host "   - Primary Domain: livekit.podiumclass.online" -ForegroundColor Yellow
Write-Host "   - Use Let's Encrypt: Yes" -ForegroundColor Yellow
Write-Host "   - Use Host network: Yes" -ForegroundColor Yellow
Write-Host "   - Enable TURN: Yes" -ForegroundColor Yellow
Write-Host "   - TURN Domain: turn.podiumclass.online" -ForegroundColor Yellow
Write-Host "   - Startup Script: Yes (Systemd)" -ForegroundColor Yellow
Write-Host "   - Use custom credentials? Yes (Enter APIGzFR3hY8ZbFC and dni8frv6eNiRmTGPQfERUTTjsZRDRudth4yNtTxwJP2B)" -ForegroundColor Yellow
Write-Host "3. Once done, go to the generated folder (e.g. cd livekit.podiumclass.online) and run: docker compose up -d" -ForegroundColor Yellow
Write-Host "4. Type 'exit' to return to this script." -ForegroundColor Yellow

Read-Host "`nPress ENTER to open the SSH session to configure LiveKit..."
ssh -i $key_path -o StrictHostKeyChecking=no root@$vps_ip

# 6. Build and Deploy Next.js App
Write-Host "`n[5/6] Building and running the Next.js application on VPS..." -ForegroundColor Cyan
$remoteBuildCmd = @'
cd /opt/podium
echo "Building docker containers..."
docker compose build --pull
docker compose up -d
'@

ssh -i $key_path -o StrictHostKeyChecking=no root@$vps_ip $remoteBuildCmd
Write-Host "Next.js App & Egress running." -ForegroundColor Green

# 7. Get SSL Certificate
Write-Host "`n[6/6] Requesting SSL Certificate for podiumclass.online..." -ForegroundColor Cyan
Write-Host "This will run Certbot to configure HTTPS automatically." -ForegroundColor Yellow
ssh -i $key_path -o StrictHostKeyChecking=no root@$vps_ip "certbot --nginx -d podiumclass.online --non-interactive --agree-tos -m admin@podiumclass.online"

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host "Deployment complete! Visit https://podiumclass.online" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
