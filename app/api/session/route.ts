import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  callRpc,
  createTransportSession,
  isSameOrigin,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/supabase-server";

type AuthResult = {
  ok?: boolean;
  error?: string;
  token?: string;
  account?: { id: string; username: string; displayName: string; role: "client" | "owner" };
};

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const result = await callRpc<AuthResult>("ff_me", { p_token: token });
    return NextResponse.json(result, { status: result.ok ? 200 : 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, error: "Origem inválida." }, { status: 403 });
  const body = (await request.json()) as Record<string, string>;
  const action = body.action;
  try {
    let result: AuthResult;
    if (action === "register") {
      const transportToken = await createTransportSession();
      result = await callRpc<AuthResult>(
        "ff_register_account",
        {
          p_username: body.username,
          p_password: body.password,
          p_display_name: body.displayName,
          p_role: body.role,
        },
        transportToken,
      );
    } else if (action === "login") {
      result = await callRpc<AuthResult>("ff_login", {
        p_username: body.username,
        p_password: body.password,
      });
    } else {
      return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
    }
    const response = NextResponse.json(result, { status: result.ok ? 200 : 400 });
    if (result.ok && result.token) response.cookies.set(SESSION_COOKIE, result.token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível acessar o servidor seguro." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await callRpc<AuthResult>("ff_logout", { p_token: token }).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
