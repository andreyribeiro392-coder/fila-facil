const SUPABASE_URL = "https://wvmsylpqvaiqtvtkrxil.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IVZ-ENHIfzPfuo-EDoRfuA_80t98jJ5";

type RpcResult = Record<string, unknown> & { ok?: boolean; error?: string };

export async function createTransportSession() {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      "x-supabase-api-version": "2024-01-01",
    },
    body: JSON.stringify({ data: { transport: "fila-facil-v5" } }),
    cache: "no-store",
  });
  const data = (await response.json()) as { access_token?: string; error_description?: string; msg?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.msg || "Não foi possível iniciar a sessão segura.");
  }
  return data.access_token;
}

export async function callRpc<T extends RpcResult>(
  functionName: string,
  args: Record<string, unknown>,
  accessToken?: string,
) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const data = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message = "message" in data && typeof data.message === "string"
      ? data.message
      : "O servidor recusou a operação.";
    throw new Error(message);
  }
  return data as T;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const protocol = forwardedProtocol ? forwardedProtocol + ":" : new URL(request.url).protocol;
    return originUrl.host === host && originUrl.protocol === protocol;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = "ff_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
