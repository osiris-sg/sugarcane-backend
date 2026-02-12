import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// Simple admin key check
const checkAdminKey = (request) => {
  const adminKey = request.headers.get('x-admin-key') ||
                   new URL(request.url).searchParams.get('adminKey');
  const validKey = process.env.ADMIN_KEY || 'sugarcane123';
  return adminKey === validKey;
};

// GET /api/admin/devices - List all devices
// No auth required for GET (dashboard uses Clerk auth at page level)
export async function GET(request) {
  try {
    // Get current user's role and group for access control
    const { userId } = await auth();
    let userGroupId = null;
    let userDriverId = null;
    let dbUser = null;

    if (userId) {
      dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          clerkId: true,
          role: true,
          groupId: true,
          roles: { select: { role: true } },
          assignedDrivers: { select: { id: true } }, // Drivers managed by this ops manager
        },
      });

      // Franchisees and Partnerships users can only see their own group's devices
      if ((dbUser?.role === 'FRANCHISEE' || dbUser?.role === 'PARTNERSHIPS') && dbUser.groupId) {
        userGroupId = dbUser.groupId;
      }
    }

    // Build where clause for devices based on role
    let whereClause = {};

    if (userGroupId) {
      // Franchisee/Partnerships: filter by group
      whereClause = { groups: { some: { groupId: userGroupId } } };
    } else if (dbUser) {
      // Check roles
      const hasAdminRole = ['ADMIN', 'MANAGER'].includes(dbUser.role) ||
        dbUser.roles?.some(r => ['ADMIN', 'MANAGER'].includes(r.role));
      const hasOpsManagerRole = dbUser.role === 'OPS_MANAGER' ||
        dbUser.roles?.some(r => r.role === 'OPS_MANAGER');
      const hasDriverRole = dbUser.role === 'DRIVER' ||
        dbUser.roles?.some(r => r.role === 'DRIVER');

      if (hasAdminRole) {
        // ADMIN/MANAGER: see all devices (no filter)
        whereClause = {};
      } else if (hasOpsManagerRole) {
        // OPS_MANAGER: see their assigned devices + devices of drivers they manage
        const managedDriverIds = dbUser.assignedDrivers?.map(d => d.id) || [];
        const allUserIds = [dbUser.id, ...managedDriverIds];

        whereClause = {
          OR: [
            { drivers: { some: { userId: { in: allUserIds } } } },
            { driverId: { in: [dbUser.id, dbUser.clerkId, ...managedDriverIds] } },
          ],
        };
      } else if (hasDriverRole) {
        // DRIVER: only see their assigned devices
        whereClause = {
          OR: [
            { drivers: { some: { userId: dbUser.id } } },
            { driverId: dbUser.id },
            { driverId: dbUser.clerkId },
          ],
        };
      }
    }

    const devices = await db.device.findMany({
      where: whereClause,
      include: {
        groups: {
          include: { group: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get stock data for all devices
    const stockData = await db.stock.findMany({
      select: {
        deviceId: true,
        quantity: true,
        maxStock: true,
        minStockThreshold: true,
        lastSaleAt: true,
      },
    });

    // Create a map for quick lookup
    const stockMap = new Map();
    stockData.forEach((s) => {
      stockMap.set(s.deviceId, s);
    });

    // Get storage data for all devices
    const storageData = await db.storage.findMany({
      select: {
        deviceId: true,
        quantity: true,
      },
    });

    // Create a map for quick lookup
    const storageMap = new Map();
    storageData.forEach((s) => {
      storageMap.set(s.deviceId, s.quantity);
    });

    // Check if device is unresponsive (active but no temp report for 10 minutes)
    const UNRESPONSIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
    const now = new Date();

    // Merge stock and storage data with devices and add unresponsive flag
    const devicesWithStock = devices.map((device) => {
      const stock = stockMap.get(device.deviceId);
      const storageQuantity = storageMap.get(device.deviceId) ?? null;

      // Calculate if device is unresponsive
      let isUnresponsive = false;
      if (device.isActive && device.tempUpdatedAt) {
        const lastTempReport = new Date(device.tempUpdatedAt);
        const timeSinceLastReport = now.getTime() - lastTempReport.getTime();
        isUnresponsive = timeSinceLastReport > UNRESPONSIVE_THRESHOLD_MS;
      } else if (device.isActive && !device.tempUpdatedAt) {
        // Active but never reported temp
        isUnresponsive = true;
      }

      // Extract groups from many-to-many relationship
      const deviceGroups = device.groups || [];
      // For backward compatibility, use first group as primary
      const primaryGroup = deviceGroups[0]?.group || null;

      return {
        ...device,
        // Backward compatibility: provide groupId and group from first group
        groupId: primaryGroup?.id || null,
        group: primaryGroup,
        // New: provide all groups
        allGroups: deviceGroups.map(dg => dg.group),
        stockQuantity: stock?.quantity ?? null,
        stockMax: stock?.maxStock ?? null,
        minStockThreshold: stock?.minStockThreshold ?? 20,
        cupStock: stock ? Math.round((stock.quantity / stock.maxStock) * 100) : null,
        lastSeenAt: device.tempUpdatedAt || null,
        // Temperature data (already in device table)
        refrigerationTemp: device.refrigerationTemp,
        machineTemp: device.machineTemp,
        tempUpdatedAt: device.tempUpdatedAt,
        isUnresponsive,
        // Storage data
        storageQuantity,
      };
    });

    return NextResponse.json({
      success: true,
      devices: devicesWithStock,
      count: devicesWithStock.length,
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/devices - Create or update a device
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, deviceName, location, price, isActive, groupId, removeFromGroupId, tid, fomoTid, additionalGroupIds } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Check if device exists and if location is changing
    const existingDevice = await db.device.findUnique({
      where: { deviceId },
    });

    const now = new Date();
    const locationChanged = existingDevice &&
      location !== undefined &&
      existingDevice.location !== location;

    // If location is changing, update location history
    if (locationChanged && existingDevice.location) {
      // End the previous location record
      const previousRecord = await db.locationHistory.findFirst({
        where: { deviceId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

      if (previousRecord) {
        const durationMs = now.getTime() - new Date(previousRecord.startedAt).getTime();
        await db.locationHistory.update({
          where: { id: previousRecord.id },
          data: { endedAt: now, durationMs },
        });
      }
    }

    // Create new location history record if location is set/changed
    if (location && (!existingDevice || locationChanged)) {
      await db.locationHistory.create({
        data: {
          deviceId,
          location,
          startedAt: now,
        },
      });
    }

    // Upsert - create if not exists, update if exists
    const device = await db.device.upsert({
      where: { deviceId: deviceId },
      update: {
        ...(deviceName !== undefined && { deviceName }),
        ...(location !== undefined && { location }),
        ...(price !== undefined && { price: parseInt(price) }),
        ...(isActive !== undefined && { isActive }),
        ...(tid !== undefined && { tid }),
        ...(fomoTid !== undefined && { fomoTid }),
      },
      create: {
        deviceId: deviceId,
        deviceName: deviceName || `Device ${deviceId}`,
        location: location || null,
        price: price ? parseInt(price) : 250, // Default $2.50
        isActive: isActive !== undefined ? isActive : false, // Default inactive until device reports temperature
        tid: tid || null,
        fomoTid: fomoTid || null,
      },
      include: {
        groups: { include: { group: true } },
      },
    });

    // Handle removing device from a specific group
    if (removeFromGroupId) {
      await db.deviceGroup.deleteMany({
        where: {
          deviceId: device.id,
          groupId: removeFromGroupId,
        }
      });
    }

    // Handle group assignment via many-to-many
    if (groupId !== undefined && groupId) {
      // Add device to this group (if not already)
      await db.deviceGroup.upsert({
        where: {
          deviceId_groupId: {
            deviceId: device.id,
            groupId: groupId,
          }
        },
        create: {
          deviceId: device.id,
          groupId: groupId,
        },
        update: {},
      });
    }

    // Handle additional group assignments (e.g., Partnership group)
    if (additionalGroupIds && Array.isArray(additionalGroupIds)) {
      for (const addGroupId of additionalGroupIds) {
        if (addGroupId && addGroupId !== groupId) {
          await db.deviceGroup.upsert({
            where: {
              deviceId_groupId: {
                deviceId: device.id,
                groupId: addGroupId,
              }
            },
            create: {
              deviceId: device.id,
              groupId: addGroupId,
            },
            update: {},
          });
        }
      }
    }

    // Fetch updated device with groups
    const updatedDevice = await db.device.findUnique({
      where: { id: device.id },
      include: {
        groups: { include: { group: true } },
      },
    });

    // Format response for backward compatibility
    const primaryGroup = updatedDevice.groups[0]?.group || null;

    return NextResponse.json({
      success: true,
      message: 'Device saved successfully',
      device: {
        ...updatedDevice,
        groupId: primaryGroup?.id || null,
        group: primaryGroup,
        allGroups: updatedDevice.groups.map(dg => dg.group),
      },
    });
  } catch (error) {
    console.error('Error saving device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/devices - Delete a device
export async function DELETE(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    await db.device.delete({
      where: { deviceId: deviceId },
    });

    return NextResponse.json({
      success: true,
      message: `Device ${deviceId} deleted`,
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
