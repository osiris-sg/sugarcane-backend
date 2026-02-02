import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// FOMO Pay Credentials
const MID = "110000000002801";  // Merchant ID
const TID = "10000001";         // Terminal ID
const KEY_ID = "09bfd5be-9b94-495d-ac89-74f8aee39071";
const API_URL = "https://pos.fomopay.net/rpc";

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
 * Generate a 6-digit STAN
 */
function generateStan() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

/**
 * Generate a 6-digit batch number
 */
function generateBatchNumber() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
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

  console.log(`[FOMOPAY-BATCH] Sending request to ${API_URL}`);
  console.log(`[FOMOPAY-BATCH] Payload: ${JSON.stringify(payloadDict, null, 2)}`);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: headers,
    body: payload
  });

  const responseText = await response.text();
  console.log(`[FOMOPAY-BATCH] Response status: ${response.status}`);
  console.log(`[FOMOPAY-BATCH] Response body: ${responseText}`);

  try {
    return JSON.parse(responseText);
  } catch (e) {
    return null;
  }
}

/**
 * Create Batch Submit (Settlement) Request payload
 * MTI: 0500 - Settlement Request
 */
function createBatchSubmitRequest(batchNumber, transactionCount, totalAmount) {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const transmissionDt = `${month}${day}${hours}${minutes}${seconds}`;
  const localTime = `${hours}${minutes}${seconds}`;
  const localDate = `${month}${day}`;
  const stan = generateStan();
  const batch = batchNumber || generateBatchNumber();

  // Build batch submit message fields
  const fields = {
    "0": "0500",                              // MTI: Settlement/Batch Submit Request
    "3": "920000",                            // Processing Code (settlement)
    "7": transmissionDt,                      // Transmission date & time
    "11": stan,                               // STAN
    "12": localTime,                          // Local time
    "13": localDate,                          // Local date
    "41": TID.padEnd(8, ' '),                 // Terminal ID
    "42": MID.padEnd(15, ' '),                // Merchant ID
    "60": batch                               // Batch number
  };

  // Add optional settlement totals if provided
  if (transactionCount !== undefined) {
    fields["74"] = String(transactionCount).padStart(10, '0');  // Number of credits
  }
  if (totalAmount !== undefined) {
    fields["86"] = String(totalAmount).padStart(16, '0');  // Amount of credits
  }

  // Calculate and add bitmap
  const fieldNumbers = Object.keys(fields).map(k => parseInt(k));
  const bitmap = calculateBitmap(fieldNumbers);
  fields["1"] = bitmap;

  return { fields, stan, batchNumber: batch };
}

/**
 * POST /api/fomopay/batch
 * Submit batch settlement request to FOMO Pay
 *
 * Request: { batchNumber?: string, transactionCount?: number, totalAmount?: number }
 * Response: { success: boolean, responseCode: string, batchNumber: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      batchNumber,       // Optional: specific batch number (auto-generated if not provided)
      transactionCount,  // Optional: number of transactions in batch
      totalAmount        // Optional: total amount in cents
    } = body;

    console.log(`[FOMOPAY-BATCH] Batch Submit Request - Batch: ${batchNumber || 'auto'}, Count: ${transactionCount}, Amount: ${totalAmount}`);

    // Create batch submit request
    const { fields, stan, batchNumber: batch } = createBatchSubmitRequest(
      batchNumber,
      transactionCount,
      totalAmount
    );

    // Send to FOMO Pay
    const response = await sendRequest(fields);

    if (!response) {
      return NextResponse.json({
        success: false,
        error: "Failed to connect to FOMO Pay"
      }, { status: 500 });
    }

    const responseCode = response["39"] || "";

    if (responseCode === "00") {
      console.log(`[FOMOPAY-BATCH] Success! Batch ${batch} submitted.`);

      return NextResponse.json({
        success: true,
        message: "Batch submitted successfully",
        responseCode: responseCode,
        batchNumber: batch,
        stan: stan,
        response: response
      });

    } else {
      let errorMessage = `Response code: ${responseCode}`;

      const errorHex = response["113"];
      if (errorHex) {
        try {
          const errorBuffer = Buffer.from(errorHex, 'hex');
          errorMessage = errorBuffer.toString('utf8');
        } catch (e) {
          errorMessage = `Code: ${responseCode}, Raw: ${errorHex}`;
        }
      }

      console.error(`[FOMOPAY-BATCH] Error: ${errorMessage}`);

      return NextResponse.json({
        success: false,
        error: errorMessage,
        responseCode: responseCode,
        batchNumber: batch
      }, { status: 400 });
    }

  } catch (error) {
    console.error(`[FOMOPAY-BATCH] Exception: ${error.message}`);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/fomopay/batch - Health check
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "FOMO Pay Batch Submit (Settlement)",
    methods: ["POST"],
    usage: {
      request: {
        batchNumber: "string (optional, auto-generated if not provided)",
        transactionCount: "number (optional, number of transactions)",
        totalAmount: "number (optional, total in cents)"
      },
      response: {
        success: "boolean",
        responseCode: "string",
        batchNumber: "string"
      }
    }
  });
}
