import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = "fila-facil-app-v5.vercel.app";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const isFilaFacilPreview = host.includes("fila-facil-app-v5") && host.endsWith(".vercel.app") && host !== CANONICAL_HOST;

  if (!isFilaFacilPreview) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = "https";
  url.host = CANONICAL_HOST;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.svg|favicon.ico|robots.txt).*)",
};
