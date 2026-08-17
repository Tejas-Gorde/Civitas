# CIVITAS Mobile & Remote Voting Guide

This document describes how to configure and test real remote phone voting using Cloudflare Tunnel (`cloudflared`) to expose local Next.js and FastAPI services over secure public HTTPS.

---

## 1. Prerequisites

Phone browsers (Google Chrome on Android, Apple Safari on iOS) require **HTTPS** for:
- `navigator.mediaDevices.getUserMedia()` camera access for Step 3 photo verification.
- `window.speechSynthesis` audio unlock.
- `WebAuthn` Touch ID authentication.

---

## 2. Local Development Architecture

```
Phone Browser (Android/iOS)
        │
        ▼ (HTTPS Public Tunnel URL)
  Cloudflare Tunnel (cloudflared)
        │
        ▼ (HTTP localhost:3000)
   Next.js Frontend
        │
        ▼ (HTTP localhost:8000/api/v1)
    FastAPI Backend
        │
        ▼
     SQLite Database (voting.db)
```

---

## 3. Step-by-Step Tunnel Setup

### Step 1: Install Cloudflare CLI (`cloudflared`)

On macOS:
```bash
brew install cloudflared
```

### Step 2: Start Backend & Frontend

Terminal 1 (FastAPI Backend):
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (Next.js Frontend):
```bash
cd frontend
npm run dev
```
*(Note whether Next.js starts on port 3000 or 3001)*

### Step 3: Start Cloudflare Tunnel for Frontend

Terminal 3 (Automated Tunnel & Port Sync Script):
```bash
./scripts/start-remote-voting.sh
```

Or manually point `cloudflared` to the actual frontend port:
```bash
# If Next.js is running on 3001:
cloudflared tunnel --url http://localhost:3001

# If Next.js is running on 3000:
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will generate a public HTTPS URL such as:
`https://random-subdomain.trycloudflare.com`

---

## 4. Admin Setup & QR Code Voting

1. Open the Admin Panel on desktop: `http://localhost:3000/admin`
2. Navigate to **Elections**.
3. For an Open election, click **Turn On** under Remote Voting or click **QR Code & Link**.
4. In the modal:
   - Click **Enable Remote Voting**.
   - Copy the generated secure link (`https://<tunnel-domain>/vote/<secure-token>`).
   - Scan the displayed **QR Code** directly from your phone camera.

---

## 5. Security & Verification Features

- **Cryptographic Tokens**: Access tokens are generated using `secrets.token_urlsafe(32)`.
- **Token Revocation**: Administrators can regenerate or instantly revoke tokens.
- **One Person / One Vote**: The backend atomically checks eligibility and voting status (`voted_at`) before allowing ballot casting. Re-submitting or refreshing will reject further votes with an error.
- **HTTPS Enforcement**: Camera.tsx automatically checks `window.isSecureContext` to give clear diagnostic feedback if accessed without HTTPS.
