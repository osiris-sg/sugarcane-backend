import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/orders - List orders with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const payWay = searchParams.get('payWay'); // Filter by payment method (cash, card, etc.)
    const deviceId = searchParams.get('deviceId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // Get current user's role and group
    const { userId } = await auth();
    let userGroupId = null;
    let isAdmin = true;

    if (userId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: userId },
        select: { role: true, groupId: true },
      });

      if (dbUser) {
        // Franchisees can only see their own group's data
        if (dbUser.role === 'FRANCHISEE' && dbUser.groupId) {
          userGroupId = dbUser.groupId;
          isAdmin = false;
        }
      }
    }

    // If franchisee, get device IDs that belong to their group
    let allowedDeviceIds = null;
    if (userGroupId) {
      const groupDevices = await db.device.findMany({
        where: { groupId: userGroupId },
        select: { deviceId: true },
      });
      allowedDeviceIds = groupDevices.map(d => d.deviceId);
    }

    // Build where clause
    const where = {};

    // Filter by success status
    // Franchisees can only see successful orders
    if (!isAdmin) {
      where.isSuccess = true;
    } else {
      // Admins can filter by success status (default: show all)
      const successFilter = searchParams.get('isSuccess');
      if (successFilter === 'true') {
        where.isSuccess = true;
      } else if (successFilter === 'false') {
        where.isSuccess = false;
      }
    }

    if (payWay) {
      where.payWay = payWay;
    }
    if (deviceId) {
      where.deviceId = deviceId;
    }

    // If franchisee, filter by their allowed devices
    if (allowedDeviceIds !== null) {
      if (deviceId) {
        // If specific device requested, make sure it's in their allowed list
        if (!allowedDeviceIds.includes(deviceId)) {
          return NextResponse.json({
            success: true,
            orders: [],
            monthlyTotal: 0,
            monthlyCount: 0,
          });
        }
      } else {
        // Filter to only allowed devices
        where.deviceId = { in: allowedDeviceIds };
      }
    }

    // Add date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Add search filter (searches orderId, deviceId, deviceName)
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        { deviceId: { contains: search, mode: 'insensitive' } },
        { deviceName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const totalCount = await db.order.count({ where });

    // Fetch orders with pagination
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get unique device IDs to fetch their groups
    const deviceIds = [...new Set(orders.map(o => o.deviceId))];

    // Fetch devices with their groups
    const devices = await db.device.findMany({
      where: { deviceId: { in: deviceIds } },
      include: { group: true },
    });

    // Create a map for quick lookup
    const deviceMap = {};
    devices.forEach(d => {
      deviceMap[d.deviceId] = {
        groupId: d.groupId,
        groupName: d.group?.name || null,
      };
    });

    // Enrich orders with group info
    const enrichedOrders = orders.map(order => ({
      ...order,
      groupId: deviceMap[order.deviceId]?.groupId || null,
      groupName: deviceMap[order.deviceId]?.groupName || null,
    }));

    // Calculate summary stats for the current month (excluding free orders)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build base where clause for stats (respects device filtering for franchisees)
    const baseStatsWhere = {};
    if (allowedDeviceIds !== null) {
      baseStatsWhere.deviceId = { in: allowedDeviceIds };
    }

    // Filtered stats - stats for current filter criteria (successful, non-free orders)
    // Build filtered where clause excluding free orders and only successful
    const filteredStatsWhere = {
      ...where,
      isSuccess: true,
      payWay: { not: "1000" },
    };
    // If where already has isSuccess: true, that's fine (it will be overwritten with same value)
    // If admin is viewing failed orders, we still want filtered stats for successful ones in that filter

    const filteredStats = await db.order.aggregate({
      where: filteredStatsWhere,
      _sum: { amount: true },
      _count: true,
    });

    // All-time stats (successful, non-free orders)
    const allTimeStats = await db.order.aggregate({
      where: {
        ...baseStatsWhere,
        isSuccess: true,
        payWay: { not: "1000" },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Monthly stats (successful, non-free orders)
    const monthlyStats = await db.order.aggregate({
      where: {
        ...baseStatsWhere,
        isSuccess: true,
        createdAt: { gte: startOfMonth },
        payWay: { not: "1000" },
      },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filteredTotal: filteredStats._sum.amount || 0,
      filteredCount: filteredStats._count || 0,
      allTimeTotal: allTimeStats._sum.amount || 0,
      allTimeCount: allTimeStats._count || 0,
      monthlyTotal: monthlyStats._sum.amount || 0,
      monthlyCount: monthlyStats._count || 0,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
