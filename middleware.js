import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes (dashboard requires authentication)
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

// Define sign-up routes to block
const isSignUpRoute = createRouteMatcher(['/sign-up(.*)']);

// Define change password route
const isChangePasswordRoute = createRouteMatcher(['/change-password(.*)']);

// Define public routes (API endpoints should be accessible)
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/(.*)',
  '/sign-in(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;
  console.log(`[Middleware] Path: ${url}`);
  console.log(`[Middleware] isProtected: ${isProtectedRoute(req)}, isSignUp: ${isSignUpRoute(req)}, isPublic: ${isPublicRoute(req)}`);

  // Block sign-up routes - redirect to sign-in
  if (isSignUpRoute(req)) {
    console.log(`[Middleware] Blocking sign-up, redirecting to sign-in`);
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    console.log(`[Middleware] Protected route, checking auth...`);
    try {
      await auth.protect();
      console.log(`[Middleware] Auth passed`);

      // Check if user needs to change password
      const { userId } = await auth();
      if (userId) {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const requirePasswordChange = user.publicMetadata?.requirePasswordChange;

        console.log(`[Middleware] requirePasswordChange: ${requirePasswordChange}`);

        if (requirePasswordChange === true) {
          console.log(`[Middleware] User must change password, redirecting...`);
          return NextResponse.redirect(new URL('/change-password', req.url));
        }
      }
    } catch (e) {
      console.log(`[Middleware] Auth failed:`, e.message);
      throw e;
    }
  }

  // Protect change-password route (must be logged in)
  if (isChangePasswordRoute(req)) {
    console.log(`[Middleware] Change password route, checking auth...`);
    try {
      await auth.protect();
    } catch (e) {
      console.log(`[Middleware] Auth failed for change-password:`, e.message);
      throw e;
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
