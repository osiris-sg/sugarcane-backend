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
    let groupId = searchParams.get('groupId');
    const deviceId = searchParams.get('deviceId');

    // Get current user's role and group for access control
    const { userId } = await auth();
    let userGroupId = null;

    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: { role: true, groupId: true },
      });

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
        // Dates are expected as ISO strings with timezone already applied
        // End date is exclusive (like old platform)
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

    // Get devices with their groups (for filtering and display) - using many-to-many
    const deviceWhere = {};
    if (groupId) {
      deviceWhere.groups = { some: { groupId: groupId } };
    }
    if (deviceId) {
      deviceWhere.deviceId = deviceId;
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
    const deviceIds = devices.map(d => d.deviceId);

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
    if (groupId || deviceId || userGroupId) {
      baseWhere.deviceId = { in: deviceIds };
    }

    // Query 1: Sales and order count (success orders only)
    const salesByDevice = await orderTable.groupBy({
      by: ['deviceId'],
      where: { ...baseWhere, isSuccess: true },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Query 2: Cups count (ALL orders that delivered, including failed)
    const cupsByDevice = await orderTable.groupBy({
      by: ['deviceId'],
      where: baseWhere,
      _sum: {
        deliverCount: true,
      },
    });

    // Create cups lookup
    const cupsMap = {};
    cupsByDevice.forEach(item => {
      cupsMap[item.deviceId] = item._sum.deliverCount || 0;
    });

    // Combine with device info - use device name from Device table, not orders
    const summary = salesByDevice.map(item => ({
      deviceId: item.deviceId,
      deviceName: deviceMap[item.deviceId]?.location || deviceMap[item.deviceId]?.deviceName || item.deviceId,
      location: deviceMap[item.deviceId]?.location || null,
      groupId: deviceMap[item.deviceId]?.groupId || null,
      groupName: deviceMap[item.deviceId]?.groupName || null,
      totalSales: item._sum.amount || 0,
      totalCups: cupsMap[item.deviceId] || 0,
      orderCount: item._count,
    }));

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
