/**
 * Objetivos trimestrais (puro, testável). Trimestre no formato "2026-Q4"; datas ISO em São Paulo.
 */
import { diffDays, type ISODate } from "@/lib/dates";

export type GoalArea = "dinheiro" | "negocio" | "saude" | "mente" | "relacoes" | "aprendizado";
export type GoalStatus = "active" | "done" | "dropped";

export const AREAS: { value: GoalArea; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "negocio", label: "Negócio" },
  { value: "saude", label: "Saúde" },
  { value: "mente", label: "Mente" },
  { value: "relacoes", label: "Relações" },
  { value: "aprendizado", label: "Aprendizado" },
];

export const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value, a.label])) as Record<GoalArea, string>;

const QUARTER_RE = /^(\d{4})-Q([1-4])$/;

export function isQuarter(s: string | null | undefined): s is string {
  return !!s && QUARTER_RE.test(s);
}

/** "2026-11-13" → "2026-Q4". */
export function quarterOf(iso: ISODate): string {
  const month = Number(iso.slice(5, 7));
  return `${iso.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
}

export function addQuarters(q: string, n: number): string {
  const m = QUARTER_RE.exec(q);
  if (!m) throw new Error(`Trimestre inválido: ${q}`);
  const idx = Number(m[1]) * 4 + (Number(m[2]) - 1) + n;
  return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
}

/** Primeiro e último dia do trimestre. */
export function quarterRange(q: string): { start: ISODate; end: ISODate } {
  const m = QUARTER_RE.exec(q);
  if (!m) throw new Error(`Trimestre inválido: ${q}`);
  const y = Number(m[1]);
  const first = (Number(m[2]) - 1) * 3 + 1;
  const last = first + 2;
  const lastDay = new Date(Date.UTC(y, last, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start: `${y}-${pad(first)}-01`, end: `${y}-${pad(last)}-${pad(lastDay)}` };
}

/** "4º tri · out–dez 2026". */
export function quarterLabel(q: string): string {
  const m = QUARTER_RE.exec(q);
  if (!m) return q;
  const months = ["jan–mar", "abr–jun", "jul–set", "out–dez"][Number(m[2]) - 1];
  return `${m[2]}º tri · ${months} ${m[1]}`;
}

/** Quanto do trimestre já passou (0..1), contando hoje como dia corrido. */
export function quarterElapsed(q: string, today: ISODate): { day: number; total: number; pct: number } {
  const { start, end } = quarterRange(q);
  const total = diffDays(start, end) + 1;
  const day = Math.min(Math.max(diffDays(start, today) + 1, 0), total);
  return { day, total, pct: day / total };
}

/** Número digitado em pt-BR ("12,5", "1.200", "1.200,75") → number. Vazio = null; lixo = NaN. */
export function parseDecimal(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return Number.NaN;
  const lastComma = s.lastIndexOf(",");
  const normalized = lastComma >= 0 ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : Number.NaN;
}

const numFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export function formatDecimal(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : numFmt.format(n);
}

/** Progresso da métrica (0..1, pode passar de 1). Sem meta = null. */
export function metricProgress(current: number | null, target: number | null): number | null {
  if (target === null || target === 0) return null;
  return Math.max(0, (current ?? 0) / target);
}

/**
 * Ritmo: compara o progresso com o tempo do trimestre que já passou.
 * "frente" se ≥ tempo, "atras" se ficou mais de 10 pontos para trás, senão "perto".
 */
export function goalPace(progress: number | null, elapsed: number): "frente" | "perto" | "atras" | null {
  if (progress === null) return null;
  if (progress >= 1 || progress >= elapsed) return "frente";
  return elapsed - progress > 0.1 ? "atras" : "perto";
}
