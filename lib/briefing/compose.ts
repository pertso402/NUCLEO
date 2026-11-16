/**
 * Mensagens automáticas do WhatsApp (ARCHITECTURE §8). Os números vêm todos do servidor;
 * a OpenAI só reescreve o texto (writer.ts). Aqui ficam os fatos, a versão de reserva
 * (sem IA) e a lista do que o texto final é obrigado a conter — se a IA "arredondar" um
 * valor ou esquecer uma tarefa, a mensagem cai para a versão de reserva.
 */

export interface MilestoneFacts {
  title: string;
  current: string;
  target: string;
  remaining: string;
  pct: number;
  achieved: boolean;
  onTrack: boolean;
  neededPerDay: string;
  bdLeft: number;
}

export interface BriefingFacts {
  kind: "briefing";
  /** "sexta-feira, 13 de novembro" */
  dateLabel: string;
  milestone: MilestoneFacts | null;
  /** Até 3 tarefas que mexem faturamento, já com o prazo ("Proposta Gelato (hoje)"). */
  revenueTasks: string[];
  /** Todas as tarefas abertas com prazo até hoje (inclui as de faturamento). */
  tasksDueCount: number;
  /** Hábitos previstos para hoje. */
  habits: string[];
  /** Meta de abordagens de hoje (0 = sem meta) e se veio do funil reverso. */
  outreachGoal: number;
  outreachAuto: boolean;
  /** "4h" (vazio se o dia não é útil). */
  focusGoal: string;
  principle: string | null;
}

export interface ClosingFacts {
  kind: "closing";
  dateLabel: string;
  score: number;
  revenueDone: number;
  revenuePlanned: number;
  focus: string;
  focusGoal: string;
  habitsDone: number;
  habitsExpected: number;
  outreachDone: number;
  outreachGoal: number;
  /** Receita lançada hoje ("R$ 1.500") ou null se nada entrou. */
  incomeToday: string | null;
  milestone: MilestoneFacts | null;
  /** Tarefas com prazo amanhã. */
  tomorrowCount: number;
  reviewUrl: string;
}

export interface WeeklyFacts {
  kind: "weekly";
  /** "09/11 – 15/11" */
  weekLabel: string;
  income: string;
  incomePrev: string;
  expense: string;
  net: string;
  focus: string;
  focusPrev: string;
  revenueTasksDone: number;
  revenueTasksPrev: number;
  /** "18/24" ou "" se não há hábitos. */
  habits: string;
  avgScore: number | null;
  avgScorePrev: number | null;
  milestone: MilestoneFacts | null;
  reviewUrl: string;
}

export interface FollowupFacts {
  kind: "followups";
  items: { who: string; text: string; kind: "overdue" | "today" | "stale" }[];
  pipelineUrl: string;
}

export type MessageFacts = BriefingFacts | ClosingFacts | WeeklyFacts | FollowupFacts;

function milestoneLines(m: MilestoneFacts): string[] {
  if (m.achieved) return [`🏆 Marco "${m.title}" batido: ${m.current} de ${m.target}.`];
  const line = `📈 ${m.title}: ${m.current} de ${m.target} (${m.pct}%) · faltam ${m.remaining}`;
  const pace = m.onTrack
    ? `✅ No ritmo. ${m.neededPerDay}/dia útil fecha o marco.`
    : `⚠️ Abaixo do ritmo: precisa de ${m.neededPerDay}/dia útil (${m.bdLeft} ${m.bdLeft === 1 ? "dia útil" : "dias úteis"}).`;
  return [line, pace];
}

export function fallbackBriefing(f: BriefingFacts): string {
  const lines = [`☀️ Bom dia, Peter. ${capitalize(f.dateLabel)}.`];
  if (f.milestone) lines.push("", ...milestoneLines(f.milestone));
  lines.push("");
  if (f.revenueTasks.length) {
    lines.push("💰 Movem faturamento hoje:", ...f.revenueTasks.map((t, i) => `${i + 1}. ${t}`));
  } else {
    lines.push("💰 Nenhuma tarefa de faturamento na fila. Qual é o próximo passo pra entrar dinheiro?");
  }
  if (f.outreachGoal > 0) lines.push(`📣 Meta de abordagens: ${f.outreachGoal}${f.outreachAuto ? " (pelo funil reverso)" : ""}.`);
  const others = f.tasksDueCount - f.revenueTasks.length;
  if (others > 0) lines.push(`📋 Mais ${others} ${others === 1 ? "tarefa" : "tarefas"} pra hoje.`);
  if (f.habits.length) lines.push(`🔁 Hábitos: ${f.habits.join(", ")}.`);
  if (f.focusGoal) lines.push(`⏱️ Meta de foco: ${f.focusGoal}.`);
  if (f.principle) lines.push("", `🧭 ${f.principle}`);
  return lines.join("\n");
}

export function fallbackClosing(f: ClosingFacts): string {
  const lines = [`🌙 Fechamento de ${f.dateLabel}: score ${f.score}/100.`, ""];
  lines.push(`💰 Tarefas de faturamento: ${f.revenueDone}${f.revenuePlanned ? `/${Math.min(f.revenuePlanned, 3)}` : ""}`);
  if (f.outreachGoal > 0 || f.outreachDone > 0) {
    lines.push(`📣 Abordagens: ${f.outreachDone}${f.outreachGoal > 0 ? `/${f.outreachGoal}` : ""}`);
  }
  if (f.focusGoal) lines.push(`⏱️ Foco: ${f.focus} de ${f.focusGoal}`);
  if (f.habitsExpected) lines.push(`🔁 Hábitos: ${f.habitsDone}/${f.habitsExpected}`);
  if (f.incomeToday) lines.push(`✅ Entrou hoje: ${f.incomeToday}`);
  if (f.milestone) lines.push("", ...milestoneLines(f.milestone));
  if (f.tomorrowCount) lines.push("", `📋 Amanhã: ${f.tomorrowCount} ${f.tomorrowCount === 1 ? "tarefa" : "tarefas"} com prazo.`);
  lines.push("", `Revisão rápida (60s): ${f.reviewUrl}`);
  return lines.join("\n");
}

export function fallbackWeekly(f: WeeklyFacts): string {
  const lines = [`📅 Semana ${f.weekLabel}`, ""];
  lines.push(`💰 Receita: ${f.income} (semana anterior: ${f.incomePrev})`);
  lines.push(`💸 Despesa: ${f.expense} · saldo ${f.net}`);
  lines.push(`⏱️ Foco: ${f.focus} (antes: ${f.focusPrev})`);
  lines.push(`✅ Tarefas de faturamento: ${f.revenueTasksDone} (antes: ${f.revenueTasksPrev})`);
  if (f.habits) lines.push(`🔁 Hábitos: ${f.habits}`);
  if (f.avgScore !== null) lines.push(`📊 Score médio: ${f.avgScore}${f.avgScorePrev !== null ? ` (antes: ${f.avgScorePrev})` : ""}`);
  if (f.milestone) lines.push("", ...milestoneLines(f.milestone));
  lines.push("", "Fecha a semana: vitórias, o que não deu certo e o foco da próxima.", `Revisão semanal: ${f.reviewUrl}`);
  return lines.join("\n");
}

/** Lembrete de follow-ups (dias úteis 13:30). Lista direta, sem IA: é um checklist. */
export function fallbackFollowups(f: FollowupFacts): string {
  const icon = { overdue: "⚠️", today: "•", stale: "💤" } as const;
  const lines = [`📌 Follow-ups pendentes (${f.items.length})`, ""];
  for (const i of f.items.slice(0, 10)) lines.push(`${icon[i.kind]} ${i.who}: ${i.text}`);
  if (f.items.length > 10) lines.push(`… e mais ${f.items.length - 10}`);
  lines.push("", 'Feito? Responda "fiz o follow-up do <nome>, próximo passo …" ou abra:', f.pipelineUrl);
  return lines.join("\n");
}

export function fallbackMessage(f: MessageFacts): string {
  if (f.kind === "briefing") return fallbackBriefing(f);
  if (f.kind === "closing") return fallbackClosing(f);
  if (f.kind === "weekly") return fallbackWeekly(f);
  return fallbackFollowups(f);
}

/** Trechos que o texto final precisa conter, exatamente. */
export function mustInclude(f: MessageFacts): string[] {
  const out: string[] = [];
  if (f.kind !== "followups" && f.milestone) {
    out.push(f.milestone.current);
    if (!f.milestone.achieved) out.push(f.milestone.remaining, f.milestone.neededPerDay);
  }
  if (f.kind === "briefing") {
    // títulos sem o prazo entre parênteses
    out.push(...f.revenueTasks.map((t) => t.replace(/\s*\([^)]*\)$/, "")));
  } else if (f.kind === "closing") {
    out.push(`${f.score}`, f.reviewUrl);
    if (f.incomeToday) out.push(f.incomeToday);
  } else if (f.kind === "weekly") {
    out.push(f.income, f.reviewUrl);
  } else {
    out.push(...f.items.map((i) => i.who), f.pipelineUrl);
  }
  return out;
}

/** O texto da IA serve? Tem tudo o que precisa e não estourou o tamanho. */
export function acceptGenerated(text: string, f: MessageFacts, maxChars = 1200): boolean {
  const t = text.trim();
  if (!t || t.length > maxChars) return false;
  return mustInclude(f).every((piece) => t.includes(piece));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
