export default function Home() {
  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Sugarcane Vending Machine Backend</h1>
      <p style={{ color: 'green' }}>Server is running</p>

      <h2>Machine Endpoints</h2>
      <ul>
        <li>POST /api/Machine/GetMenus2</li>
        <li>POST /api/Machine/GetSettings2</li>
        <li>POST /api/Machine/GetServerTime</li>
        <li>POST /api/Machine/UploadOrder</li>
        <li>POST /api/Machine/UploadCash</li>
        <li>POST /api/Machine/GetPaymentQr</li>
        <li>POST /api/Machine/ClosePayment</li>
      </ul>

      <h2>Admin Endpoints</h2>
      <ul>
        <li>GET /api/admin/menu - View menu</li>
        <li>PUT /api/admin/menu - Update price</li>
        <li>GET /api/admin/orders - View orders</li>
      </ul>

      <h2>Change Price</h2>
      <pre style={{ background: '#f0f0f0', padding: '10px' }}>
{`curl -X PUT ${typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'}/api/admin/menu \\
  -H "Content-Type: application/json" \\
  -d '{"price": 300}'`}
      </pre>
      <p>Price is in cents: 300 = $3.00, 500 = $5.00</p>
    </div>
  );
}
