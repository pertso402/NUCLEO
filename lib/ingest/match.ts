/**
 * Acha um item (tarefa, hábito, objetivo) pelo que o Peter falou, sem acento/caixa.
 * Ordem: igual → contém (num sentido ou no outro) → mais palavras em comum.
 * Empate entre os melhores = ambíguo (o executor pergunta qual).
 */
export type MatchResult<T> = { item: T } | { ambiguous: T[] } | null;

const STOP = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "pra", "pro", "para", "com", "um", "uma", "que", "ao", "à",
]);

export function normalizeRef(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(s: string): string[] {
  return normalizeRef(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** "academia" casa "academias"; "lendo" não casa "leitura" (isso fica com o modelo). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s) && l.length - s.length <= 2;
}

export function matchByName<T>(items: readonly T[], ref: string, name: (t: T) => string): MatchResult<T> {
  const r = normalizeRef(ref);
  if (!r || items.length === 0) return null;

  const pick = (list: T[]): MatchResult<T> =>
    list.length === 1 ? { item: list[0]! } : list.length > 1 ? { ambiguous: list } : null;

  const exact = items.filter((t) => normalizeRef(name(t)) === r);
  if (exact.length) return pick(exact);

  const contains = items.filter((t) => {
    const n = normalizeRef(name(t));
    return n.includes(r) || r.includes(n);
  });
  if (contains.length) return pick(contains);

  const refWords = words(ref);
  if (!refWords.length) return null;
  let best = 0;
  let winners: T[] = [];
  for (const t of items) {
    const tw = words(name(t));
    const common = refWords.filter((w) => tw.some((x) => sameWord(w, x))).length;
    // precisa casar ao menos metade das palavras do que foi dito
    if (common === 0 || common * 2 < refWords.length) continue;
    if (common > best) {
      best = common;
      winners = [t];
    } else if (common === best) {
      winners.push(t);
    }
  }
  return pick(winners);
}
