import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  transcribe: vi.fn(),
  runIngest: vi.fn(),
}));
vi.mock("@/lib/ingest/authorize", () => ({ authorizeIngest: mocks.authorize }));
vi.mock("@/lib/stt", () => ({ transcribeAudio: mocks.transcribe }));
vi.mock("@/lib/ingest/run", () => ({ runIngest: mocks.runIngest }));

import { POST } from "@/app/api/ingest/audio/route";
import { formatClock, MAX_AUDIO_BYTES, normalizeAudioMime, pickRecorderType } from "@/lib/ingest/audio";
import { resetRateLimit } from "@/lib/rate-limit";

function req(body: BodyInit, contentType?: string): NextRequest {
  return new Request("http://localhost/api/ingest/audio", {
    method: "POST",
    body,
    headers: contentType ? { "content-type": contentType } : undefined,
  }) as unknown as NextRequest;
}
function form(blob: Blob) {
  const f = new FormData();
  f.append("audio", blob, "a.m4a");
  return f;
}

describe("regras do áudio", () => {
  it("escolhe o primeiro formato suportado", () => {
    expect(pickRecorderType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickRecorderType(() => false)).toBe("");
  });
  it("normaliza o tipo e recusa o que não é áudio", () => {
    expect(normalizeAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMime("video/mp4")).toBe("audio/mp4");
    expect(normalizeAudioMime("image/png")).toBeNull();
    expect(normalizeAudioMime(null)).toBeNull();
  });
  it("relógio", () => {
    expect(formatClock(7_400)).toBe("0:07");
    expect(formatClock(65_000)).toBe("1:05");
  });
});

describe("POST /api/ingest/audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.authorize.mockResolvedValue(true);
    mocks.transcribe.mockResolvedValue({ text: "gastei 38 no almoço", provider: "openai" });
    mocks.runIngest.mockResolvedValue({ status: "ok", reply_text: "✅ Despesa R$ 38", actions: [], inbox_id: "i1" });
  });

  it("multipart: transcreve, passa pelo ingest no canal app e devolve a transcrição", async () => {
    const res = await POST(req(form(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mp4" }))));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", reply_text: "✅ Despesa R$ 38", transcript: "gastei 38 no almoço" });
    expect(mocks.transcribe).toHaveBeenCalledWith(expect.any(Buffer), "audio/mp4");
    expect(mocks.runIngest).toHaveBeenCalledWith({ channel: "app", text: "gastei 38 no almoço" });
  });

  it("corpo cru com Content-Type de áudio também vale", async () => {
    const res = await POST(req(new Uint8Array([1, 2]), "audio/webm;codecs=opus"));
    expect(res.status).toBe(200);
    expect(mocks.transcribe).toHaveBeenCalledWith(expect.any(Buffer), "audio/webm");
  });

  it("sem sessão/token: 401 com reply_text", async () => {
    mocks.authorize.mockResolvedValue(false);
    const res = await POST(req(form(new Blob([new Uint8Array([1])], { type: "audio/mp4" }))));
    expect(res.status).toBe(401);
    expect((await res.json()).reply_text).toContain("Sessão expirada");
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it("recusa vazio, formato errado e grande demais sem transcrever", async () => {
    expect((await POST(req(form(new Blob([], { type: "audio/mp4" }))))).status).toBe(400);
    expect((await POST(req(form(new Blob([new Uint8Array([1])], { type: "image/png" }))))).status).toBe(415);
    expect((await POST(req(form(new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: "audio/mp4" }))))).status).toBe(413);
    expect((await POST(req(new FormData()))).status).toBe(400);
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it("áudio mudo: pede pra repetir e não lança nada", async () => {
    mocks.transcribe.mockResolvedValue({ text: "", provider: "openai" });
    const res = await POST(req(form(new Blob([new Uint8Array([1])], { type: "audio/mp4" }))));
    expect(await res.json()).toMatchObject({ status: "needs_clarification", transcript: "" });
    expect(mocks.runIngest).not.toHaveBeenCalled();
  });

  it("falha na transcrição: 502 com mensagem amigável", async () => {
    mocks.transcribe.mockRejectedValue(new Error("429 sem crédito"));
    const res = await POST(req(form(new Blob([new Uint8Array([1])], { type: "audio/mp4" }))));
    expect(res.status).toBe(502);
    expect((await res.json()).reply_text).toContain("Não consegui transcrever");
  });
});
