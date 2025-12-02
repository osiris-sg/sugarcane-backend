// In-memory database
// Note: Data resets on each deployment. For persistent data, use a real database.
// Recommended: Vercel Postgres, PlanetScale, or Supabase (all have free tiers)

export const db = {
  menus: [
    {
      no: 1,
      goodId: 1,
      logoId: 1,
      price: 300,           // $3.00 (in cents) - CHANGE THIS TO YOUR PRICE
      price2: 300,
      isVisible: true,
      name: "Sugarcane Juice",
      name2: "Fresh Sugarcane",
      remark: "",
      timestamp: Date.now()
    }
  ],
  settings: {
    machineId: "MACHINE001",
    merchantId: "MERCHANT001",
    syncInterval: 60,
    cashlessEnabled: true,
    timestamp: Date.now()
  },
  orders: [],
  cashLogs: []
};
