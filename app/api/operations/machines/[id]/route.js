import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// GET - Fetch device and stock settings
export async function GET(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch device by id (cuid)
    const device = await db.device.findUnique({
      where: { id },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      );
    }

    // Fetch stock for this device
    const stock = await db.stock.findUnique({
      where: { deviceId: device.deviceId },
    });

    return NextResponse.json({
      success: true,
      device,
      stock,
    });
  } catch (error) {
    console.error("Error fetching machine:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch machine" },
      { status: 500 }
    );
  }
}

// PATCH - Update stock settings
export async function PATCH(request, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await currentUser();
    const role = user?.publicMetadata?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Only admins can modify settings" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { minStockThreshold, maxStock } = body;

    // Validate inputs
    if (minStockThreshold !== undefined && (minStockThreshold < 0 || isNaN(minStockThreshold))) {
      return NextResponse.json(
        { success: false, error: "Invalid minStockThreshold" },
        { status: 400 }
      );
    }

    if (maxStock !== undefined && (maxStock < 1 || isNaN(maxStock))) {
      return NextResponse.json(
        { success: false, error: "Invalid maxStock" },
        { status: 400 }
      );
    }

    // Fetch device by id (cuid)
    const device = await db.device.findUnique({
      where: { id },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      );
    }

    // Update or create stock record
    const updateData = {};
    if (minStockThreshold !== undefined) {
      updateData.minStockThreshold = parseInt(minStockThreshold, 10);
    }
    if (maxStock !== undefined) {
      updateData.maxStock = parseInt(maxStock, 10);
    }

    const stock = await db.stock.upsert({
      where: { deviceId: device.deviceId },
      update: updateData,
      create: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        quantity: 0,
        minStockThreshold: minStockThreshold !== undefined ? parseInt(minStockThreshold, 10) : 20,
        maxStock: maxStock !== undefined ? parseInt(maxStock, 10) : 80,
      },
    });

    return NextResponse.json({
      success: true,
      stock,
    });
  } catch (error) {
    console.error("Error updating machine settings:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
