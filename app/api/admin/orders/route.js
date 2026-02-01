import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

// Toggle between Order and OrderImport table
// Set to true to use imported CSV data, false to use original Order table
const USE_IMPORT_TABLE = true;
const orderTable = USE_IMPORT_TABLE ? db.orderImport : db.order;

// GET /api/admin/orders - List orders with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const payWay = searchParams.get('payWay'); // Filter by payment method (cash, card, etc.)
    const deviceId = searchParams.get('deviceId');
    const groupId = searchParams.get('groupId'); // Filter by group (admin only)
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
        // Admin-level roles can see all data and filter by group
        const adminRoles = ['ADMIN', 'ADMINOPS', 'FINANCE', 'MANAGER'];
        if (adminRoles.includes(dbUser.role)) {
          isAdmin = true;
        } else if ((dbUser.role === 'FRANCHISEE' || dbUser.role === 'PARTNERSHIPS') && dbUser.groupId) {
          // Franchisees and Partnerships users can only see their own group's data
          userGroupId = dbUser.groupId;
          isAdmin = false;
        }
      }
    }

    // If franchisee or partnerships user, get device IDs that belong to their group (many-to-many)
    let allowedDeviceIds = null;
    if (userGroupId) {
      const groupDevices = await db.device.findMany({
        where: {
          groups: { some: { groupId: userGroupId } }
        },
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

    // If restricted user (franchisee/partnerships), filter by their allowed devices
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

    // Admin can filter by group
    if (isAdmin && groupId) {
      const groupDevices = await db.device.findMany({
        where: {
          groups: { some: { groupId: groupId } }
        },
        select: { deviceId: true },
      });
      const groupDeviceIds = groupDevices.map(d => d.deviceId);

      if (deviceId) {
        // If specific device also requested, make sure it's in the group
        if (!groupDeviceIds.includes(deviceId)) {
          return NextResponse.json({
            success: true,
            orders: [],
            monthlyTotal: 0,
            monthlyCount: 0,
            isAdmin,
          });
        }
      } else {
        // Filter to only devices in the selected group
        where.deviceId = { in: groupDeviceIds };
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
    const totalCount = await orderTable.count({ where });

    // Fetch orders with pagination
    const orders = await orderTable.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get unique device IDs to fetch their groups
    const deviceIds = [...new Set(orders.map(o => o.deviceId))];

    // Fetch devices with their groups (many-to-many)
    const devices = await db.device.findMany({
      where: { deviceId: { in: deviceIds } },
      include: {
        groups: { include: { group: true } }
      },
    });

    // Create a map for quick lookup (use first group for backward compatibility)
    const deviceMap = {};
    devices.forEach(d => {
      const primaryGroup = d.groups[0]?.group || null;
      deviceMap[d.deviceId] = {
        location: d.location,
        deviceName: d.deviceName,
        groupId: primaryGroup?.id || null,
        groupName: primaryGroup?.name || null,
      };
    });

    // Enrich orders with group info and location from Device table
    const enrichedOrders = orders.map(order => ({
      ...order,
      deviceName: deviceMap[order.deviceId]?.location || deviceMap[order.deviceId]?.deviceName || order.deviceName,
      groupId: deviceMap[order.deviceId]?.groupId || null,
      groupName: deviceMap[order.deviceId]?.groupName || null,
    }));

    // Calculate summary stats for the current month (excluding free orders)
    // Use SGT timezone (UTC+8) for month calculation
    const now = new Date();
    const sgtNow = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Convert to SGT
    const sgtYear = sgtNow.getUTCFullYear();
    const sgtMonth = sgtNow.getUTCMonth();
    // Start of month in SGT, then convert back to UTC for DB query
    const startOfMonthSGT = new Date(Date.UTC(sgtYear, sgtMonth, 1) - (8 * 60 * 60 * 1000));

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
      payWay: { notIn: ["1000", "Free"] },
    };
    // If where already has isSuccess: true, that's fine (it will be overwritten with same value)
    // If admin is viewing failed orders, we still want filtered stats for successful ones in that filter

    const filteredStats = await orderTable.aggregate({
      where: filteredStatsWhere,
      _sum: { amount: true },
      _count: true,
    });

    // All-time stats (successful, non-free orders)
    const allTimeStats = await orderTable.aggregate({
      where: {
        ...baseStatsWhere,
        isSuccess: true,
        payWay: { notIn: ["1000", "Free"] },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Monthly stats (successful, non-free orders)
    const monthlyStats = await orderTable.aggregate({
      where: {
        ...baseStatsWhere,
        isSuccess: true,
        createdAt: { gte: startOfMonthSGT },
        payWay: { notIn: ["1000", "Free"] },
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
      isAdmin,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
