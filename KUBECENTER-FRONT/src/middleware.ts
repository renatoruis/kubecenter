import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const dest = process.env.INTERNAL_API_URL || "http://localhost:3000";
  const { pathname, search } = request.nextUrl;

  const apiPath = pathname.replace(/^\/api\/?/, "/");
  const target = new URL(`${apiPath}${search}`, dest);

  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/api", "/api/:path*"],
};
