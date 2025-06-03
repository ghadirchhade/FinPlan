import { clerkMiddleware,createRouteMatcher} from "@clerk/nextjs/server";

//Any request matching these patterns will be considered protected(they require authentication)
//define a list of route patterns you want to protect
const isProtectedRoute=createRouteMatcher([
  "/dashboard(.*)",//anything that comes after this path
  "/account(.*)",
  "/transaction(.*)",
]);


// tells Next.js to use Clerk's middleware for every incoming request that matches the route patterns you define in matcher.(intercept any incoming req that matches the matcher routes)
//So any route matching the specified pattern will pass through Clerk's auth checks before rendering
//the middleware function is async because it uses asynchronous operations like auth() and redirectToSignIn() they takes time to talking with the server and check's the user's login status
//use await to pause until that check is done
export default clerkMiddleware(async(auth,req)=>{
  const {userId}=await auth();

  if(!userId && isProtectedRoute(req)){
    const {redirectToSignIn}=await auth();
    return redirectToSignIn();
  }
});


//The matcher tells Next.js:Only run this middleware on requests matching these paths
export const config = {
  matcher: [
    // Skip Next.js internals and all static files(like .css,.html,.js,etc) using a negative lookahead: ?! =>bcz these files don't want authentication
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // matches all routes starting with /api or /trpc routes,it ensures backend routes are always protected before access them
    '/(api|trpc)(.*)',
  ],
};

/*1. User visits /dashboard
2. Middleware runs first: (bcz /dashboard matches the matcher)
   → "Is user logged in?"
   → YES → continue
   → NO → redirect to /sign-in
3. If passed, /dashboard page is rendered*/