# Sugarcane Vending Machine Backend (Next.js)

Backend API for the Sugarcane Vending Machine Android app.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repo
5. Click "Deploy"

Vercel will give you a URL like: `https://sugarcane-backend.vercel.app`

## Local Development

```bash
npm install
npm run dev
```

Server runs on http://localhost:5188

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

## Change Price

```bash
curl -X PUT https://your-app.vercel.app/api/admin/menu \
  -H "Content-Type: application/json" \
  -d '{"price": 300}'
```

Price in cents: `300` = $3.00, `500` = $5.00

## Update Android App

After deploying to Vercel, update the APK:

1. Edit `app/smali/com/xnkj1688/juice/service/DataService.smali`
2. Change `119.29.4.213:5188` to your Vercel URL (without https://)
3. Also update the protocol from `http://` to `https://`
4. Rebuild APK

## Note on Data Persistence

This uses in-memory storage. Data resets on each deployment.

For persistent data, add a database:
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) (free tier)
- [Supabase](https://supabase.com) (free tier)
- [PlanetScale](https://planetscale.com) (free tier)
