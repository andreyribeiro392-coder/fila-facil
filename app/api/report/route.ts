import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callRpc, isSameOrigin, SESSION_COOKIE } from "@/lib/supabase-server";

type ReportResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Entre com sua conta." }, { status: 401 });
  const body = (await request.json()) as { slug?: string; type?: string; message?: string };
  if (!body.slug) return NextResponse.json({ ok: false, error: "Barbearia inválida." }, { status: 400 });
  if (!body.message || body.message.trim().length < 10) return NextResponse.json({ ok: false, error: "Explique o problema com pelo menos 10 caracteres." }, { status: 400 });
  try {
    const result = await callRpc<ReportResult>("ff_report_shop", {
      p_token: token,
      p_shop_slug: body.slug,
      p_report_type: body.type || "shop",
      p_message: body.message,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Denúncias serão ativadas após rodar o SQL v6 no Supabase." }, { status: 503 });
  }
}
