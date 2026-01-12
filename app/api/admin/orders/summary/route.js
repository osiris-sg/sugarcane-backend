import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

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
    const now = new Date();
    let dateFrom, dateTo;

    switch (period) {
      case 'day':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        dateFrom = startOfWeek;
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'custom':
        if (startDate) {
          dateFrom = new Date(startDate);
          dateFrom.setHours(0, 0, 0, 0);
        }
        if (endDate) {
          dateTo = new Date(endDate);
          dateTo.setHours(23, 59, 59, 999);
        }
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
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

    // Build order where clause
    const orderWhere = {
      isSuccess: true,
      payWay: { not: "1000" }, // Exclude free orders
      createdAt: {},
    };

    if (dateFrom) {
      orderWhere.createdAt.gte = dateFrom;
    }
    if (dateTo) {
      orderWhere.createdAt.lt = dateTo;
    }

    // If filtering by group, device, or user is franchisee, only include allowed device IDs
    if (groupId || deviceId || userGroupId) {
      orderWhere.deviceId = { in: deviceIds };
    }

    // Aggregate orders by deviceId only (not deviceName, as orders may have inconsistent names)
    const ordersByDevice = await db.order.groupBy({
      by: ['deviceId'],
      where: orderWhere,
      _sum: {
        amount: true,
        quantity: true,
      },
      _count: true,
    });

    // Combine with device info - use device name from Device table, not orders
    const summary = ordersByDevice.map(item => ({
      deviceId: item.deviceId,
      deviceName: deviceMap[item.deviceId]?.location || deviceMap[item.deviceId]?.deviceName || item.deviceId,
      location: deviceMap[item.deviceId]?.location || null,
      groupId: deviceMap[item.deviceId]?.groupId || null,
      groupName: deviceMap[item.deviceId]?.groupName || null,
      totalSales: item._sum.amount || 0,
      totalCups: item._sum.quantity || 0,
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
