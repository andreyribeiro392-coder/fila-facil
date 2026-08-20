import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callRpc, isSameOrigin, SESSION_COOKIE } from "@/lib/supabase-server";

type ReviewResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Entre com sua conta de cliente." }, { status: 401 });
  const body = (await request.json()) as { slug?: string; rating?: number; comment?: string };
  try {
    const result = await callRpc<ReviewResult>("ff_review_shop", {
      p_token: token,
      p_shop_slug: body.slug,
      p_rating: body.rating,
      p_comment: body.comment || null,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível salvar sua avaliação." }, { status: 503 });
  }
}
