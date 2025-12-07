import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db/index.js';

// Force dynamic rendering (uses request.url)
export const dynamic = 'force-dynamic';

// GET /api/telegram/subscribers?category=STOCK
// Returns list of chat IDs for a category
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.toUpperCase();

    if (!category || (category !== 'STOCK' && category !== 'MAINTENANCE')) {
      return NextResponse.json(
        { error: 'Invalid category. Use STOCK or MAINTENANCE' },
        { status: 400 }
      );
    }

    const subscribers = await db.subscriber.findMany({
      where: {
        categories: {
          has: category,
        },
      },
      select: {
        chatId: true,
        username: true,
        firstName: true,
      },
    });

    return NextResponse.json({
      category,
      count: subscribers.length,
      subscribers: subscribers.map(s => s.chatId),
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
