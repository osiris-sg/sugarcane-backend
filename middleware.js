import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes (dashboard requires authentication)
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

// Define sign-up routes to block
const isSignUpRoute = createRouteMatcher(['/sign-up(.*)']);

// Define change password route
const isChangePasswordRoute = createRouteMatcher(['/change-password(.*)']);

// Define sign-in route
const isSignInRoute = createRouteMatcher(['/sign-in(.*)']);

// Define sales base route (exact match for /dashboard/sales)
const isSalesBaseRoute = createRouteMatcher(['/dashboard/sales']);

// Define public routes (API endpoints should be accessible)
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/(.*)',
  '/sign-in(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;

  // Block sign-up routes - redirect to sign-in
  if (isSignUpRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Redirect authenticated users away from sign-in page
  if (isSignInRoute(req)) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    try {
      await auth.protect();

      // Check if user needs to change password
      const { userId } = await auth();
      if (userId) {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const requirePasswordChange = user.publicMetadata?.requirePasswordChange;

        // Handle both boolean true and string "true"
        if (requirePasswordChange === true || requirePasswordChange === "true") {
          return NextResponse.redirect(new URL('/change-password', req.url));
        }

        // Redirect from /dashboard/sales base path to appropriate default page
        if (isSalesBaseRoute(req)) {
          const role = user.publicMetadata?.role?.toLowerCase();
          if (role === 'owner' || role === 'admin') {
            // Admin/owner go to order summary
            return NextResponse.redirect(new URL('/dashboard/sales/orders/summary', req.url));
          } else {
            // Other roles go to order list
            return NextResponse.redirect(new URL('/dashboard/sales/orders/list', req.url));
          }
        }
      }
    } catch (e) {
      throw e;
    }
  }

  // Protect change-password route (must be logged in)
  if (isChangePasswordRoute(req)) {
    try {
      await auth.protect();
    } catch (e) {
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
