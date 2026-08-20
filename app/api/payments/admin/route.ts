import { NextResponse } from "next/server";
import { hasAdminPaymentConfig, isSameOrigin, isValidAdminPin, serviceRequest } from "@/lib/supabase-server";

type PaymentRow = {
  id: string;
  account_id: string;
  payer_name: string;
  plan_type: "cliente" | "barbearia";
  amount: number;
  status: "pending" | "approved" | "denied";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type AccountRow = {
  id: string;
  username: string;
  display_name: string;
  role: string;
  payment_status?: string;
  lifetime_access?: boolean;
  paid_until?: string | null;
};

function adminError(status = 401) {
  return NextResponse.json({ ok: false, error: "PIN administrativo inválido ou não configurado." }, { status });
}

function pinFrom(request: Request) {
  return request.headers.get("x-admin-pin") || new URL(request.url).searchParams.get("pin") || "";
}

export async function GET(request: Request) {
  if (!hasAdminPaymentConfig()) {
    return NextResponse.json({ ok: false, setup: true, error: "Configure SUPABASE_SERVICE_ROLE_KEY e FILA_FACIL_ADMIN_PIN na Vercel." }, { status: 503 });
  }
  if (!isValidAdminPin(pinFrom(request))) return adminError();

  try {
    const payments = await serviceRequest<PaymentRow[]>("/rest/v1/payment_requests?select=id,account_id,payer_name,plan_type,amount,status,review_note,created_at,reviewed_at&order=created_at.desc&limit=100");
    const ids = [...new Set(payments.map((item) => item.account_id).filter(Boolean))];
    let accounts: AccountRow[] = [];
    let warning = "";

    if (ids.length) {
      try {
        accounts = await serviceRequest<AccountRow[]>(`/rest/v1/app_accounts?select=id,username,display_name,role,payment_status,lifetime_access,paid_until&id=in.(${ids.join(",")})`);
      } catch (error) {
        warning = error instanceof Error ? error.message : "Não foi possível carregar os dados das contas.";
      }
    }

    const map = new Map(accounts.map((account) => [account.id, account]));
    return NextResponse.json({
      ok: true,
      warning,
      total: payments.length,
      payments: payments.map((payment) => ({ ...payment, account: map.get(payment.account_id) || null })),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao carregar pedidos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  if (!hasAdminPaymentConfig()) return NextResponse.json({ ok: false, setup: true, error: "Configure SUPABASE_SERVICE_ROLE_KEY e FILA_FACIL_ADMIN_PIN na Vercel." }, { status: 503 });
  const body = (await request.json()) as { pin?: string; requestId?: string; action?: "approved" | "denied"; note?: string };
  if (!isValidAdminPin(body.pin)) return adminError();
  if (!body.requestId || !["approved", "denied"].includes(body.action || "")) {
    return NextResponse.json({ ok: false, error: "Pedido ou ação inválida." }, { status: 400 });
  }

  try {
    const rows = await serviceRequest<PaymentRow[]>(`/rest/v1/payment_requests?select=id,account_id,payer_name,plan_type,amount,status,review_note,created_at,reviewed_at&id=eq.${body.requestId}&limit=1`);
    const payment = rows[0];
    if (!payment) return NextResponse.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });

    await serviceRequest<PaymentRow[]>(`/rest/v1/payment_requests?id=eq.${payment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: body.action, review_note: body.note || null, reviewed_at: new Date().toISOString(), reviewed_by: "painel" }),
    });

    if (body.action === "approved") {
      if (payment.plan_type === "cliente") {
        await serviceRequest<AccountRow[]>(`/rest/v1/app_accounts?id=eq.${payment.account_id}`, {
          method: "PATCH",
          body: JSON.stringify({ payment_status: "approved", lifetime_access: true, paid_until: null }),
        });
      } else {
        const paidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await serviceRequest<AccountRow[]>(`/rest/v1/app_accounts?id=eq.${payment.account_id}`, {
          method: "PATCH",
          body: JSON.stringify({ payment_status: "active", lifetime_access: false, paid_until: paidUntil }),
        });
        await serviceRequest<Record<string, unknown>[]>(`/rest/v1/barbershops?account_owner_id=eq.${payment.account_id}`, {
          method: "PATCH",
          body: JSON.stringify({ verification_status: "approved", suspended_at: null, verification_reviewed_at: new Date().toISOString() }),
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao revisar pedido." }, { status: 500 });
  }
}
