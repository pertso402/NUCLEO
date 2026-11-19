import { describe, expect, it } from "vitest";
import { cyclePosition, DEFAULT_POMODORO, formatClock, nextPhase } from "@/lib/metrics/pomodoro";
import {
  compare,
  fmtHours,
  focusStreak,
  hourHeatmap,
  minutesByTask,
  monthlySeries,
  periodRange,
  previousRange,
  shiftRange,
  summarize,
  weeklySeries,
  type TimeEntryRow,
} from "@/lib/metrics/time";
import { nextFreeColor, projectHex } from "@/lib/projects-palette";

const NOW = new Date("2026-11-19T20:00:00Z"); // qui 19/11, 17h SP
let seq = 0;
const e = (start: string, minutes: number, p: Partial<TimeEntryRow> = {}): TimeEntryRow => ({
  id: `e${seq++}`,
  started_at: start,
  ended_at: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
  is_focus: true,
  project_id: null,
  task_id: null,
  kind: "timer",
  label: null,
  ...p,
});

describe("períodos", () => {
  it("dia, semana (seg–dom) e mês; anterior e deslocado", () => {
    expect(periodRange("week", "2026-11-19")).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(periodRange("month", "2026-11-19")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(previousRange("day", periodRange("day", "2026-11-19"))).toEqual({ start: "2026-11-18", end: "2026-11-18" });
    expect(previousRange("week", periodRange("week", "2026-11-19"))).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(previousRange("month", periodRange("month", "2026-03-10"))).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(shiftRange("week", periodRange("week", "2026-11-19"), 1)).toEqual({ start: "2026-11-23", end: "2026-11-29" });
  });
});

describe("summarize", () => {
  const entries = [
    e("2026-11-16T12:00:00Z", 90, { project_id: "p1", kind: "pomodoro" }), // seg
    e("2026-11-16T15:00:00Z", 30, { project_id: "p2" }),
    e("2026-11-18T13:00:00Z", 120, { project_id: "p1" }), // qua
    e("2026-11-19T02:30:00Z", 30), // qua 23h30 SP → conta na quarta
    e("2026-11-19T19:30:00Z", 0, { ended_at: null, project_id: "p2" }), // aberto: 30 min até agora
    e("2026-11-19T12:00:00Z", 60, { is_focus: false }), // não é foco
    e("2026-11-10T12:00:00Z", 999), // semana passada
  ];
  const s = summarize(entries, periodRange("week", "2026-11-19"), NOW);

  it("total, sessões, pomodoros, dias ativos, média e melhor dia", () => {
    expect(s.totalMinutes).toBe(90 + 30 + 120 + 30 + 30);
    expect(s.sessions).toBe(5);
    expect(s.pomodoros).toBe(1);
    expect(s.activeDays).toBe(3);
    expect(s.avgPerActiveDay).toBe(100);
    expect(s.bestDay).toEqual({ date: "2026-11-18", minutes: 150 });
  });

  it("por projeto (maior primeiro, sem projeto = null) e por dia com fatias", () => {
    expect(s.byProject).toEqual([
      { projectId: "p1", minutes: 210 },
      { projectId: "p2", minutes: 60 },
      { projectId: null, minutes: 30 },
    ]);
    expect(s.byDay).toHaveLength(7);
    expect(s.byDay[0]).toEqual({ date: "2026-11-16", minutes: 120, byProject: { p1: 90, p2: 30 } });
    expect(s.byDay[2]!.byProject).toEqual({ p1: 120, none: 30 });
  });
});

describe("comparação, séries e horários", () => {
  it("compare", () => {
    expect(compare(300, 200)).toEqual({ diff: 100, pct: 0.5, trend: "up" });
    expect(compare(100, 200)).toMatchObject({ diff: -100, pct: -0.5, trend: "down" });
    expect(compare(50, 0)).toEqual({ diff: 50, pct: null, trend: "up" });
  });

  it("série semanal e mensal", () => {
    const entries = [e("2026-11-16T12:00:00Z", 60), e("2026-11-09T12:00:00Z", 30), e("2026-10-05T12:00:00Z", 45)];
    expect(weeklySeries(entries, "2026-11-19", NOW, 3)).toEqual([
      { weekStart: "2026-11-02", minutes: 0 },
      { weekStart: "2026-11-09", minutes: 30 },
      { weekStart: "2026-11-16", minutes: 60 },
    ]);
    expect(monthlySeries(entries, "2026-11-19", NOW, 2)).toEqual([
      { month: "2026-10-01", minutes: 45 },
      { month: "2026-11-01", minutes: 90 },
    ]);
  });

  it("mapa de horários em São Paulo (seg = 0)", () => {
    // seg 16/11, 09:00–10:30 SP (12:00–13:30 UTC)
    const g = hourHeatmap([e("2026-11-16T12:00:00Z", 90)], periodRange("week", "2026-11-19"), NOW);
    expect(g[0]![9]).toBe(60);
    expect(g[0]![10]).toBe(30);
    expect(g.flat().reduce((a, b) => a + b, 0)).toBe(90);
  });

  it("minutos por tarefa e sequência de dias com foco", () => {
    const entries = [
      e("2026-11-19T12:00:00Z", 40, { task_id: "t1" }),
      e("2026-11-18T12:00:00Z", 35, { task_id: "t1" }),
      e("2026-11-17T12:00:00Z", 10),
    ];
    expect(minutesByTask(entries, NOW).get("t1")).toBe(75);
    expect(focusStreak(entries, "2026-11-19", NOW, 30)).toBe(2); // 17/11 só teve 10 min
  });

  it("formatação de horas", () => {
    expect(fmtHours(45)).toBe("45min");
    expect(fmtHours(120)).toBe("2h");
    expect(fmtHours(200)).toBe("3h20");
  });
});

describe("pomodoro", () => {
  it("foco → pausa curta; a cada 4 focos, pausa longa; pausa → foco", () => {
    expect(nextPhase("focus", 1, DEFAULT_POMODORO)).toBe("short_break");
    expect(nextPhase("focus", 4, DEFAULT_POMODORO)).toBe("long_break");
    expect(nextPhase("short_break", 1, DEFAULT_POMODORO)).toBe("focus");
    expect(nextPhase("long_break", 4, DEFAULT_POMODORO)).toBe("focus");
    expect(cyclePosition(0, DEFAULT_POMODORO)).toBe(1);
    expect(cyclePosition(5, DEFAULT_POMODORO)).toBe(2);
  });
  it("relógio arredonda pra cima o segundo restante", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(3_723_000)).toBe("1:02:03");
    expect(formatClock(-5)).toBe("00:00");
  });
});

describe("paleta de projetos", () => {
  it("cor conhecida, sem projeto e próxima livre", () => {
    expect(projectHex("cyan")).toBe("#22D3EE");
    expect(projectHex(null)).toBe("#5E6678");
    expect(nextFreeColor(["violet", "cyan"])).toBe("lime");
  });
});
