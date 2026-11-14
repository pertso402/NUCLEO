"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Play, Plus, Square, Trash2 } from "lucide-react";
import { HudCard } from "@/components/hud/HudCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { addDays, startOfWeek, todayISO } from "@/lib/dates";
import type { TimeData } from "@/lib/data/routine";
import { entryMinutes, minutesByDay, minutesByLabel } from "@/lib/metrics/routine";
import { addTimeEntry, deleteTimeEntry, startTimer, stopTimer, type ActionResult } from "@/app/(app)/rotina/actions";

const field =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-white/[0.04] px-3 text-base text-text-0 placeholder:text-text-2 focus:border-plasma/60 focus:outline-none";

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function fmtMin(m: number): string {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? `${h}h${String(r).padStart(2, "0")}` : `${h}h`;
}

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Relógio que anda a cada segundo enquanto há timer aberto (começa no "agora" do servidor). */
function useNow(serverNow: string, running: boolean): Date {
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

export function TimePanel({ data, today, serverNow }: { data: TimeData; today: string; serverNow: string }) {
  const now = useNow(serverNow, Boolean(data.openTimer));
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const [showManual, setShowManual] = useState(false);

  const act = (fn: () => Promise<ActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) after?.();
      else setError(r.error);
    });
  };

  const open = data.openTimer;
  const days = minutesByDay(data.entries, today, now, 7);
  const todayMin = days.at(-1)?.minutes ?? 0;
  const goal = data.focusGoalMinutes;
  const pct = goal > 0 ? Math.min(todayMin / goal, 1) : 0;
  const max = Math.max(goal, ...days.map((d) => d.minutes), 1);
  const weekStart = startOfWeek(today);
  const labels = minutesByLabel(data.entries, weekStart, today, now);
  const weekTotal = labels.reduce((s, l) => s + l.minutes, 0);
  const recent = data.entries.filter((e) => e.ended_at).slice(0, 8);

  function submitStart(e: FormEvent) {
    e.preventDefault();
    act(() => startTimer(label), () => setLabel(""));
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <HudCard label="Timer" accent="plasma" className="lg:col-span-2">
        {open ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="num text-4xl font-medium text-plasma [text-shadow:0_0_14px_rgba(124,92,255,0.6)]" aria-live="off">
                {clock(now.getTime() - new Date(open.started_at).getTime())}
              </p>
              <p className="mt-1 truncate text-sm text-text-1">
                {open.label || "Sem rótulo"} · desde {timeFmt.format(new Date(open.started_at))}
              </p>
            </div>
            <Button
              onClick={() => act(() => stopTimer())}
              disabled={pending}
              variant="focus"
            >
              <Square size={16} strokeWidth={2} fill="currentColor" /> Parar
            </Button>
          </div>
        ) : (
          <form onSubmit={submitStart} className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="No que você vai focar?"
              aria-label="Rótulo do timer"
              maxLength={120}
              className={field}
            />
            <Button type="submit" disabled={pending} variant="focus" className="shrink-0">
              <Play size={16} strokeWidth={2} fill="currentColor" /> Iniciar
            </Button>
          </form>
        )}
        <div className="mt-4">
          <div className="num mb-1.5 flex items-baseline justify-between text-xs text-text-2">
            <span>
              Foco hoje <span className={cn("text-sm", todayMin > 0 ? "text-plasma" : "text-text-1")}>{fmtMin(todayMin)}</span>
            </span>
            <span>meta {fmtMin(goal)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div className="h-full origin-left rounded-full bg-plasma shadow-glow-plasma" style={{ transform: `scaleX(${pct})` }} />
          </div>
        </div>
      </HudCard>

      {error && (
        <p role="alert" className="text-sm text-flare lg:col-span-2">
          {error}
        </p>
      )}

      <HudCard label="Últimos 7 dias" accent="plasma">
        <div className="flex h-36 items-end gap-2" role="img" aria-label={`Foco por dia: ${days.map((d) => fmtMin(d.minutes)).join(", ")}`}>
          {days.map((d) => {
            const h = d.minutes / max;
            const isToday = d.date === today;
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="num text-[10px] text-text-2">{d.minutes ? fmtMin(d.minutes).replace(" min", "m") : ""}</span>
                <div className="relative w-full flex-1">
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 origin-bottom rounded-t-[4px]",
                      d.minutes >= goal && goal > 0 ? "bg-plasma shadow-glow-plasma" : "bg-plasma/45",
                    )}
                    style={{ height: "100%", transform: `scaleY(${h})` }}
                  />
                </div>
                <span className={cn("num text-[10px]", isToday ? "text-text-0" : "text-text-2")}>
                  {WD[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-text-2">
          {days.every((d) => d.minutes === 0)
            ? "Nenhum foco nos últimos 7 dias. Inicie o timer ou lance o tempo."
            : goal > 0 && `Barra acesa = bateu a meta de ${fmtMin(goal)}.`}
        </p>
      </HudCard>

      <HudCard label="Esta semana por rótulo" accent="plasma" action={<span className="num text-xs text-text-2">{fmtMin(weekTotal)}</span>}>
        {labels.length === 0 ? (
          <p className="text-sm text-text-2">Nenhum tempo registrado desde segunda.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {labels.slice(0, 8).map((l) => (
              <li key={l.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-text-1">{l.label}</span>
                  <span className="num shrink-0 text-text-0">{fmtMin(l.minutes)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/[0.06]">
                  <div className="h-full origin-left rounded-full bg-plasma/80" style={{ transform: `scaleX(${l.minutes / labels[0]!.minutes})` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </HudCard>

      <section className="lg:col-span-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="label-instrument">Registros</h2>
          {!showManual && (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-text-1 transition-[color,border-color,transform] duration-150 hover:border-line-strong hover:text-text-0 active:scale-95"
            >
              <Plus size={16} strokeWidth={2} /> Lançar tempo
            </button>
          )}
        </div>
        {showManual && <ManualEntry today={today} onDone={() => setShowManual(false)} onError={setError} />}
        {recent.length === 0 ? (
          <p className="text-sm text-text-2">Nada registrado ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {recent.map((e) => {
              const day = todayISO(new Date(e.started_at));
              const dayText = day === today ? "hoje" : day === addDays(today, -1) ? "ontem" : `${day.slice(8, 10)}/${day.slice(5, 7)}`;
              return (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-1">{e.label || "Sem rótulo"}</span>
                    <span className="num text-xs text-text-2">
                      {dayText} · {timeFmt.format(new Date(e.started_at))}–{timeFmt.format(new Date(e.ended_at!))}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm text-text-0">{fmtMin(entryMinutes(e, now))}</span>
                  <DeleteEntry onDelete={() => act(() => deleteTimeEntry(e.id))} disabled={pending} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DeleteEntry({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={confirm ? "Confirmar exclusão" : "Excluir registro"}
      onClick={() => (confirm ? onDelete() : setConfirm(true))}
      onBlur={() => setConfirm(false)}
      className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-text-2 transition-[color,transform] duration-150 hover:text-flare active:scale-90"
    >
      <Trash2 size={14} strokeWidth={1.5} />
      {confirm && "Excluir"}
    </button>
  );
}

function ManualEntry({ today, onDone, onError }: { today: string; onDone: () => void; onError: (e: string | null) => void }) {
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(today);
  const [pending, start] = useTransition();
  const n = Number(minutes);

  function submit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    start(async () => {
      const r = await addTimeEntry({ label, minutes: n, date });
      if (r.ok) onDone();
      else onError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="glass edge-light mb-3 flex flex-col gap-2.5 rounded-md border border-plasma/30 p-3">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="No que trabalhou" aria-label="Rótulo" maxLength={120} className={field} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Minutos</span>
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="90"
            className={cn(field, "num")}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label-instrument">Dia</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={cn(field, "num")} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !(n >= 1 && n <= 1440)} variant="focus">
          Lançar
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
