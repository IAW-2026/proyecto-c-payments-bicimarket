import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// API v1 routes handle their own auth (X-Service-Token for server-to-server,
// Clerk JWT admin check for admin endpoints). The Clerk middleware only
// protects page routes - API routes authenticate internally.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1(.*)",
  "/api/health(.*)",
  "/api-docs(.*)",
  "/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

// Admin pages are protected by the layout component's requireAdmin()
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
