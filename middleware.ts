import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appPath } from "./lib/base-path";

const PUBLIC = [/^\/login$/, /^\/register$/, /^\/api\/auth\//];

function publicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim() || "";
  const localHost = !host || host.startsWith("127.0.0.1") || host.startsWith("localhost");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (request.nextUrl.protocol === "https:" ? "https" : "http");

  if (host && !localHost) {
    return `${proto}://${host}`;
  }

  const configured = process.env.TOEFL_PUBLIC_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured.replace(/\/toefl\/?$/, "").replace(/\/$/, "");
    }
  }

  return "";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  const token = request.cookies.get("toefl_auth")?.value;
  if (token) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const next = pathname + request.nextUrl.search;
  const origin = publicOrigin(request);
  const location = `${origin}${appPath("/login")}?next=${encodeURIComponent(next)}`;
  return new NextResponse(null, {
    status: 307,
    headers: { Location: location },
  });
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
