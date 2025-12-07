# Sugarcane Vending Machine Backend (Next.js)

Backend API for the Sugarcane Vending Machine Android app with Telegram notification subscriptions.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **API**: tRPC + REST
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `DIRECT_URL` - Direct connection for migrations
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `MAINTENANCE_PASSWORD` - Password for admin subscriptions

### 3. Setup Database

```bash
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Server runs on http://localhost:5188

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repo
5. Add environment variables
6. Click "Deploy"

Vercel will give you a URL like: `https://sugarcane-backend.vercel.app`

### Set Telegram Webhook

After deploying, set the webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-domain.vercel.app/api/telegram/webhook"
```

---

## API Endpoints

### Machine Endpoints (called by vending machine)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/Machine/GetMenus2` | Get menu items with prices |
| POST | `/api/Machine/GetSettings2` | Get machine settings |
| POST | `/api/Machine/GetServerTime` | Get server time |
| POST | `/api/Machine/UploadOrder` | Upload completed order |
| POST | `/api/Machine/UploadCash` | Upload cash log |
| POST | `/api/Machine/GetPaymentQr` | Get payment QR |
| POST | `/api/Machine/ClosePayment` | Close payment |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/menu` | View menu |
| PUT | `/api/admin/menu` | Update price |
| GET | `/api/admin/orders` | View orders |

### Telegram Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/telegram/webhook` | Telegram bot webhook |
| GET | `/api/telegram/subscribers?category=STOCK` | Get subscribers list |
| POST | `/api/telegram/send` | Send notification to subscribers |

---

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and help |
| `/help` | Show available commands |
| `/status` | View your subscriptions |
| `/subscribe stock` | Subscribe to stock & fault alerts |
| `/subscribe maintenance` | Subscribe to maintenance alerts (password required) |
| `/unsubscribe stock` | Unsubscribe from stock alerts |
| `/unsubscribe maintenance` | Unsubscribe from maintenance alerts |

### Subscription Categories

**STOCK** (No password required)
- Low stock warnings (50% and 25%)
- Device faults

**MAINTENANCE** (Admin only - password required)
- Maintenance mode logins
- Stock top-ups

---

## Send Notification from Android App

The Android app can send notifications by calling:

```bash
POST /api/telegram/send
Content-Type: application/json

{
  "category": "STOCK",  // or "MAINTENANCE"
  "message": "⚠️ Low Stock Alert\n\nDevice: 116 Jln Tenteram\nStock: 15 sticks remaining",
  "type": "stock_alert",
  "deviceId": "123",
  "deviceName": "116 Jln Tenteram"
}
```

---

## Change Price

```bash
curl -X PUT https://your-app.vercel.app/api/admin/menu \
  -H "Content-Type: application/json" \
  -d '{"price": 300}'
```

Price in cents: `300` = $3.00, `500` = $5.00

---

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
npm run db:migrate   # Run migrations
```
