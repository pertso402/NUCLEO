/**
 * Regras do áudio do botão de captura (puro, testável no servidor e no navegador).
 */

/** Limite do corpo da Vercel é ~4,5 MB; 4 MB dá ~4 min de áudio comprimido — sobra. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/** Gravação máxima no botão (segurar). */
export const MAX_RECORDING_MS = 60_000;

/** Menos que isso é toque acidental: descarta sem enviar. */
export const MIN_RECORDING_MS = 600;

/** Quanto tempo segurando conta como "gravar" em vez de "toque". */
export const HOLD_DELAY_MS = 220;

/** Formatos que o MediaRecorder costuma gravar, em ordem de preferência (o iPhone grava mp4/aac). */
export const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];

/** Primeiro formato suportado pelo navegador; vazio = deixa o navegador escolher. */
export function pickRecorderType(isSupported: (t: string) => boolean): string {
  return RECORDER_TYPES.find((t) => isSupported(t)) ?? "";
}

/** "audio/webm;codecs=opus" → "audio/webm". Aceita só áudio (e vídeo mp4/webm, que é como alguns iPhones rotulam). */
export function normalizeAudioMime(type: string | null | undefined): string | null {
  const base = (type ?? "").split(";")[0]!.trim().toLowerCase();
  if (base.startsWith("audio/")) return base;
  if (base === "video/mp4" || base === "video/webm") return base.replace("video/", "audio/");
  return null;
}

/** 0:07 */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
