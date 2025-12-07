import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// In-memory storage for menu, settings, orders
// TODO: Replace with Vercel KV or Prisma models for production
const storage = globalForPrisma.storage ?? {
  menu: {
    id: 'sugarcane',
    name: 'Fresh Sugarcane Juice',
    price: 500, // in cents ($5.00)
    timestamp: Date.now(),
  },
  deviceMenus: {}, // Device-specific pricing
  settings: {
    syncInterval: 300,
    cashlessEnabled: true,
    maintenanceMode: false,
  },
  orders: [],
};

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.storage = storage;
}

// Get menu (optionally device-specific)
export async function getMenu(deviceId = null) {
  if (deviceId && storage.deviceMenus[deviceId]) {
    return { ...storage.menu, ...storage.deviceMenus[deviceId] };
  }
  return storage.menu;
}

// Update menu (optionally device-specific)
export async function updateMenu(updates, machineId = null) {
  const newData = {
    ...updates,
    timestamp: Date.now(),
  };

  if (machineId) {
    storage.deviceMenus[machineId] = {
      ...(storage.deviceMenus[machineId] || {}),
      ...newData,
    };
    return { ...storage.menu, ...storage.deviceMenus[machineId] };
  }

  storage.menu = { ...storage.menu, ...newData };
  return storage.menu;
}

// Get all menus (global + device-specific)
export async function getAllMenus() {
  const menus = [{ ...storage.menu, machineId: 'global' }];

  for (const [machineId, overrides] of Object.entries(storage.deviceMenus)) {
    menus.push({
      ...storage.menu,
      ...overrides,
      machineId,
    });
  }

  return menus;
}

// Get settings
export async function getSettings() {
  return storage.settings;
}

// Save order
export async function saveOrder(order) {
  const saved = {
    ...order,
    id: Date.now().toString(),
    receivedAt: new Date().toISOString(),
  };
  storage.orders.push(saved);
  return saved;
}

// Get all orders
export async function getOrders() {
  return storage.orders;
}

export default db;
