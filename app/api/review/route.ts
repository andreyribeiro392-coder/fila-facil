import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callRpc, isSameOrigin, SESSION_COOKIE } from "@/lib/supabase-server";

type ReviewResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Entre com sua conta de cliente." }, { status: 401 });
  const body = (await request.json()) as { slug?: string; rating?: number; comment?: string };
  if (!body.slug) return NextResponse.json({ ok: false, error: "Barbearia inválida." }, { status: 400 });
  if (!Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5) {
    return NextResponse.json({ ok: false, error: "Escolha uma nota de 1 a 5." }, { status: 400 });
  }
  try {
    const result = await callRpc<ReviewResult>("ff_review_shop", {
      p_token: token,
      p_shop_slug: body.slug,
      p_rating: body.rating,
      p_comment: body.comment || null,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Avaliações serão ativadas após rodar o SQL v6 no Supabase." }, { status: 503 });
  }
}
