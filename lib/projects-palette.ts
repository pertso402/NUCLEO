/**
 * Paleta categórica de projetos (DESIGN §2b): só para distinguir projetos em listas e gráficos.
 * Não são cores de sinal — Volt/Ember/Flare/Gold continuam com o significado delas.
 * Tons neon médios, legíveis sobre --bg-0..2.
 */
export const PROJECT_COLORS = {
  violet: { hex: "#A78BFA", label: "Violeta" },
  cyan: { hex: "#22D3EE", label: "Ciano" },
  lime: { hex: "#A3E635", label: "Lima" },
  amber: { hex: "#FBBF24", label: "Âmbar" },
  pink: { hex: "#F472B6", label: "Rosa" },
  teal: { hex: "#2DD4BF", label: "Turquesa" },
  blue: { hex: "#60A5FA", label: "Azul" },
  orange: { hex: "#FB923C", label: "Laranja" },
} as const;

export type ProjectColor = keyof typeof PROJECT_COLORS;
export const PROJECT_COLOR_KEYS = Object.keys(PROJECT_COLORS) as ProjectColor[];

/** Tempo/tarefa sem projeto: cinza de metadado (--text-2). */
export const NO_PROJECT_HEX = "#5E6678";

export function projectHex(color: string | null | undefined): string {
  return color && color in PROJECT_COLORS ? PROJECT_COLORS[color as ProjectColor].hex : NO_PROJECT_HEX;
}

export type ProjectKind = "negocio" | "cliente" | "projeto" | "pessoal" | "estudo";

export const PROJECT_KINDS: { value: ProjectKind; label: string }[] = [
  { value: "negocio", label: "Negócio" },
  { value: "cliente", label: "Cliente" },
  { value: "projeto", label: "Projeto" },
  { value: "pessoal", label: "Pessoal" },
  { value: "estudo", label: "Estudo" },
];
export const PROJECT_KIND_LABEL = Object.fromEntries(PROJECT_KINDS.map((k) => [k.value, k.label])) as Record<ProjectKind, string>;

/** Próxima cor livre (para sugerir ao criar). */
export function nextFreeColor(used: readonly string[]): ProjectColor {
  return PROJECT_COLOR_KEYS.find((c) => !used.includes(c)) ?? PROJECT_COLOR_KEYS[used.length % PROJECT_COLOR_KEYS.length]!;
}
