import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { authorizeIngest } from "@/lib/ingest/authorize";
import { runIngest } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  channel: z.enum(["whatsapp", "siri", "app", "palette"]),
  text: z.string().trim().min(1).max(2000),
  client_ts: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!(await authorizeIngest(request))) {
    // reply_text em todo erro: o Atalho da Siri mostra/fala sempre esse campo.
    return NextResponse.json(
      { error: "não autorizado", status: "error", reply_text: "Token inválido. Confira o token no Atalho." },
      { status: 401 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "payload inválido: { channel, text }", status: "error", reply_text: "Não ouvi nada pra lançar." },
      { status: 400 },
    );
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
