import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// POST /api/push/subscribe - Subscribe to push notifications
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    // Upsert subscription (update if endpoint exists, create if not)
    const subscription = await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        clerkId: userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updatedAt: new Date(),
      },
      create: {
        clerkId: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    console.log(`[Push] Subscription saved for user ${userId}`);

    return NextResponse.json({
      success: true,
      subscription: { id: subscription.id },
    });
  } catch (error) {
    console.error("[Push] Subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}

// GET /api/push/subscribe - Check subscription status
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptions = await db.pushSubscription.findMany({
      where: { clerkId: userId },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      subscribed: subscriptions.length > 0,
      deviceCount: subscriptions.length,
    });
  } catch (error) {
    console.error("[Push] Get subscription error:", error);
    return NextResponse.json(
      { error: "Failed to get subscription status" },
      { status: 500 }
    );
  }
}

// DELETE /api/push/subscribe - Unsubscribe from push notifications
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint required" },
        { status: 400 }
      );
    }

    // Verify the subscription belongs to the user
    const subscription = await db.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (!subscription) {
      return NextResponse.json({ success: true }); // Already deleted
    }

    if (subscription.clerkId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.pushSubscription.delete({
      where: { endpoint },
    });

    console.log(`[Push] Subscription deleted for user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push] Unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
