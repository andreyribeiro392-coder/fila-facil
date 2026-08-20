import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "Fila Fácil",
    version: "0.2.0",
    status: "public-release-ready",
    officialUrl: "https://fila-facil-app-v5.vercel.app",
    time: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
