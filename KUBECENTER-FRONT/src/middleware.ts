import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const dest = process.env.INTERNAL_API_URL || "http://localhost:3000";
  const { pathname, search } = request.nextUrl;

  const apiPath = pathname.replace(/^\/api\/?/, "/");
  const target = new URL(`${apiPath}${search}`, dest);

  // #region agent log
  console.log(`[DBG71a9c3] middleware rewrite: ${pathname} → ${target.toString()} (INTERNAL_API_URL=${dest})`);
  // #endregion

  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/api", "/api/:path*"],
};
