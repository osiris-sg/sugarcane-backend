import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

// FOMO Pay Credentials
const MID = "110000000002801";  // Merchant ID
const DEFAULT_TID = "10000001"; // Default Terminal ID (fallback)
const KEY_ID = "09bfd5be-9b94-495d-ac89-74f8aee39071";
const API_URL = "https://pos.fomopay.net/rpc";

async function resolveTid(deviceId) {
  if (!deviceId) return DEFAULT_TID;
  try {
    const device = await db.device.findUnique({
      where: { deviceId: String(deviceId) },
      select: { fomoTid: true },
    });
    const tid = device?.fomoTid || DEFAULT_TID;
    console.log(`[FOMOPAY-STATUS] Device ${deviceId} → TID: ${tid}`);
    return tid;
  } catch (e) {
    console.error(`[FOMOPAY-STATUS] Error looking up device ${deviceId}:`, e.message);
    return DEFAULT_TID;
  }
}

/**
 * Load RSA private key from environment variable
 */
function loadPrivateKey() {
  if (process.env.FOMOPAY_PRIVATE_KEY) {
    return process.env.FOMOPAY_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  try {
    const keyPath = path.join(process.cwd(), 'keys', 'posvendor.key.pem');
    return fs.readFileSync(keyPath, 'utf8');
  } catch (e) {
    throw new Error('FOMOPAY_PRIVATE_KEY environment variable not set');
  }
}

/**
 * Calculate bitmap for ISO 8583 message
 */
function calculateBitmap(fieldNumbers) {
  let primary = BigInt(0);
  let secondary = BigInt(0);
  let needSecondary = false;

  for (const field of fieldNumbers) {
    if (field === 0 || field === 1) continue;

    if (field <= 64) {
      primary |= BigInt(1) << BigInt(64 - field);
    } else {
      needSecondary = true;
      secondary |= BigInt(1) << BigInt(128 - field);
    }
  }

  if (needSecondary) {
    primary |= BigInt(1) << BigInt(63);
    return primary.toString(16).padStart(16, '0') + secondary.toString(16).padStart(16, '0');
  }

  return primary.toString(16).padStart(16, '0');
}

/**
 * Sign request using SHA256WithRSA
 */
function signRequest(payload, timestamp, nonce, privateKeyPem) {
  const dataToSign = `${payload}${timestamp}${nonce}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(dataToSign);
  sign.end();

  const signature = sign.sign(privateKeyPem);
  return signature.toString('hex').toLowerCase();
}

/**
 * Create Query Request payload
 */
function createQueryRequest(stan, TID = DEFAULT_TID) {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const transmissionDt = `${month}${day}${hours}${minutes}${seconds}`;

  // Build query message fields
  const fields = {
    "0": "0100",                    // MTI: Query Request
    "3": "300000",                  // Processing Code (query)
    "7": transmissionDt,            // Transmission date & time
    "11": stan,                     // Original STAN
    "41": TID.padEnd(8, ' '),       // Terminal ID
    "42": MID.padEnd(15, ' ')       // Merchant ID
  };

  // Calculate and add bitmap
  const fieldNumbers = Object.keys(fields).map(k => parseInt(k));
  const bitmap = calculateBitmap(fieldNumbers);
  fields["1"] = bitmap;

  return fields;
}

/**
 * Send signed request to FOMO Pay API
 */
async function sendRequest(payloadDict) {
  const privateKeyPem = loadPrivateKey();

  const payload = JSON.stringify(payloadDict);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = signRequest(payload, timestamp, nonce, privateKeyPem);

  const headers = {
    "Content-Type": "application/json",
    "X-Authentication-Version": "1.1",
    "X-Authentication-Method": "SHA256WithRSA",
    "X-Authentication-KeyId": KEY_ID,
    "X-Authentication-Nonce": nonce,
    "X-Authentication-Timestamp": timestamp,
    "X-Authentication-Sign": signature
  };

  console.log(`[FOMOPAY-STATUS] Querying transaction: ${payloadDict["11"]}`);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: headers,
    body: payload
  });

  const responseText = await response.text();
  console.log(`[FOMOPAY-STATUS] Response: ${responseText}`);

  try {
    return JSON.parse(responseText);
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/fomopay/status
 * Query transaction status
 *
 * Request: { stan: string }
 * Response: { success: boolean, status: string, paid?: boolean }
 */
export async function POST(request) {
  try {
    const { stan, deviceId } = await request.json();

    if (!stan) {
      return NextResponse.json({
        success: false,
        error: "STAN required"
      }, { status: 400 });
    }

    // Resolve TID from device lookup
    const TID = await resolveTid(deviceId);

    // Create query request
    const fields = createQueryRequest(stan, TID);

    // Send to FOMO Pay
    const response = await sendRequest(fields);

    if (!response) {
      return NextResponse.json({
        success: false,
        error: "Failed to query FOMO Pay"
      }, { status: 500 });
    }

    const responseCode = response["39"] || "";

    if (responseCode === "00") {
      return NextResponse.json({
        success: true,
        status: "completed",
        paid: true,
        reference: response["37"] || stan
      });

    } else if (responseCode === "09") {
      return NextResponse.json({
        success: true,
        status: "pending",
        paid: false
      });

    } else {
      return NextResponse.json({
        success: true,
        status: "failed",
        paid: false,
        responseCode: responseCode
      });
    }

  } catch (error) {
    console.error(`[FOMOPAY-STATUS] Error: ${error.message}`);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
