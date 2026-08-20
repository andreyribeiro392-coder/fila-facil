import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callRpc, SESSION_COOKIE } from "@/lib/supabase-server";

type BillingResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: true, loggedIn: false, paid: true });
  try {
    const result = await callRpc<BillingResult>("ff_billing_status", { p_token: token });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: true, loggedIn: true, paid: true, warning: "Pagamento manual ainda não configurado no Supabase." });
  }
}
