import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/orders - List orders with optional filters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const payWay = searchParams.get('payWay'); // Filter by payment method (cash, card, etc.)
    const deviceId = searchParams.get('deviceId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build where clause
    const where = { isSuccess: true };
    if (payWay) {
      where.payWay = payWay;
    }
    if (deviceId) {
      where.deviceId = deviceId;
    }

    // Fetch orders
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
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

    // Calculate summary stats for the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyStats = await db.order.aggregate({
      where: {
        ...where,
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      monthlyTotal: monthlyStats._sum.amount || 0,
      monthlyCount: monthlyStats._count || 0,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
