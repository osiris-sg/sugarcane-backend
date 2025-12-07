import { NextResponse } from 'next/server';

// Configure where your APK is hosted
// Options:
// 1. GitHub Releases: https://github.com/user/repo/releases/download/v1.0.0/app.apk
// 2. Dropbox: https://dl.dropboxusercontent.com/s/xxxxx/app.apk
// 3. Google Drive: https://drive.google.com/uc?export=download&id=FILE_ID
// 4. S3/R2: https://bucket.s3.amazonaws.com/app.apk
// 5. Any direct link to APK file

const APK_URL = process.env.APK_DOWNLOAD_URL || null;

// GET /api/app/download
// Redirects to APK download URL or returns download info
export async function GET(request) {
  // If APK URL is configured, redirect to it
  if (APK_URL) {
    return NextResponse.redirect(APK_URL, { status: 302 });
  }

  // If no APK URL configured, return instructions
  return NextResponse.json({
    error: 'APK not configured',
    message: 'Set APK_DOWNLOAD_URL environment variable to your APK hosting URL',
    instructions: {
      github: 'Upload APK to GitHub Releases and use: https://github.com/user/repo/releases/download/v1.0.0/sugarcane.apk',
      dropbox: 'Upload to Dropbox, get share link, replace www.dropbox.com with dl.dropboxusercontent.com',
      drive: 'Upload to Google Drive, get file ID, use: https://drive.google.com/uc?export=download&id=FILE_ID',
    },
  }, { status: 404 });
}

// POST /api/app/download
// Returns download stats (optional)
export async function POST(request) {
  try {
    const body = await request.json();
    const { deviceId, currentVersion } = body;

    // Log download attempt (you can save this to DB)
    console.log(`Download requested by device ${deviceId}, current version: ${currentVersion}`);

    return NextResponse.json({
      success: true,
      downloadUrl: APK_URL || null,
      message: APK_URL ? 'Download URL available' : 'APK not configured',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
