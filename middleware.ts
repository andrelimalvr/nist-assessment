import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const FIRST_ACCESS_PATH = "/conta/primeiro-acesso";

function isPublicPath(pathname: string) {
  return pathname === "/login";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (pathname === "/favicon.ico") {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (isPublicPath(pathname) || pathname.startsWith("/api")) {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("x-request-id", requestId);
      return response;
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (token.mustChangePassword && !pathname.startsWith(FIRST_ACCESS_PATH) && !pathname.startsWith("/api")) {
    const response = NextResponse.redirect(new URL(FIRST_ACCESS_PATH, request.url));
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (pathname === "/login") {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
