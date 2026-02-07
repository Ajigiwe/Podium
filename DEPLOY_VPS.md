---
description: How to deploy the Podium LMS (Next.js + LiveKit) on a Linux VPS using Docker.
---

# VPS Deployment Guide for Podium LMS

This guide assumes you have a detailed VPS (Ubuntu 24.04 recommended) and root access.

## Prerequisites
- **Domain Name:** `podiumclass.online`
    - Create an `A Record` for `@` pointing to your VPS IP.
    - Create an `A Record` for `livekit` (e.g., `livekit.podiumclass.online`) pointing to your VPS IP.
    - Create an `A Record` for `turn` (e.g., `turn.podiumclass.online`) pointing to your VPS IP.

## 1. Initial Server Setup
Connect to your VPS:
```bash
ssh root@<YOUR_VPS_IP>
```
*(Use the password sent to your email)*

## 2. Install Docker
We will use Docker to run both LiveKit and your Next.js app.

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

## 3. Set Up LiveKit Server
LiveKit provides a script to generate a configuration for you.

1.  **Run the generator:**
    ```bash
    docker run --rm -it -v$PWD:/output livekit/generate
    ```

2.  **Follow the prompts:**
    - **Domain:** `livekit.podiumclass.online`
    - **LiveKit Release:** `Latest`
    - **Enable Turn?** Yes
    - **Turn Domain:** `turn.podiumclass.online`
    - **Startup Script?** Yes (Systemd)

3.  **Deploy LiveKit:**
    The script will create a folder (usually `podiumclass.online` or `livekit-config`).
    Move into that directory:
    ```bash
    cd <directory_created_by_script>
    docker compose up -d
    ```

    *Take note of the `API Key` and `Secret Key` it generates! You will need these for your Next.js env.*

## 4. Deploy Next.js App
Ideally, you should build a Docker image for your Next.js app, but you can also run it directly or use a `Dockerfile`.

### Option A: Using Docker (Recommended)
1.  **Clone your repo:**
    ```bash
    cd /opt
    git clone <YOUR_GITHUB_REPO_URL> podium
    cd podium
    ```

2.  **Create `.env.local`:**
    ```bash
    nano .env.local
    ```
    Paste your environment variables:
    ```
    NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com
    LIVEKIT_API_KEY=<YOUR_KEY_FROM_STEP_3>
    LIVEKIT_API_SECRET=<YOUR_SECRET_FROM_STEP_3>
    # ... other firebase vars
    ```

3.  **Build and Run:**
    Create a `Dockerfile` in your project root if you haven't (I can provide one).
    Then build:
    docker build -t podium-app .
    docker run -d -p 3000:3000 --name podium-app --env-file .env.local podium-app
    ```

### Option B: Using Docker Compose (Recommended for Egress)
I have updated `docker-compose.yml` to include both the App and the Recording Service (Egress).

1.  **Configure Egress:**
    Open `egress.yaml` and fill in your API keys and URL:
    ```yaml
    api_key: <YOUR_API_KEY>
    api_secret: <YOUR_SECRET>
    ws_url: wss://livekit.yourdomain.com
    redis:
      address: <YOUR_REDIS_IP>:6379
    ```

2.  **Run Everything:**
    ```bash
    docker compose up -d
    ```

## 5. Set Up Reverse Proxy (Nginx) for Next.js
LiveKit handles its own SSL, but your Next.js app on port 3000 needs HTTPS too.

1.  **Install Nginx & Certbot:**
    ```bash
    apt install -y nginx certbot python3-certbot-nginx
    ```

2.  **Configure Nginx:**
    Create a config file:
    ```bash
    nano /etc/nginx/sites-available/podium
    ```
    Content:
    ```nginx
    server {
        server_name yourdomain.com;
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

3.  **Enable Site:**
    ```bash
    ln -s /etc/nginx/sites-available/podium /etc/nginx/sites-enabled/
    rm /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
    ```

4.  **Get SSL Cert:**
    ```bash
    certbot --nginx -d yourdomain.com
    ```

## 6. Troubleshooting Recording (Egress)
If you see "Service Unavailable" or "no response from servers":

1.  **Check Egress Logs on VPS:**
    ```bash
    docker logs livekit-egress
    ```
    *Look for "could not connect to redis" or "invalid api key".*

2.  **Verify Redis Password:**
    The LiveKit installation script often sets a Redis password. 
    Check your LiveKit config: `cat /opt/livekit/livekit.yaml`
    If there is a `password` under `redis`, you MUST add it to your `egress.yaml`:
    ```yaml
    redis:
      address: localhost:6379
      password: <YOUR_REDIS_PASSWORD>
    ```

3.  **Check Permissions:**
    Ensure the recordings directory exists and is writable by Docker:
    ```bash
    mkdir -p /var/recordings
    chmod 777 /var/recordings
    ```

4.  **Restart Service:**
    ```bash
    docker compose up -d --force-recreate egress
    ```

## 7. Done!
- **Website:** `https://podiumclass.online`
- **LiveKit Server:** `wss://livekit.podiumclass.online`
