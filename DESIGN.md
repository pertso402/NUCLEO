# DESIGN.md — NÚCLEO · Design System "Obsidiana Volt" (v2 · Neon)

## 1. Conceito
Um **HUD de comando**: fundo de obsidiana quase preto, linhas finas de grade como num painel de instrumentos,
e luz só onde existe progresso. A regra estética:

> **O brilho é conquistado.** Elementos parados são sóbrios (cinza, linhas finas).
> Só o que representa avanço — receita entrando, marco subindo, streak viva — acende em Volt.

**v2 · Neon (13/11/2026, pedido do Peter: "mais cyberpunk, mais luz, menos quadrado, menos apagado").**
O ambiente agora tem luz: o fundo ganha luzes de neon difusas (Volt, Plasma, Ion) que derivam devagar,
linhas de varredura e um horizonte de luz no topo; cards são de **vidro** (translúcidos com desfoque) com
um **filete de luz** no topo; cantos e raios maiores; números de receita/progresso em **texto neon**
(com halo). A regra do brilho continua valendo para os *sinais*: Volt neon só onde há avanço.

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
| `--line` | `rgba(255,255,255,0.07)` | bordas padrão |
| `--line-strong` | `rgba(255,255,255,0.14)` | bordas de foco, divisores importantes |
| `--glass` | `rgba(14,17,26,0.72)` | cards de vidro (com `backdrop-filter: blur(16px) saturate(140%)`) |
| `--glass-strong` | `rgba(20,24,36,0.86)` | fallback sem `backdrop-filter` |

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

Glows em duas camadas (núcleo + halo): `--glow-volt`, `--glow-plasma`, `--glow-ion`, `--glow-flare`, `--glow-gold`
(ex.: `0 0 12px rgba(200,255,46,.55), 0 0 36px rgba(200,255,46,.25)`). Usados em: arco do anel, barras de progresso,
aba/item de navegação ativo, botão primário, botão de captura, cantos de mira no ritmo, gráficos.
Texto neon: `.neon-volt`, `.neon-flare`, `.neon-gold` (cor + text-shadow) e `.neon-white` (halo branco leve para títulos e números hero).

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
- Raios (v2, menos quadrado): 10px (inputs, botões, itens) · 18px (cards) · 26px (sheets, doca, hero). Chips, segmentados e filtros em **pílula** (totalmente arredondados).
- Bordas 1px `--line` + `.edge-light` (filete interno claro no topo). Profundidade vem de vidro, borda e luz; sombra escura só sob elementos flutuantes (doca).

## 5. Assinaturas visuais
1. **Fundo (`GridBackground`)**: 3 luzes de neon difusas (gradientes radiais Volt/Plasma/Ion, sem `filter: blur`) derivando em 24–36s só com `transform`; grade de 32px com máscara radial; horizonte de luz de 1px no topo; linhas de varredura; ruído 3,5%. Fixo, atrás de tudo.
2. **Cantos de mira (`HudCard variant="target"`)**: 4 cantos em "L" de 14px, 2px, arredondados; ficam Volt **com glow** quando o card representa algo no ritmo. Usar só no hero e em 1–2 cards-chave.
3. **Anel de progresso (`RingProgress`)** em estilo gauge: escala externa de 60 marcas (as de 5 em 5 maiores) que acendem até o progresso, anel interno tracejado, trilho levemente Volt, arco em gradiente com glow duplo e **ponto de luz na ponta**, brilho radial no miolo, tick de "onde deveria estar hoje" (Volt fino ou Ember com glow). No centro: valor atual (Geist Mono, halo branco) + "de R$ X" + % neon.
3b. **Cards de vidro (`HudCard`)**: vidro + borda + `.edge-light` + filete de luz no topo na cor do conteúdo (`accent`: volt receita, plasma categorias/objetivos, ion informação, flare despesa, gold só conquista) e ponto colorido com glow ao lado do label. Em listas longas (extrato), sem desfoque (`bg-bg-2/80`) por performance.
4. **Ticker de números (`StatTicker`)**: ao entrar receita, o número sobe contando (600ms, ease-out). Dígitos tabulares para não "pular".
5. **Barra de ritmo**: barra horizontal fina com duas marcas — "onde você está" (Volt) e "onde deveria estar" (linha `--text-2`). Diferença colorida (Volt se à frente, Ember se atrás).
6. **Varredura (`scan`)**: ao carregar o Comando, uma linha de luz percorre o anel uma vez (900ms). Só uma vez por sessão.

## 6. Movimento
- Biblioteca: Motion. Animar só `transform`/`opacity`.
- Durações: 150ms (hover/press) · 180ms (entrada de tela) · 250ms (entradas) · 600ms (ticker) · 900ms (scan).
- **Resposta ao toque no mesmo frame**: tudo que é tocável tem `active:scale` (0.90–0.99); a aba acende no toque (otimista), a tela troca na hora por um esqueleto (`loading.tsx` com brilho passando) e abas já visitadas vêm do cache (`staleTimes`) com dados atualizados pelo Realtime.
- Ambiente: luzes do fundo derivam (24–36s), halo do botão de captura e ponto do logo pulsam (2,4s, só opacity).
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
| `CaptureButton` | botão flutuante 56px, Volt com glow e halo pulsando, acima da doca; segurar = gravar, soltar = enviar; toque rápido = abre campo de texto. Pulso Volt enquanto grava. |
| `CommandPalette` | Ctrl/Cmd+K, sheet central `--bg-2`, input Geist Mono, mostra a resposta do ingest inline. |
| `HudCard` | `--bg-2`, borda `--line`, raio 12, padding 16; label de seção no topo. |
| `StatTile` | label (instrumento) + número Geist Mono + delta (Volt ↑ / Flare ↓) + sparkline opcional. |
| `Chip` | stage do lead (Ion), categoria (`--bg-3`), alerta (Ember). |
| `KanbanColumn` | header com contagem e soma de valor; cards com próxima ação e data (Ember se atrasado). |
| `HabitHeatmap` | 12 semanas × 7 dias, células 12px, vazio `--bg-3`, feito Volt (opacidade por intensidade), recorde em Gold. |
| `TabBar` | **doca de vidro flutuante** (12px das bordas, raio 26, sombra escura), respeita safe-area; ativo = ícone Volt com glow + barra de luz no topo da aba. |

Ícones: Lucide, traço 1.5px, 20px. Sem emoji na UI (no WhatsApp pode).

## 8. Gráficos (Recharts customizado)
- Sem fundo, sem grid vertical; grid horizontal `--line` tracejado.
- Eixos `--text-2`, Geist Mono 11px.
- Receita = Volt, despesa = Flare.
- Tooltip `--bg-3` com borda `--line-strong`.
- Barras com raio 4 no topo; linha de receita acumulada com gradiente Volt → transparente embaixo.
- v2: linhas e barras com glow neon (`drop-shadow` duplo na cor da série, classes `.chart-glow-volt` / `.chart-glow-flare`).

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
- Gradientes coloridos de fundo genéricos em tela cheia (roxo→azul de SaaS). As luzes difusas do `GridBackground` são a única luz ambiente.
- Vidro com desfoque em listas longas ou em dezenas de elementos (custo no iPhone 11 Pro). Vidro é para cards, doca, sidebar e palette, sempre com fallback sólido.
- Cores de sinal usadas como decoração.
- Gold fora de conquistas.
- Fontes além das três definidas.
