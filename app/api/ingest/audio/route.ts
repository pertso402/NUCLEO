import { NextResponse, type NextRequest } from "next/server";
import { MAX_AUDIO_BYTES, normalizeAudioMime } from "@/lib/ingest/audio";
import { authorizeIngest } from "@/lib/ingest/authorize";
import { runIngest } from "@/lib/ingest/run";
import { rateLimit } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/stt";

export const runtime = "nodejs";
export const maxDuration = 45;

const fail = (status: number, reply_text: string, error: string) =>
  NextResponse.json({ status: "error", reply_text, error, actions: [], inbox_id: null, transcript: null }, { status });

/**
 * Áudio do botão de captura (ARCHITECTURE §5.1): transcreve no servidor e passa o texto pelo
 * mesmo pipeline do /api/ingest (canal `app`, registra em `inbox_messages`).
 * Corpo: `multipart/form-data` com o campo `audio`, ou o áudio cru com `Content-Type: audio/*`.
 * Resposta: a do ingest + `transcript` (o que foi entendido).
 */
export async function POST(request: NextRequest) {
  if (!(await authorizeIngest(request))) return fail(401, "⚠️ Sessão expirada. Entre de novo.", "não autorizado");
  if (!rateLimit("ingest:app-audio").ok) return fail(429, "Muitas mensagens seguidas. Espera um minuto.", "limite");

  let audio: Buffer;
  let mime: string | null;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.startsWith("multipart/form-data")) {
      const file = (await request.formData()).get("audio");
      if (!(file instanceof Blob)) return fail(400, "Não chegou áudio nenhum.", "campo audio ausente");
      mime = normalizeAudioMime(file.type);
      audio = Buffer.from(await file.arrayBuffer());
    } else {
      mime = normalizeAudioMime(ct);
      audio = Buffer.from(await request.arrayBuffer());
    }
  } catch {
    return fail(400, "Não chegou áudio nenhum.", "corpo ilegível");
  }
  if (!mime) return fail(415, "Formato de áudio não suportado.", "tipo não é áudio");
  if (audio.byteLength === 0) return fail(400, "Não chegou áudio nenhum.", "vazio");
  if (audio.byteLength > MAX_AUDIO_BYTES) return fail(413, "Áudio longo demais. Fala em até um minuto.", "grande demais");

  let transcript: string;
  try {
    transcript = (await transcribeAudio(audio, mime)).text;
  } catch (err) {
    console.error("áudio: transcrição falhou", err instanceof Error ? err.message : err);
    return fail(502, "⚠️ Não consegui transcrever agora. Tenta de novo ou escreve.", "stt");
  }
  if (!transcript) {
    return NextResponse.json({
      status: "needs_clarification",
      reply_text: "❓ Não entendi o áudio. Tenta de novo ou escreve.",
      actions: [],
      inbox_id: null,
      transcript: "",
    });
  }

  const result = await runIngest({ channel: "app", text: transcript });
  return NextResponse.json({ ...result, transcript }, { status: result.status === "error" ? 500 : 200 });
}
