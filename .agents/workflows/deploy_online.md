---
description: How to deploy AgroTalk Assist with a local Mac M5 backend and Firebase frontend
---

# Online Deployment Guide (Local Backend + Firebase Frontend)

This guide helps you set up a **hybrid deployment**:
- **Backend (Node + Python)**: Runs on your Mac M5 (local).
- **Frontend (React)**: Hosted on Firebase (online).

---

## Step 1: Install a Tunneling Tool
Since your Mac is behind a router, you need a "tunnel" to make its local ports accessible to the internet. We recommend **zrok** (open-source) or **ngrok**.

### Option A: Install zrok (Recommended)
1. Install via Homebrew: `brew install openziti/zrok/zrok`
2. Sign up and enable it: [zrok.io](https://zrok.io)
3. Reserve a share: `zrok reserve public localhost:3001` (This gives you a permanent URL).

### Option B: Install ngrok
1. Install: `brew install ngrok/ngrok/ngrok`
2. Start tunnel: `ngrok http 3001`

---

## Step 2: Start Your Backends
Open two terminals on your Mac and start both servers:

**Terminal 1 (Python Backend):**
```bash
cd backend_py
python main.py
```

**Terminal 2 (Node Backend):**
```bash
cd backend
npm start
```

---

## Step 3: Configure Frontend for Production
Create or update `.env.production` in the root directory. Replace `YOUR_TUNNEL_URL` with the URL from Step 1.

```bash
# .env.production
VITE_API_URL=https://your-tunnel-url.zrok.io
```

---

## Step 4: Initialize Firebase
If you haven't already, install the Firebase CLI and login:

1. `npm install -g firebase-tools`
2. `firebase login`
3. `firebase init hosting`
   - Select your project.
   - What do you want to use as your public directory? **dist**
   - Configure as a single-page app? **Yes**
   - Set up automatic builds and deploys with GitHub? **No** (unless you want to).

---

## Step 5: Build and Deploy
Run these commands from the root directory:

// turbo
```bash
npm run build
firebase deploy --only hosting
```

---

## Important Notes
- **Keep your Mac on**: For the app to work online, your Mac and the tunnel must be running.
- **Python dependency**: The Node backend calls the Python backend on `localhost:8000`. As long as both run on the same Mac, you only need to expose the **Node backend (port 3001)**.
