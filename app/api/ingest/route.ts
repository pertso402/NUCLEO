import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidApiToken } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOwnerId, runIngest } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  channel: z.enum(["whatsapp", "siri", "app", "palette"]),
  text: z.string().trim().min(1).max(2000),
  client_ts: z.string().optional(),
});

/**
 * Autoriza por `x-nucleo-token` (Siri e integrações) OU pela sessão do dono (botão de captura e
 * command palette dentro do app, onde o token não pode ir para o navegador).
 */
async function authorize(request: NextRequest): Promise<boolean> {
  if (isValidApiToken(request.headers.get("x-nucleo-token"))) return true;
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return false;
  return data.user.id === (await resolveOwnerId(createAdminClient()));
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "payload inválido: { channel, text }" }, { status: 400 });
  }

  const limit = rateLimit(`ingest:${body.channel}`);
  if (!limit.ok) {
    return NextResponse.json(
      { status: "error", reply_text: "Muitas mensagens seguidas. Espera um minuto.", actions: [], inbox_id: null },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const result = await runIngest({ channel: body.channel, text: body.text });
  return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
}
