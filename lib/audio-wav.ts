/**
 * Converte o áudio gravado no navegador para WAV mono 16 kHz antes de enviar.
 * Motivo: o iPhone grava MP4 "fragmentado" que a transcrição da OpenAI às vezes recusa
 * ("Audio file might be corrupted or unsupported"); WAV PCM é aceito sempre.
 * 16 kHz mono 16-bit = 32 KB/s → 60 s ≈ 1,9 MB (cabe no limite de 4 MB).
 */

export const WAV_SAMPLE_RATE = 16_000;

/** PCM 16-bit little-endian com cabeçalho RIFF/WAVE. Puro (testável no Node). */
export function encodeWav(samples: Float32Array, sampleRate = WAV_SAMPLE_RATE): ArrayBuffer {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por amostra
  v.setUint16(34, 16, true); // bits
  str(36, "data");
  v.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/**
 * Decodifica o que o MediaRecorder gravou e reamostra para mono 16 kHz (Web Audio).
 * Se o navegador não conseguir decodificar, devolve o áudio original — o servidor tenta mesmo assim.
 */
export async function toWav(blob: Blob): Promise<Blob> {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx || typeof OfflineAudioContext === "undefined") return blob;
    const ctx = new Ctx();
    try {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const frames = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE));
      const offline = new OfflineAudioContext(1, frames, WAV_SAMPLE_RATE);
      const src = offline.createBufferSource();
      src.buffer = decoded;
      src.connect(offline.destination);
      src.start();
      const rendered = await offline.startRendering();
      return new Blob([encodeWav(rendered.getChannelData(0))], { type: "audio/wav" });
    } finally {
      void ctx.close();
    }
  } catch {
    return blob;
  }
}
