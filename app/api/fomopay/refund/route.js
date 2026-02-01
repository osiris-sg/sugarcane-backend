import { NextResponse } from 'next/server';

// In-memory storage for refund requests (in production, use a database)
// These requests need to be processed manually via FOMO Pay merchant portal
// NOTE: FOMO Pay API currently only supports refunds via merchant portal, not direct API calls
let refundRequests = [];

/**
 * POST /api/fomopay/refund
 * Log a refund request for manual processing via FOMO Pay merchant portal
 *
 * IMPORTANT: FOMO Pay does not support direct API refunds.
 * This endpoint logs the request for manual processing.
 *
 * Request: { stan: string, amount?: number, reason?: string }
 * Response: { success: boolean, requestId: string, message: string }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      stan,           // Transaction STAN from original payment
      reference,      // Optional: Retrieval reference number (field 37)
      amount,         // Optional: refund amount in cents
      reason          // Optional: refund reason
    } = body;

    console.log('[FOMOPAY-REFUND] Request:', { stan, reference, amount, reason });

    if (!stan) {
      return NextResponse.json({
        success: false,
        error: 'Missing stan (System Trace Audit Number)'
      }, { status: 400 });
    }

    // Generate a unique request ID
    const requestId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create refund request record
    const refundRequest = {
      requestId,
      stan,
      reference: reference || null,
      amount: amount || null,  // null means full refund
      reason: reason || 'Make failed - auto refund',
      status: 'pending_manual_processing',
      createdAt: timestamp,
      processedAt: null,
      notes: 'FOMO Pay refunds must be processed manually via merchant portal at https://merchant.fomopay.com'
    };

    // Store the request (in production, save to database)
    refundRequests.push(refundRequest);

    // Keep only last 100 requests in memory
    if (refundRequests.length > 100) {
      refundRequests = refundRequests.slice(-100);
    }

    console.log('[FOMOPAY-REFUND] Logged refund request:', requestId);
    console.log('[FOMOPAY-REFUND] NOTE: Must be processed manually via FOMO Pay merchant portal');

    return NextResponse.json({
      success: true,
      data: {
        requestId,
        stan,
        status: 'pending_manual_processing',
        message: 'Refund request logged. FOMO Pay refunds must be processed manually via the merchant portal.',
        merchantPortalUrl: 'https://merchant.fomopay.com'
      }
    });

  } catch (error) {
    console.error('[FOMOPAY-REFUND] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to log refund request'
    }, { status: 500 });
  }
}

/**
 * GET /api/fomopay/refund
 * Get pending refund requests that need manual processing
 *
 * Query: ?adminKey=sugarcane123
 * Response: { success: boolean, requests: Array }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('adminKey');

    // Simple auth check
    if (adminKey !== 'sugarcane123') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - provide adminKey parameter'
      }, { status: 401 });
    }

    // Return pending refund requests
    const pendingRequests = refundRequests.filter(r => r.status === 'pending_manual_processing');

    return NextResponse.json({
      success: true,
      message: 'FOMO Pay refunds must be processed manually via merchant portal',
      merchantPortalUrl: 'https://merchant.fomopay.com',
      pendingCount: pendingRequests.length,
      requests: pendingRequests
    });

  } catch (error) {
    console.error('[FOMOPAY-REFUND] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PATCH /api/fomopay/refund
 * Mark a refund request as processed (after manual processing in merchant portal)
 *
 * Request: { requestId: string, adminKey: string }
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { requestId, adminKey } = body;

    if (adminKey !== 'sugarcane123') {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    if (!requestId) {
      return NextResponse.json({
        success: false,
        error: 'Missing requestId'
      }, { status: 400 });
    }

    // Find and update the request
    const request_idx = refundRequests.findIndex(r => r.requestId === requestId);
    if (request_idx === -1) {
      return NextResponse.json({
        success: false,
        error: 'Refund request not found'
      }, { status: 404 });
    }

    refundRequests[request_idx].status = 'processed';
    refundRequests[request_idx].processedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: 'Refund request marked as processed',
      data: refundRequests[request_idx]
    });

  } catch (error) {
    console.error('[FOMOPAY-REFUND] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
