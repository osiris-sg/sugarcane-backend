import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// Toggle between Order and OrderImport table
// Set to true to use imported CSV data, false to use original Order table
const USE_IMPORT_TABLE = true;
const orderTable = USE_IMPORT_TABLE ? db.orderImport : db.order;

// GET /api/admin/orders/summary - Get order summary by device with filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const period = searchParams.get('period') || 'day'; // day, week, month, custom
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    let groupId = searchParams.get('groupId'); // Single group (deprecated, use groupIds)
    const groupIds = searchParams.get('groupIds'); // Multiple groups (comma-separated)
    const deviceId = searchParams.get('deviceId'); // Single device (deprecated, use deviceIds)
    const deviceIds = searchParams.get('deviceIds'); // Multiple devices (comma-separated)

    // Get current user's role and group for access control
    const { userId } = await auth();
    let userGroupId = null;
    let isAdmin = false;

    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: { role: true, groupId: true },
      });

      // Check if user is admin/owner
      if (dbUser?.role === 'ADMIN' || dbUser?.role === 'OWNER') {
        isAdmin = true;
      }

      // Franchisees and Partnerships users can only see their own group's data
      if ((dbUser?.role === 'FRANCHISEE' || dbUser?.role === 'PARTNERSHIPS') && dbUser.groupId) {
        userGroupId = dbUser.groupId;
        // Force filter to user's group
        groupId = userGroupId;
      }
    }

    // Calculate date range based on period
    // Use SGT timezone (UTC+8) for all calculations
    const now = new Date();
    const SGT_OFFSET = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const sgtNow = new Date(now.getTime() + SGT_OFFSET);
    const sgtYear = sgtNow.getUTCFullYear();
    const sgtMonth = sgtNow.getUTCMonth();
    const sgtDate = sgtNow.getUTCDate();
    const sgtDay = sgtNow.getUTCDay(); // Day of week (0 = Sunday)

    // Helper to convert SGT date to UTC Date object for DB queries
    const sgtToUTC = (year, month, day) => new Date(Date.UTC(year, month, day) - SGT_OFFSET);

    let dateFrom, dateTo;

    switch (period) {
      case 'day':
        dateFrom = sgtToUTC(sgtYear, sgtMonth, sgtDate);
        dateTo = sgtToUTC(sgtYear, sgtMonth, sgtDate + 1);
        break;
      case 'week':
        dateFrom = sgtToUTC(sgtYear, sgtMonth, sgtDate - sgtDay);
        dateTo = sgtToUTC(sgtYear, sgtMonth, sgtDate + 1);
        break;
      case 'month':
        dateFrom = sgtToUTC(sgtYear, sgtMonth, 1);
        dateTo = sgtToUTC(sgtYear, sgtMonth + 1, 1);
        break;
      case 'custom':
        // Frontend already converts SGT to UTC ISO strings
        if (startDate) {
          dateFrom = new Date(startDate);
        }
        if (endDate) {
          dateTo = new Date(endDate);
        }
        break;
      default:
        dateFrom = sgtToUTC(sgtYear, sgtMonth, sgtDate);
        dateTo = sgtToUTC(sgtYear, sgtMonth, sgtDate + 1);
    }

    // Parse multi-select filters (comma-separated)
    const selectedGroupIds = groupIds ? groupIds.split(',').filter(Boolean) : (groupId ? [groupId] : []);
    const selectedDeviceIds = deviceIds ? deviceIds.split(',').filter(Boolean) : (deviceId ? [deviceId] : []);

    // Get devices with their groups (for filtering and display) - using many-to-many
    const deviceWhere = {};

    // Filter by groups (respects user restrictions for franchisees)
    if (userGroupId) {
      // Franchisee: only their group
      deviceWhere.groups = { some: { groupId: userGroupId } };
    } else if (selectedGroupIds.length > 0) {
      // Admin with group filter
      deviceWhere.groups = { some: { groupId: { in: selectedGroupIds } } };
    }

    // Filter by specific devices
    if (selectedDeviceIds.length > 0) {
      deviceWhere.deviceId = { in: selectedDeviceIds };
    }

    const devices = await db.device.findMany({
      where: deviceWhere,
      include: {
        groups: { include: { group: true } }
      },
    });

    // Create a map of deviceId to device info
    const deviceMap = {};
    devices.forEach(d => {
      // Use first group for backward compatibility
      const primaryGroup = d.groups[0]?.group || null;
      deviceMap[d.deviceId] = {
        deviceName: d.deviceName,
        location: d.location,
        groupId: primaryGroup?.id || null,
        groupName: primaryGroup?.name || null,
      };
    });

    // Get device IDs to filter orders
    const filteredDeviceIdList = devices.map(d => d.deviceId);

    // Build base where clause for date and device filters
    const baseWhere = {
      payWay: { notIn: ["1000", "Free"] }, // Exclude free orders
      createdAt: {},
    };

    if (dateFrom) {
      baseWhere.createdAt.gte = dateFrom;
    }
    if (dateTo) {
      baseWhere.createdAt.lt = dateTo;
    }

    // If filtering by group, device, or user is franchisee, only include allowed device IDs
    if (selectedGroupIds.length > 0 || selectedDeviceIds.length > 0 || userGroupId) {
      baseWhere.deviceId = { in: filteredDeviceIdList };
    }

    // Query: Get all orders with deliverCount > 0 (includes partial deliveries from failed orders)
    const ordersWithDelivery = await orderTable.findMany({
      where: {
        ...baseWhere,
        deliverCount: { gt: 0 },
      },
      select: {
        deviceId: true,
        amount: true,
        deliverCount: true,
        totalCount: true,
        quantity: true,
        isSuccess: true,
      },
    });

    // Calculate revenue and cups by device
    // Success orders: count full amount
    // Failed orders with delivery: (amount / totalCount) * deliverCount
    const deviceStats = {};
    ordersWithDelivery.forEach(order => {
      const deviceId = order.deviceId;
      if (!deviceStats[deviceId]) {
        deviceStats[deviceId] = { totalSales: 0, totalCups: 0, orderCount: 0 };
      }

      const deliverCount = order.deliverCount ?? 0;
      const totalCount = order.totalCount ?? order.quantity ?? 1;
      const isSuccess = order.isSuccess ?? true;

      if (deliverCount === 0) return;

      let revenue;
      if (isSuccess) {
        // Success: count full amount
        revenue = order.amount || 0;
      } else {
        // Failed but delivered: proportional amount
        revenue = totalCount > 0
          ? Math.round((order.amount || 0) * (deliverCount / totalCount))
          : 0;
      }

      deviceStats[deviceId].totalSales += revenue;
      deviceStats[deviceId].totalCups += deliverCount;
      deviceStats[deviceId].orderCount += 1;
    });

    // Combine with device info - use device name from Device table, not orders
    // For admin/owner users, include ALL devices even with zero sales
    let summary;
    if (isAdmin) {
      // Include all devices from the filtered device list
      summary = devices.map(device => {
        const stats = deviceStats[device.deviceId] || { totalSales: 0, totalCups: 0, orderCount: 0 };
        const primaryGroup = device.groups[0]?.group || null;
        return {
          deviceId: device.deviceId,
          deviceName: device.location || device.deviceName || device.deviceId,
          location: device.location || null,
          groupId: primaryGroup?.id || null,
          groupName: primaryGroup?.name || null,
          totalSales: stats.totalSales,
          totalCups: stats.totalCups,
          orderCount: stats.orderCount,
        };
      });
    } else {
      // Non-admin users only see devices with orders
      summary = Object.entries(deviceStats).map(([deviceId, stats]) => ({
        deviceId,
        deviceName: deviceMap[deviceId]?.location || deviceMap[deviceId]?.deviceName || deviceId,
        location: deviceMap[deviceId]?.location || null,
        groupId: deviceMap[deviceId]?.groupId || null,
        groupName: deviceMap[deviceId]?.groupName || null,
        totalSales: stats.totalSales,
        totalCups: stats.totalCups,
        orderCount: stats.orderCount,
      }));
    }

    // Sort by total sales descending
    summary.sort((a, b) => b.totalSales - a.totalSales);

    // Calculate totals
    const grandTotalSales = summary.reduce((sum, item) => sum + item.totalSales, 0);
    const grandTotalCups = summary.reduce((sum, item) => sum + item.totalCups, 0);
    const grandTotalOrders = summary.reduce((sum, item) => sum + item.orderCount, 0);

    // Get groups for filter dropdown (franchisees only see their own group)
    const groupsWhere = userGroupId ? { id: userGroupId } : {};
    const groups = await db.group.findMany({
      where: groupsWhere,
      orderBy: { name: 'asc' },
    });

    // Get devices for filter dropdown (franchisees only see their own devices) - using many-to-many
    const devicesWhere = userGroupId
      ? { groups: { some: { groupId: userGroupId } } }
      : {};
    const allDevices = await db.device.findMany({
      where: devicesWhere,
      orderBy: { deviceName: 'asc' },
      include: {
        groups: { include: { group: true } }
      },
    });

    // Format devices for response with backward-compatible groupId
    const formattedDevices = allDevices.map(d => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      location: d.location,
      groupId: d.groups[0]?.group?.id || null,
    }));

    return NextResponse.json({
      success: true,
      summary,
      totals: {
        totalSales: grandTotalSales,
        totalCups: grandTotalCups,
        totalOrders: grandTotalOrders,
      },
      filters: {
        groups,
        devices: formattedDevices,
      },
      dateRange: {
        from: dateFrom?.toISOString(),
        to: dateTo?.toISOString(),
        period,
      },
    });
  } catch (error) {
    console.error('Error fetching order summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
