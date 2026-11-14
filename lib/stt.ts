import "server-only";
import OpenAI, { toFile } from "openai";

/**
 * Transcrição de áudio em português. ElevenLabs Scribe quando houver `ELEVENLABS_API_KEY`
 * (ARCHITECTURE §5.1); senão usa a OpenAI, que já está configurada para o parser.
 */
export async function transcribeAudio(audio: Buffer, mimetype: string | null): Promise<{ text: string; provider: string }> {
  const type = mimetype || "audio/ogg";
  const ext = type.includes("mp4") || type.includes("m4a") ? "m4a" : type.includes("mpeg") ? "mp3" : "ogg";
  const fileName = `audio.${ext}`;

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
  const r = await client.audio.transcriptions.create({
    file: await toFile(audio, fileName, { type }),
    model: process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe",
    language: "pt",
  });
  return { text: r.text.trim(), provider: "openai" };
}
