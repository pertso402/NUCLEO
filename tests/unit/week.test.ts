import { describe, expect, it } from "vitest";
import { defaultReviewWeek, delta, isCurrentWeek, isMonday, weekLabel, weekNumbers } from "@/lib/metrics/week";

const NOW = new Date("2026-11-15T21:00:00Z"); // domingo 18h SP

describe("weekNumbers", () => {
  it("soma dinheiro, foco, tarefas, hábitos e média do score", () => {
    const n = weekNumbers(
      {
        transactions: [
          { kind: "income", amount_cents: 150_000 },
          { kind: "income", amount_cents: 80_000 },
          { kind: "expense", amount_cents: 3_890 },
        ],
        timeEntries: [
          { started_at: "2026-11-10T12:00:00Z", ended_at: "2026-11-10T14:00:00Z", is_focus: true },
          { started_at: "2026-11-11T12:00:00Z", ended_at: "2026-11-11T12:30:00Z", is_focus: false },
        ],
        tasksDone: [{ moves_revenue: true }, { moves_revenue: false }, { moves_revenue: true }],
        habitLogs: [1, 2, 3, 4, 5],
        habits: [{ target_per_week: 7 }, { target_per_week: 3 }],
        reviews: [
          { score: 60, win: "fechei", lesson: null },
          { score: 75, win: null, lesson: null },
          { score: null, win: null, lesson: "dormir cedo" },
        ],
      },
      NOW,
    );
    expect(n).toEqual({
      incomeCents: 230_000,
      expenseCents: 3_890,
      netCents: 226_110,
      focusMinutes: 120,
      tasksDone: 3,
      revenueTasksDone: 2,
      habitsDone: 5,
      habitsTarget: 10,
      avgScore: 68,
      reviewedDays: 2,
    });
  });

  it("semana vazia", () => {
    const n = weekNumbers({ transactions: [], timeEntries: [], tasksDone: [], habitLogs: [], habits: [], reviews: [] }, NOW);
    expect(n.avgScore).toBeNull();
    expect(n.netCents).toBe(0);
  });
});

describe("semana", () => {
  it("delta", () => {
    expect(delta(10, 7)).toEqual({ diff: 3, trend: "up" });
    expect(delta(5, 7)).toEqual({ diff: -2, trend: "down" });
    expect(delta(5, 5)).toEqual({ diff: 0, trend: "same" });
    expect(delta(null, 5)).toBeNull();
  });

  it("semana padrão: fim de semana revisa a atual, dia útil a passada", () => {
    expect(defaultReviewWeek("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(defaultReviewWeek("2026-11-14")).toBe("2026-11-09"); // sábado
    expect(defaultReviewWeek("2026-11-13")).toBe("2026-11-02"); // sexta
    expect(defaultReviewWeek("2026-11-16")).toBe("2026-11-09"); // segunda
  });

  it("rótulo, segunda-feira e semana atual", () => {
    expect(weekLabel("2026-11-09")).toBe("09/11 – 15/11");
    expect(isMonday("2026-11-09")).toBe(true);
    expect(isMonday("2026-11-10")).toBe(false);
    expect(isMonday("lixo")).toBe(false);
    expect(isCurrentWeek("2026-11-09", NOW)).toBe(true);
    expect(isCurrentWeek("2026-11-02", NOW)).toBe(false);
  });
});
