import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create } };
  },
  toFile: async (data: unknown, name: string, opts: { type: string }) => ({ data, name, type: opts.type }),
}));

import { encodeWav, WAV_SAMPLE_RATE } from "@/lib/audio-wav";
import { audioExtension, transcribeAudio } from "@/lib/stt";

describe("encodeWav", () => {
  it("cabeçalho RIFF/WAVE PCM mono 16 kHz e amostras em 16 bits", () => {
    const buf = encodeWav(new Float32Array([0, 1, -1, 0.5, 2]));
    const v = new DataView(buf);
    const str = (o: number, n: number) => String.fromCharCode(...new Uint8Array(buf, o, n));
    expect(str(0, 4)).toBe("RIFF");
    expect(str(8, 4)).toBe("WAVE");
    expect(str(36, 4)).toBe("data");
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(WAV_SAMPLE_RATE);
    expect(v.getUint32(40, true)).toBe(10); // 5 amostras × 2 bytes
    expect(buf.byteLength).toBe(54);
    expect([0, 1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 16383, 32767]); // 2 é limitado a 1
  });
});

describe("transcrição", () => {
  beforeEach(() => {
    create.mockReset();
    process.env.OPENAI_API_KEY = "sk-teste";
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.OPENAI_STT_MODEL;
  });

  it("extensão pelo tipo (a OpenAI decide o formato pelo nome)", () => {
    expect(audioExtension("audio/wav")).toBe("wav");
    expect(audioExtension("audio/mp4")).toBe("mp4");
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/mpeg")).toBe("mp3");
    expect(audioExtension("audio/ogg")).toBe("ogg");
    expect(audioExtension(null)).toBe("ogg");
  });

  it("formato recusado pelo modelo principal → tenta whisper-1", async () => {
    create
      .mockRejectedValueOnce(Object.assign(new Error("Audio file might be corrupted or unsupported"), { status: 400 }))
      .mockResolvedValueOnce({ text: " recebi 1500 " });
    const r = await transcribeAudio(Buffer.from([1, 2]), "audio/mp4");
    expect(r).toEqual({ text: "recebi 1500", provider: "openai-whisper" });
    expect(create.mock.calls.map((c) => c[0].model)).toEqual(["gpt-4o-mini-transcribe", "whisper-1"]);
    expect(create.mock.calls[0]![0].file.name).toBe("audio.mp4");
  });

  it("outros erros não tentam de novo", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("Rate limit"), { status: 429 }));
    await expect(transcribeAudio(Buffer.from([1]), "audio/wav")).rejects.toThrow("Rate limit");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
