import { kv } from '@vercel/kv';

// Default menu data
const defaultMenu = {
  no: 1,
  goodId: 1,
  logoId: 1,
  price: 300,           // $3.00 (in cents) - DEFAULT PRICE
  price2: 300,
  isVisible: true,
  name: "Sugarcane Juice",
  name2: "Fresh Sugarcane",
  remark: "",
  timestamp: Date.now()
};

const defaultSettings = {
  machineId: "MACHINE001",
  merchantId: "MERCHANT001",
  syncInterval: 60,
  cashlessEnabled: true,
  timestamp: Date.now()
};

// Get menu from KV store (or return default)
export async function getMenu() {
  try {
    const menu = await kv.get('menu');
    return menu || defaultMenu;
  } catch (e) {
    console.log('KV not available, using default menu');
    return defaultMenu;
  }
}

// Update menu in KV store
export async function updateMenu(updates) {
  try {
    const current = await getMenu();
    const updated = { ...current, ...updates, timestamp: Date.now() };
    await kv.set('menu', updated);
    return updated;
  } catch (e) {
    console.log('KV not available:', e.message);
    return { ...defaultMenu, ...updates };
  }
}

// Get settings from KV store
export async function getSettings() {
  try {
    const settings = await kv.get('settings');
    return settings || defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
}

// Save order to KV store
export async function saveOrder(order) {
  try {
    const orders = await kv.get('orders') || [];
    order.id = Date.now();
    order.receivedAt = new Date().toISOString();
    orders.push(order);
    await kv.set('orders', orders);
    return order;
  } catch (e) {
    console.log('KV not available:', e.message);
    return order;
  }
}

// Get all orders
export async function getOrders() {
  try {
    return await kv.get('orders') || [];
  } catch (e) {
    return [];
  }
}
