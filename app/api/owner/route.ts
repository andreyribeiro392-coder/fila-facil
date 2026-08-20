import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callRpc, isSameOrigin, SESSION_COOKIE } from "@/lib/supabase-server";

type OwnerResult = Record<string, unknown> & { ok?: boolean; error?: string };

async function token() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function GET() {
  const sessionToken = await token();
  if (!sessionToken) return NextResponse.json({ ok: false, error: "Entre com sua conta." }, { status: 401 });
  try {
    const result = await callRpc<OwnerResult>("ff_owner_dashboard", { p_token: sessionToken });
    return NextResponse.json(result, { status: result.ok ? 200 : 403, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível carregar o painel." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  const sessionToken = await token();
  if (!sessionToken) return NextResponse.json({ ok: false, error: "Entre com sua conta." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  try {
    const result = body.action === "create_shop"
      ? await callRpc<OwnerResult>("ff_create_shop", {
          p_token: sessionToken,
          p_name: body.name,
          p_whatsapp: body.whatsapp,
          p_address: body.address,
          p_latitude: body.latitude,
          p_longitude: body.longitude,
          p_verification_method: body.verificationMethod,
          p_verification_reference: body.verificationReference,
          p_ownership_confirmed: body.ownershipConfirmed,
        })
      : await callRpc<OwnerResult>("ff_owner_action", {
          p_token: sessionToken,
          p_action: body.action,
          p_payload: body.payload || {},
        });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Operação recusada pelo servidor seguro." }, { status: 503 });
  }
}
