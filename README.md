# ⚔️ Eldoria Idle

A shared-world, persistent browser idle MMORPG built with TypeScript, WebSockets, HTML5 Canvas, and Node.js. Inspired by the deep skilling loops of Old School RuneScape and Melvor Idle, featuring real-time multiplayer presence on a 2D tilemap and exact offline progression.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* Node.js v20+ or v22+
* npm v10+

### Run Dev Environment
```bash
# 1. Install all workspace dependencies
npm install

# 2. Build the shared packages
npm run build:shared

# 3. Start Server & Client concurrently
npm run dev
```
* Client: `http://localhost:5173` (with Vite hot reloading and backend WebSocket proxy)
* Server API: `http://localhost:3000`

---

## 🌐 Deploying to Free Cloud Hosting

The server is architected for **single-port serving**: the Node HTTP server serves the production client bundle (`dist`), the REST API (`/api`), and real-time WebSockets (`/ws`) on the exact same port with zero CORS configuration needed.

### Option 1: Render.com (Free Tier)
1. Push your repository to GitHub or GitLab.
2. Sign up on [Render.com](https://render.com).
3. Click **New +** $\rightarrow$ **Web Service** and select your repository.
4. Render will automatically detect [`render.yaml`](file:///home/gar/share/browsermmo/render.yaml) or use these settings:
   * **Environment:** `Node`
   * **Build Command:** `npm install && npm run build`
   * **Start Command:** `npm start`
5. Click **Deploy**. Your game will be live at `https://your-app.onrender.com`.

### Option 2: Railway.app / Koyeb / Fly.io
The included [`Dockerfile`](file:///home/gar/share/browsermmo/Dockerfile) is multi-stage, slim, and runs out-of-the-box on any container-based free tier:
* **Build Target:** `Dockerfile`
* **Exposed Port:** `3000`

---

## 🖥️ Deploying to a VPS (Ubuntu / Debian Linux)

### Method A: Docker Compose (Recommended)
Clone the repository to your VPS and run:
```bash
# Start container in background with persistent volume mounts
docker compose up -d --build
```
Your game is running on port `3000`. Player saves persist in the `./data` folder.

### Method B: Native Systemd / PM2
```bash
# 1. Build project
npm install
npm run build

# 2. Run with PM2
npm install -g pm2
PORT=3000 pm2 start npm --name "eldoria-idle" -- start
pm2 save
pm2 startup
```

### Reverse Proxy (Nginx) with WebSocket support
```nginx
server {
    server_name play.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🗺️ Core Architecture

* **`packages/shared`**: Portable TypeScript engine containing the 600ms tick definitions, exact Level 1-241 XP curve math, drop chances, combat formulas, recipes, and offline catch-up simulation engine.
* **`packages/server`**: Lightweight Express + WebSocket server managing player persistence, grid collisions, interactive world nodes, and World Boss raids.
* **`packages/client`**: Vite-powered client with HTML5 canvas 2D grid rendering, floating player chat bubbles, animated tasks, and responsive UI panels.
