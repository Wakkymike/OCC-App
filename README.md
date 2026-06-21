# OCC App — Operations Control Centre

A real-time bus operations control centre built with Next.js 15, SQLite, and Socket.io. Designed for self-hosted deployment on a VPS.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, shadcn/ui |
| Backend | Custom Node.js HTTP server, Next.js API routes |
| Database | SQLite (via better-sqlite3), WAL mode |
| Auth | Argon2id (salt + pepper), JWT in HTTP-only secure cookies |
| Real-time | Socket.io (WebSocket) |
| Maps | Mapbox GL JS |

## Prerequisites

- **Node.js** ≥ 18 (20+ recommended)
- **npm** ≥ 9
- A **Mapbox** access token (for maps and geocoding)
- *(Optional)* A **BODS** (Bus Open Data Service) API key

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> occ-app
cd occ-app

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env.local
```

Edit `.env.local` and fill in the required values:

```dotenv
# --- Required ---
AUTH_PEPPER=<random-32+-char-string>
JWT_SECRET=<random-64+-char-string>
SUPER_ADMIN_EMAIL=you@yourdomain.com
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx

# --- Optional ---
BODS_API_KEY=
NEXT_PUBLIC_SOCKET_URL=http://localhost:9002
```

> **Tip:** Generate secrets with `openssl rand -base64 48`

```bash
# 4. Run in development mode
npm run dev
```

The app is now running at **http://localhost:9002**.

### First-Time Setup

1. Navigate to **http://localhost:9002/sign-up** and create an account using the email you set in `SUPER_ADMIN_EMAIL`.
2. That account will automatically have irrevocable super-admin privileges.
3. From the admin panel you can invite additional users and assign roles.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server (port 9002) |
| `npm run build` | Build for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Production Build & Run

```bash
npm run build
npm start
```

The production server listens on `0.0.0.0:9002` by default. Override with the `PORT` and `HOSTNAME` environment variables.

## Project Structure

```
server.ts              # Custom HTTP server (Next.js + Socket.io)
src/
  app/                 # Next.js App Router pages & API routes
    api/               # REST API endpoints
      auth/            # login, register, logout, me, change-password, finish-sign-up
      users/           # User CRUD
      active-alerts/   # Alert CRUD
      monitored-hazards/
      network-updates/
      call-logs/
      driver-hours/
      invitations/
      buses/           # Live bus data proxy
      metrolink/       # Metrolink data proxy
      roadworks/       # Roadworks proxy
      hazards/         # Hazards proxy
      ...
  components/          # React components
  contexts/            # Auth & Socket.io React contexts
  hooks/               # Custom React hooks
  lib/
    auth/              # Password hashing, JWT, auth middleware
    db/                # SQLite connection & schema
    socket/            # Socket.io event definitions
data/
  occ.db               # SQLite database (created automatically on first run)
```

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `AUTH_PEPPER` | **Yes** | Pepper string for Argon2id password hashing. Changing this invalidates all existing passwords. |
| `JWT_SECRET` | **Yes** | Secret for signing JWT session tokens. |
| `SUPER_ADMIN_EMAIL` | **Yes** | Email of the super-admin account (irrevocable admin access). |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | **Yes** | Mapbox GL access token. |
| `BODS_API_KEY` | No | Bus Open Data Service API key for live bus data. |
| `NEXT_PUBLIC_SOCKET_URL` | No | WebSocket URL for clients. Defaults to the same origin. |
| `PORT` | No | Server port (default `9002`). |
| `HOSTNAME` | No | Server bind address (default `0.0.0.0`). |
| `TLS_CERT_PATH` | No | Path to TLS certificate (e.g. Let's Encrypt `fullchain.pem`). Enables HTTPS when set with `TLS_KEY_PATH`. |
| `TLS_KEY_PATH` | No | Path to TLS private key (e.g. Let's Encrypt `privkey.pem`). |

---

## Direct HTTPS (without Nginx)

The server can terminate TLS directly using Let's Encrypt (or any other) certificates — no reverse proxy required.

Add to `.env.local`:

```dotenv
TLS_CERT_PATH=/etc/letsencrypt/live/occ.yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/occ.yourdomain.com/privkey.pem
NEXT_PUBLIC_SOCKET_URL=https://occ.yourdomain.com:9002
```

Ensure the Node process can read the cert files:

```bash
sudo setfacl -m u:www-data:rX /etc/letsencrypt/live /etc/letsencrypt/archive
```

If neither `TLS_CERT_PATH` nor `TLS_KEY_PATH` are set, the server runs plain HTTP as usual.

---

## Deploying on a VPS with Nginx

### 1. Prepare the Server

```bash
# Install Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build tools (needed for native modules like argon2 and better-sqlite3)
sudo apt-get install -y build-essential python3

# Install Nginx
sudo apt-get install -y nginx
```

### 2. Clone & Build the App

```bash
cd /opt
sudo git clone <repo-url> occ-app
sudo chown -R $USER:$USER occ-app
cd occ-app

npm install
cp .env.example .env.local
# Edit .env.local with your production values — in particular:
#   NEXT_PUBLIC_SOCKET_URL=https://occ.yourdomain.com
#   SUPER_ADMIN_EMAIL=admin@yourdomain.com
nano .env.local

npm run build
```

### 3. Create a systemd Service

Create `/etc/systemd/system/occ-app.service`:

```ini
[Unit]
Description=OCC App
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/occ-app
EnvironmentFile=/opt/occ-app/.env.local
ExecStart=/usr/bin/node --import tsx server.ts
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/occ-app/data

[Install]
WantedBy=multi-user.target
```

```bash
# Set correct ownership for the data directory
sudo mkdir -p /opt/occ-app/data
sudo chown -R www-data:www-data /opt/occ-app/data

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable occ-app
sudo systemctl start occ-app

# Check status
sudo systemctl status occ-app
sudo journalctl -u occ-app -f
```

### 4. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/occ-app`:

```nginx
server {
    listen 80;
    server_name occ.yourdomain.com;

    # Redirect HTTP -> HTTPS (enable after Certbot is set up)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:9002;
        proxy_http_version 1.1;

        # Headers for Next.js
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (Socket.io)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for long-polling fallback
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Optional: serve Next.js static assets directly from Nginx
    location /_next/static/ {
        alias /opt/occ-app/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/occ-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Enable HTTPS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d occ.yourdomain.com
```

After Certbot finishes, update `.env.local`:

```dotenv
NEXT_PUBLIC_SOCKET_URL=https://occ.yourdomain.com
```

Then restart the app:

```bash
sudo systemctl restart occ-app
```

### 6. Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Database

The SQLite database file is stored at `data/occ.db` and is created automatically on first startup. To back up:

```bash
# Safe hot-backup (WAL mode safe)
sqlite3 /opt/occ-app/data/occ.db ".backup /backups/occ-$(date +%F).db"
```

## License

Proprietary. All rights reserved.