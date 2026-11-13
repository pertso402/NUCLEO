# DESIGN.md — NÚCLEO · Design System "Obsidiana Volt"

## 1. Conceito
Um **HUD de comando**: fundo de obsidiana quase preto, linhas finas de grade como num painel de instrumentos,
e luz só onde existe progresso. A regra estética:

> **O brilho é conquistado.** Elementos parados são sóbrios (cinza, linhas finas).
> Só o que representa avanço — receita entrando, marco subindo, streak viva — acende em Volt.

Referências de sensação: painel de cockpit, terminal de missão espacial, telemetria de F1. Nada de
"tela de banco" nem dashboard genérico de SaaS. Dark-only, por decisão de identidade.

## 2. Paleta (tokens em `:root`, Tailwind lê via CSS vars)

### Superfícies
| token | hex | uso |
|---|---|---|
| `--bg-0` | `#05060A` | fundo do app, theme-color da PWA |
| `--bg-1` | `#0A0C12` | áreas de seção, sidebar, tab bar |
| `--bg-2` | `#11141C` | cards |
| `--bg-3` | `#181C27` | hover, inputs, card elevado |
| `--line` | `rgba(255,255,255,0.06)` | bordas padrão, grade de fundo |
| `--line-strong` | `rgba(255,255,255,0.12)` | bordas de foco, divisores importantes |

### Texto
| token | hex | uso |
|---|---|---|
| `--text-0` | `#F2F4F8` | números hero, títulos |
| `--text-1` | `#A3ABBD` | texto corrido, labels |
| `--text-2` | `#5E6678` | metadados, legendas, eixos de gráfico |

### Sinais (cada cor tem UM significado — nunca usar decorativamente)
| token | hex | significado |
|---|---|---|
| `--volt` | `#C8FF2E` | **receita, progresso, ação primária, "no ritmo"** |
| `--volt-dim` | `#C8FF2E1F` | fundo de chip/área Volt (12%) |
| `--plasma` | `#7C5CFF` | foco, tempo, objetivos |
| `--ion` | `#2EE6FF` | pipeline/CRM, informação |
| `--ember` | `#FF8A2A` | atenção: follow-up atrasado, abaixo do ritmo |
| `--flare` | `#FF3D6E` | despesa, perda, erro |
| `--gold` | `#FFD24A` | **somente** marco batido e recordes de streak |

Glows (usar com parcimônia, máx. 1–2 por tela):
`--glow-volt: 0 0 24px rgba(200,255,46,.35)` · `--glow-plasma: 0 0 24px rgba(124,92,255,.35)` · `--glow-gold: 0 0 32px rgba(255,210,74,.45)`

Contraste: `--text-0`/`--text-1` sobre `--bg-0..2` ≥ 4.5:1. Texto **sobre** Volt sempre `--bg-0` (Volt é claro).

## 3. Tipografia
| papel | fonte | uso |
|---|---|---|
| Display | **Unbounded** (600/700) — `next/font/google` | títulos de tela curtos, nome do marco, valor hero ≥ 40px |
| Texto | **Geist** (400/500/600) — pacote `geist` | interface, parágrafos, botões |
| Números | **Geist Mono** (500) + `font-variant-numeric: tabular-nums` | todo valor, percentual, hora, contador |

Escala (px): 12 · 14 · 16 · 20 · 24 · 32 · 48 · 64. Hero do Comando: 48 no mobile, 64 no desktop.
Labels de seção: Geist 12px, `uppercase`, `letter-spacing: .12em`, `--text-2` (estilo instrumento).
Moeda: o "R$" em tamanho 50% do número e `--text-1`; centavos em `--text-2`.

## 4. Espaço, forma e grade
- Base 4px. Espaçamentos: 4, 8, 12, 16, 24, 32, 48.
- Gutter lateral mobile: 16px. Conteúdo desktop: máx. 1280px.
- Raios: 6px (chips, inputs) · 12px (cards) · 20px (sheets, hero). Nada totalmente arredondado exceto avatares e botão de captura.
- Bordas 1px `--line`. Sem sombras pretas — profundidade vem de `--bg-*` e borda.

## 5. Assinaturas visuais
1. **Grade de fundo (`GridBackground`)**: grade de 32px com linhas `--line`, máscara radial (some nas bordas). Fixa, atrás de tudo. Ruído sutil (SVG noise, 3% opacidade).
2. **Cantos de mira (`HudCard variant="target"`)**: 4 cantos em "L" de 10px, 1px, `--line-strong`; ficam Volt quando o card representa algo no ritmo. Usar só no hero e em 1–2 cards-chave.
3. **Anel de progresso (`RingProgress`)**: anel de 240px (mobile) com trilho `--line`, arco Volt com glow, marcação de "onde deveria estar hoje" (tick Ember ou Volt fino no anel conforme o ritmo). No centro: valor atual (Geist Mono) + "de R$ X".
4. **Ticker de números (`StatTicker`)**: ao entrar receita, o número sobe contando (600ms, ease-out). Dígitos tabulares para não "pular".
5. **Barra de ritmo**: barra horizontal fina com duas marcas — "onde você está" (Volt) e "onde deveria estar" (linha `--text-2`). Diferença colorida (Volt se à frente, Ember se atrás).
6. **Varredura (`scan`)**: ao carregar o Comando, uma linha de luz percorre o anel uma vez (900ms). Só uma vez por sessão.

## 6. Movimento
- Biblioteca: Motion. Animar só `transform`/`opacity`.
- Durações: 150ms (hover/press) · 250ms (entradas) · 600ms (ticker) · 900ms (scan).
- Easing padrão: `cubic-bezier(.2,.8,.2,1)`.
- Listas entram com stagger de 30ms, máx. 8 itens animados.
- `prefers-reduced-motion`: remover scan, ticker vira troca direta, sem stagger.

### Celebração de marco batido
Tela cheia sobre `--bg-0` 92%: anel completa e vira Gold com `--glow-gold`, título do marco em Unbounded 48px,
linha "Batido em DD/MM · N dias", partículas leves (canvas, ≤ 60 partículas, 1.6s). Botão "Próximo marco →".
Gold não aparece em nenhum outro contexto — tem que ser raro para ter peso.

## 7. Componentes base
| componente | notas |
|---|---|
| `Button` | primário: fundo Volt, texto `--bg-0`, hover com `--glow-volt`. Secundário: `--bg-3` + borda `--line-strong`. Fantasma: só texto `--text-1`. Altura 44px (alvo de toque). |
| `CaptureButton` | botão flutuante 56px, Volt, ícone de microfone; segurar = gravar, soltar = enviar; toque rápido = abre campo de texto. Pulso Volt enquanto grava. |
| `CommandPalette` | Ctrl/Cmd+K, sheet central `--bg-2`, input Geist Mono, mostra a resposta do ingest inline. |
| `HudCard` | `--bg-2`, borda `--line`, raio 12, padding 16; label de seção no topo. |
| `StatTile` | label (instrumento) + número Geist Mono + delta (Volt ↑ / Flare ↓) + sparkline opcional. |
| `Chip` | stage do lead (Ion), categoria (`--bg-3`), alerta (Ember). |
| `KanbanColumn` | header com contagem e soma de valor; cards com próxima ação e data (Ember se atrasado). |
| `HabitHeatmap` | 12 semanas × 7 dias, células 12px, vazio `--bg-3`, feito Volt (opacidade por intensidade), recorde em Gold. |
| `TabBar` | `--bg-1` com borda superior `--line`; ativo = ícone Volt + ponto de 4px; respeita safe-area do iPhone. |

Ícones: Lucide, traço 1.5px, 20px. Sem emoji na UI (no WhatsApp pode).

## 8. Gráficos (Recharts customizado)
- Sem fundo, sem grid vertical; grid horizontal `--line` tracejado.
- Eixos `--text-2`, Geist Mono 11px.
- Receita = Volt, despesa = Flare.
- Tooltip `--bg-3` com borda `--line-strong`.
- Barras com raio 4 no topo; linha de receita acumulada com gradiente Volt → transparente embaixo.

## 9. Layouts-chave

**Comando (mobile, de cima pra baixo)**
1. Topo: saudação curta + data · score do dia (número Geist Mono em anel pequeno).
2. Hero: anel do marco, "faltam R$ X", barra de ritmo, linha de projeção.
3. Faixa Hoje: 3 `StatTile` em linha (Abordagens · Foco · Hábitos).
4. "Movem faturamento hoje" — 3 tarefas.
5. Follow-ups.
6. Princípio do dia — card com cantos de mira, texto em Geist 16px itálico, `--text-1`.

**Desktop**: sidebar 240px · Comando em grid 12 colunas (hero 7 col + coluna direita 5 col com Hoje/Follow-ups/Princípio).

## 10. PWA / ícone
- Ícone: monograma "N" geométrico em Unbounded, Volt sobre `--bg-0`, com um arco de anel parcial em volta (75%). Gerar 180/192/512 + maskable.
- `theme_color` e `background_color`: `#05060A`. Status bar iOS: `black-translucent`.

## 11. Proibido
- Gradientes coloridos de fundo (roxo→azul genérico).
- Glassmorphism em todo lugar (só na command palette e na tab bar, e com fallback sólido).
- Cores de sinal usadas como decoração.
- Gold fora de conquistas.
- Fontes além das três definidas.
