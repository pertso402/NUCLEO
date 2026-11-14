import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runIngest: vi.fn(),
  sendText: vi.fn(),
  fetchMediaBase64: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock("@/lib/ingest/run", () => ({ runIngest: mocks.runIngest }));
vi.mock("@/lib/whatsapp/stt", () => ({ transcribeAudio: mocks.transcribeAudio }));
vi.mock("@/lib/whatsapp/evolution", () => ({
  whatsappEnv: () => ({ url: "https://evo", apiKey: "k", instance: "i", peterNumber: "5511987654321", mode: "numero_separado" }),
  sendText: mocks.sendText,
  fetchMediaBase64: mocks.fetchMediaBase64,
}));

import { firstTimeSeen, handleWhatsApp } from "@/lib/whatsapp/handle";
import { resetRateLimit } from "@/lib/rate-limit";
import type { IncomingWhatsApp } from "@/lib/whatsapp/webhook";

const base: IncomingWhatsApp = {
  number: "5511987654321",
  messageId: "M1",
  ts: "2026-11-13T15:00:00.000Z",
  kind: "text",
  text: "gastei 38 no almoço",
  base64: null,
  mimetype: null,
};
const sent = () => mocks.sendText.mock.calls.map((c) => c[2] as string);

describe("handleWhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.runIngest.mockResolvedValue({ reply_text: "✅ Despesa R$ 38", status: "ok", actions: [], inbox_id: "x" });
    mocks.sendText.mockResolvedValue(undefined);
  });

  it("texto: passa pelo ingest com channel whatsapp e responde no mesmo número", async () => {
    await handleWhatsApp(base);
    expect(mocks.runIngest).toHaveBeenCalledWith({ channel: "whatsapp", text: "gastei 38 no almoço" });
    expect(mocks.sendText).toHaveBeenCalledWith(expect.anything(), "5511987654321", "⁣✅ Despesa R$ 38");
  });

  it("áudio com base64 no webhook: transcreve sem baixar e ecoa o texto", async () => {
    mocks.transcribeAudio.mockResolvedValue({ text: "recebi 1500 do cliente X", provider: "openai" });
    await handleWhatsApp({ ...base, kind: "audio", text: null, base64: "T2dnUw==", mimetype: "audio/ogg" });
    expect(mocks.fetchMediaBase64).not.toHaveBeenCalled();
    expect(mocks.transcribeAudio).toHaveBeenCalledWith(Buffer.from("T2dnUw==", "base64"), "audio/ogg");
    expect(mocks.runIngest).toHaveBeenCalledWith({ channel: "whatsapp", text: "recebi 1500 do cliente X" });
    expect(sent()[0]).toBe('⁣🎙️ "recebi 1500 do cliente X"\n✅ Despesa R$ 38');
  });

  it("áudio sem base64: baixa da Evolution antes de transcrever", async () => {
    mocks.fetchMediaBase64.mockResolvedValue({ base64: "QUFB", mimetype: "audio/mp4" });
    mocks.transcribeAudio.mockResolvedValue({ text: "fiz academia", provider: "openai" });
    await handleWhatsApp({ ...base, kind: "audio", text: null });
    expect(mocks.fetchMediaBase64).toHaveBeenCalledWith(expect.anything(), "M1");
    expect(mocks.transcribeAudio).toHaveBeenCalledWith(Buffer.from("QUFB", "base64"), "audio/mp4");
  });

  it("áudio mudo não chama o ingest e pede para repetir", async () => {
    mocks.transcribeAudio.mockResolvedValue({ text: "", provider: "openai" });
    await handleWhatsApp({ ...base, kind: "audio", text: null, base64: "QUFB" });
    expect(mocks.runIngest).not.toHaveBeenCalled();
    expect(sent()[0]).toBe("⁣Não entendi o áudio. Pode mandar de novo ou escrever?");
  });

  it("falha no ingest ainda responde, sem lançar exceção", async () => {
    mocks.runIngest.mockRejectedValue(new Error("supabase fora"));
    await expect(handleWhatsApp(base)).resolves.toBeUndefined();
    expect(sent()[0]).toBe("⁣Não consegui processar agora. Tenta de novo em texto.");
  });

  it("falha ao responder não derruba nada", async () => {
    mocks.sendText.mockRejectedValue(new Error("evolution fora"));
    await expect(handleWhatsApp(base)).resolves.toBeUndefined();
  });

  it("acima de 30 mensagens por minuto, avisa em vez de lançar", async () => {
    for (let i = 0; i < 31; i++) await handleWhatsApp(base);
    expect(mocks.runIngest).toHaveBeenCalledTimes(30);
    expect(sent()[30]).toBe("⁣Muitas mensagens seguidas. Espera um minuto.");
  });

  it("ignora o mesmo evento entregue duas vezes", () => {
    expect(firstTimeSeen("DUP", 1_000)).toBe(true);
    expect(firstTimeSeen("DUP", 2_000)).toBe(false);
    expect(firstTimeSeen("DUP", 1_000 + 11 * 60_000)).toBe(true);
  });
});
