import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes (dashboard requires authentication)
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

// Define sign-up routes to block
const isSignUpRoute = createRouteMatcher(['/sign-up(.*)']);

// Define public routes (API endpoints should be accessible)
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/(.*)',
  '/sign-in(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Block sign-up routes - redirect to sign-in
  if (isSignUpRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect();
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
