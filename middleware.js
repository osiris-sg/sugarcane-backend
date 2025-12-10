import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define protected routes (dashboard requires authentication)
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

// Define public routes (API endpoints should be accessible)
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
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
