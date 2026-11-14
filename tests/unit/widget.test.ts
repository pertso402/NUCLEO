import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computePace } from "@/lib/metrics/pace";
import { buildWidgetPayload, type WidgetPayload } from "@/lib/widget";

const NOW = new Date("2026-11-13T15:00:00Z");

describe("buildWidgetPayload", () => {
  const today = { score: { score: 52 }, focusMinutes: 165.4, focusGoalMinutes: 240, habitsDone: 2, habitsExpected: 3 };

  it("números prontos do marco e do dia, dinheiro em centavos", () => {
    const pace = computePace({ currentCents: 620_000, targetCents: 1_000_000, period: { start: "2026-11-01", end: "2026-11-30" }, now: NOW });
    const p = buildWidgetPayload({ milestone: { title: "R$ 10k de receita" }, pace }, today, NOW);
    expect(p).toMatchObject({
      milestone_title: "R$ 10k de receita",
      current_cents: 620_000,
      target_cents: 1_000_000,
      pct: 0.62,
      remaining_cents: 380_000,
      score_today: 52,
      outreach_today: null,
      outreach_goal: null,
      focus_minutes: 165,
      habits_done: 2,
      habits_expected: 3,
      updated_at: NOW.toISOString(),
    });
    expect(Number.isInteger(p.pace_needed_cents)).toBe(true);
    expect(p.expected_pct).toBeGreaterThan(0);
  });

  it("sem marco ativo", () => {
    expect(buildWidgetPayload(null, today, NOW)).toMatchObject({ milestone_title: null, current_cents: 0, pct: 0, achieved: false });
  });
});

/**
 * Roda o script do Scriptable num simulador mínimo (globais falsos) e devolve os textos
 * que o widget desenhou — pega erro de execução e texto errado sem precisar do iPhone.
 */
async function runScript(opts: { family: string; response?: unknown; status?: number; token?: string | null }) {
  const src = readFileSync(path.resolve(__dirname, "../../integrations/scriptable/nucleo-widget.js"), "utf8");
  const texts: string[] = [];
  let widget: { url?: string } | null = null;
  class Stack {
    addText(t: string) {
      texts.push(t);
      return {};
    }
    addStack() {
      return new Stack();
    }
    addSpacer() {}
    addImage() {
      return {};
    }
    centerAlignContent() {}
    bottomAlignContent() {}
    setPadding() {}
  }
  class ListWidget extends Stack {
    url?: string;
    constructor() {
      super();
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      widget = this;
    }
  }
  const store = new Map<string, string>(opts.token ? [["nucleo_token", opts.token]] : []);
  const files = new Map<string, string>();
  const globals = {
    Color: class {},
    Font: new Proxy({}, { get: () => () => ({}) }),
    Size: class {},
    Rect: class {},
    Path: class {
      addRoundedRect() {}
    },
    DrawContext: class {
      addPath() {}
      setFillColor() {}
      fillPath() {}
      fillRect() {}
      getImage() {
        return {};
      }
    },
    LinearGradient: class {},
    ListWidget,
    Keychain: { contains: (k: string) => store.has(k), get: (k: string) => store.get(k), set: (k: string, v: string) => store.set(k, v) },
    FileManager: {
      local: () => ({
        documentsDirectory: () => "/docs",
        joinPath: (a: string, b: string) => `${a}/${b}`,
        fileExists: (p: string) => files.has(p),
        readString: (p: string) => files.get(p),
        writeString: (p: string, v: string) => files.set(p, v),
      }),
    },
    Request: class {
      headers: Record<string, string> = {};
      timeoutInterval = 0;
      response = { statusCode: opts.status ?? 200 };
      constructor(readonly url: string) {}
      async loadJSON() {
        if (opts.response instanceof Error) throw opts.response;
        return opts.response;
      }
    },
    Alert: class {},
    config: { runsInWidget: true, runsInApp: false, widgetFamily: opts.family },
    Script: { setWidget: () => {}, complete: () => {} },
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  await new AsyncFunction(...Object.keys(globals), src)(...Object.values(globals));
  return { texts, widget: widget as { url?: string } | null };
}

const PAYLOAD: WidgetPayload = {
  milestone_title: "R$ 10k de receita",
  current_cents: 620_000,
  target_cents: 1_000_000,
  pct: 0.62,
  remaining_cents: 380_000,
  pace_needed_cents: 34_545,
  expected_pct: 0.45,
  on_track: true,
  achieved: false,
  bd_left: 11,
  score_today: 52,
  outreach_today: null,
  outreach_goal: null,
  focus_minutes: 165,
  focus_goal_minutes: 240,
  habits_done: 2,
  habits_expected: 3,
  updated_at: "2026-11-13T15:00:00.000Z",
};

describe("script do Scriptable", () => {
  it("médio: marco, valores em reais, faltam, ritmo e linha do dia; toque abre o app", async () => {
    const { texts, widget } = await runScript({ family: "medium", response: PAYLOAD, token: "t" });
    expect(texts).toEqual(
      expect.arrayContaining([
        "NÚCLEO",
        "52",
        "R$ 10k de receita",
        "R$ 6.200",
        "de R$ 10.000",
        "faltam R$ 3.800",
        "R$ 346/dia útil",
        "2h45/4h",
        "2/3",
      ]),
    );
    expect(widget?.url).toBe("https://nucleo-beta.vercel.app");
  });

  it("pequeno: sem 'de R$' nem ritmo", async () => {
    const { texts } = await runScript({ family: "small", response: PAYLOAD, token: "t" });
    expect(texts).toContain("faltam R$ 3.800");
    expect(texts).not.toContain("de R$ 10.000");
  });

  it("marco batido e sem marco", async () => {
    const batido = await runScript({ family: "medium", response: { ...PAYLOAD, achieved: true, pct: 1.05 }, token: "t" });
    expect(batido.texts).toContain("Marco batido");
    const sem = await runScript({ family: "medium", response: { ...PAYLOAD, milestone_title: null }, token: "t" });
    expect(sem.texts).toContain("Nenhum marco ativo");
  });

  it("sem token, token inválido e sem rede", async () => {
    expect((await runScript({ family: "medium", token: null })).texts).toContain(
      "Abra o script no Scriptable para configurar o token.",
    );
    expect((await runScript({ family: "medium", response: { error: "não autorizado" }, status: 401, token: "t" })).texts).toContain(
      "Token inválido. Rode o script no app para trocar.",
    );
    expect((await runScript({ family: "medium", response: new Error("offline"), token: "t" })).texts).toContain(
      "Sem conexão com o NÚCLEO.",
    );
  });
});
