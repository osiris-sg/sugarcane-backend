import { getMenu, swapDeviceId } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { syncTime, machineId, terminalId } = body;

  // Check headers for device ID
  const headerMachineId = request.headers.get('X-Machine-Id') || request.headers.get('machineId');
  const headerTerminalId = request.headers.get('X-Terminal-Id') || request.headers.get('terminalId');

  // Use terminalId, machineId, or header values
  const rawDeviceId = terminalId || machineId || headerTerminalId || headerMachineId;

  // Swap device ID if needed (for mismatched devices 852346/852356)
  const deviceId = rawDeviceId ? swapDeviceId(rawDeviceId) : rawDeviceId;

  const menu = await getMenu(deviceId);
  let menus = [menu];

  if (syncTime) {
    const syncTimestamp = new Date(syncTime).getTime();
    menus = menus.filter(m => m.timestamp > syncTimestamp);
  }

  console.log(`[GetMenus2] Device: ${deviceId || 'default'}, Price: $${(menu.price / 100).toFixed(2)}`);

  return NextResponse.json({ success: true, data: menus });
}
