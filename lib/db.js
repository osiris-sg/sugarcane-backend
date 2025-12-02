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

// Get menu for a specific machine (or default)
export async function getMenu(machineId = null) {
  try {
    // Try device-specific menu first
    if (machineId) {
      const deviceMenu = await kv.get(`menu:${machineId}`);
      if (deviceMenu) {
        console.log(`[DB] Found menu for device: ${machineId}`);
        return deviceMenu;
      }
    }

    // Fall back to global menu
    const globalMenu = await kv.get('menu');
    if (globalMenu) {
      return globalMenu;
    }

    return defaultMenu;
  } catch (e) {
    console.log('KV not available, using default menu');
    return defaultMenu;
  }
}

// Update menu - can be global or device-specific
export async function updateMenu(updates, machineId = null) {
  try {
    const key = machineId ? `menu:${machineId}` : 'menu';
    const current = await getMenu(machineId);
    const updated = { ...current, ...updates, timestamp: Date.now() };

    if (machineId) {
      updated.machineId = machineId;
    }

    await kv.set(key, updated);
    console.log(`[DB] Menu updated for ${machineId || 'global'}: $${(updated.price / 100).toFixed(2)}`);
    return updated;
  } catch (e) {
    console.log('KV not available:', e.message);
    return { ...defaultMenu, ...updates };
  }
}

// Get all device menus
export async function getAllMenus() {
  try {
    const keys = await kv.keys('menu:*');
    const menus = [];

    for (const key of keys) {
      const menu = await kv.get(key);
      if (menu) {
        menus.push({ key, ...menu });
      }
    }

    // Also get global menu
    const globalMenu = await kv.get('menu');
    if (globalMenu) {
      menus.push({ key: 'menu', type: 'global', ...globalMenu });
    }

    return menus;
  } catch (e) {
    return [defaultMenu];
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
