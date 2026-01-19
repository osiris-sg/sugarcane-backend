import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// FOMO Pay Credentials
const MID = "110000000002801";  // Merchant ID
const TID = "10000001";         // Terminal ID
const KEY_ID = "09bfd5be-9b94-495d-ac89-74f8aee39071";
const API_URL = "https://pos.fomopay.net/rpc";

// Condition codes for payment methods
const CONDITION_CODES = {
  PAYNOW: "82",
  ALIPAY: "30",
  WECHATPAY: "20",
  GRABPAY: "50"
};

/**
 * Load RSA private key from environment variable
 */
function loadPrivateKey() {
  // First try environment variable (for Vercel deployment)
  if (process.env.FOMOPAY_PRIVATE_KEY) {
    // Replace escaped newlines with actual newlines
    return process.env.FOMOPAY_PRIVATE_KEY.replace(/\\n/g, '\n');
  }

  // Fallback to file for local development
  try {
    const keyPath = path.join(process.cwd(), 'keys', 'posvendor.key.pem');
    return fs.readFileSync(keyPath, 'utf8');
  } catch (e) {
    throw new Error('FOMOPAY_PRIVATE_KEY environment variable not set and key file not found');
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
    primary |= BigInt(1) << BigInt(63); // Set bit 1 for secondary bitmap
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
 * Create Sale Request payload for PayNow
 */
function createSaleRequest(amountCents, paymentMethod = "PAYNOW", description = "Sugarcane Juice") {
  const now = new Date();

  // Generate STAN (System Trace Audit Number) - 6 digits
  const stan = String(Date.now() % 1000000).padStart(6, '0');

  // Format timestamps
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const transmissionDt = `${month}${day}${hours}${minutes}${seconds}`;
  const localTime = `${hours}${minutes}${seconds}`;
  const localDate = `${month}${day}`;

  const conditionCode = CONDITION_CODES[paymentMethod] || "82";

  // Build message fields
  const fields = {
    "0": "0200",                                    // MTI: Sale Request
    "3": "000000",                                  // Processing Code
    "7": transmissionDt,                            // Transmission date & time
    "11": stan,                                     // STAN
    "12": localTime,                                // Local transaction time
    "13": localDate,                                // Local transaction date
    "18": "5814",                                   // MCC (5814 = Fast Food)
    "25": conditionCode,                            // Condition code (PayNow = 82)
    "41": TID.padEnd(8, ' '),                       // Terminal ID
    "42": MID.padEnd(15, ' '),                      // Merchant ID
    "49": "SGD",                                    // Currency
    "88": String(amountCents).padStart(12, '0'),    // Amount (12 digits)
    "104": description                              // Description
  };

  // Calculate and add bitmap
  const fieldNumbers = Object.keys(fields).map(k => parseInt(k));
  const bitmap = calculateBitmap(fieldNumbers);
  fields["1"] = bitmap;

  return { fields, stan };
}

/**
 * Send signed request to FOMO Pay API
 */
async function sendRequest(payloadDict) {
  const privateKeyPem = loadPrivateKey();

  // Serialize payload
  const payload = JSON.stringify(payloadDict);

  // Generate timestamp and nonce
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');

  // Sign the request
  const signature = signRequest(payload, timestamp, nonce, privateKeyPem);

  // Prepare headers
  const headers = {
    "Content-Type": "application/json",
    "X-Authentication-Version": "1.1",
    "X-Authentication-Method": "SHA256WithRSA",
    "X-Authentication-KeyId": KEY_ID,
    "X-Authentication-Nonce": nonce,
    "X-Authentication-Timestamp": timestamp,
    "X-Authentication-Sign": signature
  };

  console.log(`[FOMOPAY] Sending request to ${API_URL}`);
  console.log(`[FOMOPAY] Payload: ${JSON.stringify(payloadDict, null, 2)}`);

  // Send request
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: headers,
    body: payload
  });

  const responseText = await response.text();
  console.log(`[FOMOPAY] Response status: ${response.status}`);
  console.log(`[FOMOPAY] Response body: ${responseText}`);

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error(`[FOMOPAY] Failed to parse response: ${e.message}`);
    return null;
  }
}

/**
 * POST /api/fomopay/qr
 * Generate PayNow QR code via FOMO Pay API
 *
 * Request: { amount: number } (in cents)
 * Response: { success: boolean, qrCode?: string, reference?: string, error?: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    // Accept both 'paymentMethod' and 'scheme' (app sends 'scheme')
    const { amount, paymentMethod, scheme, description = "Sugarcane Juice" } = body;
    const method = paymentMethod || scheme || "PAYNOW";

    console.log(`[FOMOPAY] QR Request - Amount: ${amount} cents, Method: ${method}`);

    if (!amount || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: "Invalid amount"
      }, { status: 400 });
    }

    // Create sale request
    const { fields, stan } = createSaleRequest(amount, method, description);

    // Send to FOMO Pay
    const response = await sendRequest(fields);

    if (!response) {
      return NextResponse.json({
        success: false,
        error: "Failed to connect to FOMO Pay"
      }, { status: 500 });
    }

    // Check response code (field 39)
    const responseCode = response["39"] || "";

    if (responseCode === "00") {
      // Success - QR code in field 63
      const qrCode = response["63"] || "";
      const reference = response["37"] || stan;

      console.log(`[FOMOPAY] Success! QR Code: ${qrCode.substring(0, 50)}...`);

      return NextResponse.json({
        success: true,
        qrCode: qrCode,
        reference: reference,
        stan: stan
      });

    } else if (responseCode === "09") {
      // Transaction in progress - still return QR code if available
      const qrCode = response["63"] || "";
      const reference = response["37"] || stan;

      console.log(`[FOMOPAY] In progress - QR Code: ${qrCode.substring(0, 50)}...`);

      return NextResponse.json({
        success: true,
        qrCode: qrCode,
        reference: reference,
        stan: stan,
        status: "pending"
      });

    } else {
      // Error
      let errorMessage = `Response code: ${responseCode}`;

      // Try to decode error message from field 113 (hex encoded)
      const errorHex = response["113"];
      if (errorHex) {
        try {
          const errorBuffer = Buffer.from(errorHex, 'hex');
          errorMessage = errorBuffer.toString('utf8');
        } catch (e) {
          errorMessage = `Code: ${responseCode}, Raw: ${errorHex}`;
        }
      }

      console.error(`[FOMOPAY] Error: ${errorMessage}`);

      return NextResponse.json({
        success: false,
        error: errorMessage,
        responseCode: responseCode
      }, { status: 400 });
    }

  } catch (error) {
    console.error(`[FOMOPAY] Exception: ${error.message}`);
    console.error(error.stack);

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/fomopay/qr - Health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "FOMO Pay QR Generator",
    methods: ["POST"],
    usage: {
      request: { amount: "number (cents)", scheme: "PAYNOW|ALIPAY|WECHATPAY|GRABPAY (optional, also accepts 'paymentMethod')" },
      response: { success: "boolean", qrCode: "string", reference: "string" }
    }
  });
}
