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

// Save order (deprecated - use UploadOrder API directly)
export async function saveOrder(order) {
  const saved = await db.order.create({
    data: {
      orderId: order.orderId || `ORD-${Date.now()}`,
      deviceId: order.deviceId || 'unknown',
      deviceName: order.deviceName || order.deviceId || 'Unknown',
      amount: order.amount || 0,
      quantity: order.quantity || 1,
      payWay: order.payWay || null,
      isSuccess: order.isSuccess !== false,
    },
  });
  return saved;
}

// Get all orders from database
export async function getOrders() {
  return db.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100, // Limit to recent 100 orders
  });
}

// Helper: Look up device name from Device table
// Returns the stored device name, or falls back to provided name or default
export async function getDeviceNameById(deviceId, fallbackName = null) {
  try {
    const device = await db.device.findUnique({
      where: { deviceId: String(deviceId) },
      select: { deviceName: true },
    });

    if (device?.deviceName) {
      return device.deviceName;
    }

    return fallbackName || `Device ${deviceId}`;
  } catch (error) {
    console.error(`[getDeviceNameById] Error looking up device ${deviceId}:`, error);
    return fallbackName || `Device ${deviceId}`;
  }
}

export default db;
