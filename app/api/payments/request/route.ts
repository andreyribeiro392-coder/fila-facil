import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callRpc, isSameOrigin, SESSION_COOKIE } from "@/lib/supabase-server";

type PaymentRequestResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, error: "Entre com sua conta antes de avisar o pagamento." }, { status: 401 });
  const body = (await request.json()) as { planType?: string; payerName?: string };
  try {
    const result = await callRpc<PaymentRequestResult>("ff_create_payment_request", {
      p_token: token,
      p_plan_type: body.planType,
      p_payer_name: body.payerName,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Rode o SQL de pagamentos manuais no Supabase para ativar os pedidos." }, { status: 503 });
  }
}
