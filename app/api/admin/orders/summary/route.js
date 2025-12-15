import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/orders/summary - Get order summary by device with filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Filter parameters
    const period = searchParams.get('period') || 'day'; // day, week, month, custom
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupId = searchParams.get('groupId');
    const deviceId = searchParams.get('deviceId');

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

    // Get devices with their groups (for filtering and display)
    const deviceWhere = {};
    if (groupId) {
      deviceWhere.groupId = groupId;
    }
    if (deviceId) {
      deviceWhere.deviceId = deviceId;
    }

    const devices = await db.device.findMany({
      where: deviceWhere,
      include: { group: true },
    });

    // Create a map of deviceId to device info
    const deviceMap = {};
    devices.forEach(d => {
      deviceMap[d.deviceId] = {
        deviceName: d.deviceName,
        location: d.location,
        groupId: d.groupId,
        groupName: d.group?.name || null,
      };
    });

    // Get device IDs to filter orders
    const deviceIds = devices.map(d => d.deviceId);

    // Build order where clause
    const orderWhere = {
      isSuccess: true,
      createdAt: {},
    };

    if (dateFrom) {
      orderWhere.createdAt.gte = dateFrom;
    }
    if (dateTo) {
      orderWhere.createdAt.lt = dateTo;
    }

    // If filtering by group or device, only include those device IDs
    if (groupId || deviceId) {
      orderWhere.deviceId = { in: deviceIds };
    }

    // Aggregate orders by device
    const ordersByDevice = await db.order.groupBy({
      by: ['deviceId', 'deviceName'],
      where: orderWhere,
      _sum: {
        amount: true,
        quantity: true,
      },
      _count: true,
    });

    // Combine with device info
    const summary = ordersByDevice.map(item => ({
      deviceId: item.deviceId,
      deviceName: item.deviceName,
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

    // Get all groups for filter dropdown
    const groups = await db.group.findMany({
      orderBy: { name: 'asc' },
    });

    // Get all devices for filter dropdown
    const allDevices = await db.device.findMany({
      orderBy: { deviceName: 'asc' },
      select: {
        deviceId: true,
        deviceName: true,
        groupId: true,
      },
    });

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
        devices: allDevices,
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
