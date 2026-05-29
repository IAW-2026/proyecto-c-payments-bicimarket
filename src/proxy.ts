import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes: API (self-auth), webhooks (MP signature), auth pages, test pages
// The admin layout component handles the admin metadata check separately
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1(.*)",
  "/api/health(.*)",
  "/api-docs(.*)",
  "/webhooks(.*)",
  "/test(.*)",
  "/favicon.ico",
  "/checkout(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
