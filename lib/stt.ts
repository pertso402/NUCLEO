import "server-only";
import OpenAI, { toFile } from "openai";

/** Extensão do arquivo pelo tipo — a OpenAI decide o formato pelo nome. */
export function audioExtension(mimetype: string | null): string {
  const t = (mimetype || "").toLowerCase();
  if (t.includes("wav")) return "wav";
  if (t.includes("webm")) return "webm";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "mp4";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "ogg";
}

/** Erro de formato da OpenAI ("Audio file might be corrupted or unsupported" / "Invalid file format"). */
function isFormatError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return e?.status === 400 && /corrupt|unsupported|invalid file format|format/i.test(e.message ?? "");
}

/**
 * Transcrição de áudio em português. ElevenLabs Scribe quando houver `ELEVENLABS_API_KEY`
 * (ARCHITECTURE §5.1); senão usa a OpenAI, que já está configurada para o parser.
 * Na OpenAI, se o modelo principal recusar o formato, tenta o `whisper-1` (mais tolerante).
 */
export async function transcribeAudio(audio: Buffer, mimetype: string | null): Promise<{ text: string; provider: string }> {
  const type = mimetype || "audio/ogg";
  const fileName = `audio.${audioExtension(type)}`;

  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (elevenKey) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type }), fileName);
    form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
    form.append("language_code", "por");
    form.append("tag_audio_events", "false");
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": elevenKey },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`ElevenLabs respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim(), provider: "elevenlabs" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Sem chave de transcrição (ELEVENLABS_API_KEY ou OPENAI_API_KEY)");
  const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });
  const primary = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
  const run = async (model: string) =>
    client.audio.transcriptions.create({ file: await toFile(audio, fileName, { type }), model, language: "pt" });
  try {
    return { text: (await run(primary)).text.trim(), provider: "openai" };
  } catch (err) {
    if (primary === "whisper-1" || !isFormatError(err)) throw err;
    return { text: (await run("whisper-1")).text.trim(), provider: "openai-whisper" };
  }
}
