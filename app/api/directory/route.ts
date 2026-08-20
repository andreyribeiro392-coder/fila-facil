import { NextResponse } from "next/server";
import { callRpc } from "@/lib/supabase-server";

type RpcResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  try {
    const result = slug
      ? await callRpc<RpcResult>("ff_public_shop", { p_slug: slug })
      : await callRpc<RpcResult>("ff_list_shops", {});
    return NextResponse.json(result, {
      status: result.ok === false ? 404 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível carregar as barbearias." }, { status: 503 });
  }
}
