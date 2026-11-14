// NÚCLEO · widget para o Scriptable (iPhone).
// Mostra o marco em destaque (barra com "onde deveria estar hoje"), quanto falta, o ritmo
// necessário e o dia (score, foco, hábitos). Toque no widget abre o app.
// Passo a passo: integrations/scriptable/README.md
//
// O token NÃO fica neste arquivo: na primeira vez que você rodar o script dentro do
// Scriptable, ele pede o token e guarda no Keychain do iPhone.

const BASE_URL = "https://nucleo-beta.vercel.app";
const TOKEN_KEY = "nucleo_token";
const CACHE_FILE = "nucleo-widget-cache.json";
const REFRESH_MIN = 15;

// Tokens do DESIGN.md (Obsidiana Volt).
const C = {
  bg0: new Color("#05060A"),
  bg1: new Color("#0A0C12"),
  track: new Color("#C8FF2E", 0.12),
  volt: new Color("#C8FF2E"),
  plasma: new Color("#7C5CFF"),
  ember: new Color("#FF8A2A"),
  gold: new Color("#FFD24A"),
  text0: new Color("#F2F4F8"),
  text1: new Color("#A3ABBD"),
  text2: new Color("#5E6678"),
};

// ------------------------------------------------------------------ formatação

/** Centavos → "R$ 6.200" (reais inteiros; o widget não mostra centavos). */
function brl(cents) {
  const reais = Math.round(Math.abs(cents) / 100);
  const s = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (cents < 0 ? "-" : "") + "R$ " + s;
}

/** Minutos → "2h45" / "45m". */
function mins(m) {
  const v = Math.max(0, Math.round(m));
  if (v < 60) return v + "m";
  const h = Math.floor(v / 60);
  const r = v % 60;
  return r ? h + "h" + String(r).padStart(2, "0") : h + "h";
}

function hhmm(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ------------------------------------------------------------------ dados

async function askToken() {
  const a = new Alert();
  a.title = "Token do NÚCLEO";
  a.message = "Cole o NUCLEO_API_TOKEN. Ele fica guardado só no Keychain deste iPhone.";
  a.addSecureTextField("token");
  a.addAction("Salvar");
  a.addCancelAction("Cancelar");
  const i = await a.present();
  if (i === -1) return null;
  const t = a.textFieldValue(0).trim();
  if (t) Keychain.set(TOKEN_KEY, t);
  return t || null;
}

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
}

function readCache() {
  try {
    const fm = FileManager.local();
    const p = cachePath();
    return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null;
  } catch {
    return null;
  }
}

/** Busca os números; se a rede falhar, usa o último resultado guardado (marcado como offline). */
async function load(token) {
  try {
    const req = new Request(BASE_URL + "/api/widget");
    req.headers = { "x-nucleo-token": token };
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    const status = req.response ? req.response.statusCode : 200;
    if (status === 401) return { error: "Token inválido. Rode o script no app para trocar." };
    if (status !== 200 || data.error) throw new Error(data.error || "HTTP " + status);
    FileManager.local().writeString(cachePath(), JSON.stringify(data));
    return { data, offline: false };
  } catch {
    const cached = readCache();
    if (cached) return { data: cached, offline: true };
    return { error: "Sem conexão com o NÚCLEO." };
  }
}

// ------------------------------------------------------------------ desenho

/** Barra do marco: trilho, progresso (Volt, Gold se batido) e marca de "onde deveria estar hoje". */
function progressBar(d, width, height) {
  const dc = new DrawContext();
  dc.size = new Size(width, height + 4);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const y = 2;
  const r = height / 2;

  const track = new Path();
  track.addRoundedRect(new Rect(0, y, width, height), r, r);
  dc.addPath(track);
  dc.setFillColor(C.track);
  dc.fillPath();

  const pct = Math.max(0, Math.min(d.pct || 0, 1));
  if (pct > 0) {
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, y, Math.max(width * pct, height), height), r, r);
    dc.addPath(fill);
    dc.setFillColor(d.achieved ? C.gold : C.volt);
    dc.fillPath();
  }

  if (!d.achieved && d.expected_pct > 0 && d.expected_pct < 1) {
    const x = Math.round(width * d.expected_pct);
    dc.setFillColor(d.on_track ? C.text0 : C.ember);
    dc.fillRect(new Rect(x - 1, 0, 2, height + 4));
  }
  return dc.getImage();
}

function text(stack, value, opts) {
  const t = stack.addText(value);
  t.textColor = opts.color || C.text0;
  t.font = opts.font || Font.systemFont(12);
  t.lineLimit = opts.lines || 1;
  t.minimumScaleFactor = opts.scale || 0.7;
  return t;
}

function label(stack, value) {
  return text(stack, value.toUpperCase(), { color: C.text2, font: Font.mediumSystemFont(9) });
}

function build(result, family) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.bg1, C.bg0];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);
  w.url = BASE_URL;
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);

  if (result.error) {
    label(w, "NÚCLEO");
    w.addSpacer(6);
    text(w, result.error, { color: C.text1, font: Font.systemFont(12), lines: 3 });
    return w;
  }

  const d = result.data;
  const small = family === "small";

  // topo: marca + score do dia
  const top = w.addStack();
  top.centerAlignContent();
  label(top, "NÚCLEO");
  top.addSpacer();
  label(top, result.offline ? "offline · " + hhmm(d.updated_at) : "score ");
  if (!result.offline) {
    text(top, String(d.score_today), {
      color: d.score_today >= 70 ? C.volt : C.text0,
      font: Font.semiboldMonospacedSystemFont(11),
    });
  }
  w.addSpacer(small ? 6 : 8);

  if (!d.milestone_title) {
    text(w, "Nenhum marco ativo", { color: C.text1, font: Font.mediumSystemFont(13) });
    w.addSpacer();
    text(w, "Crie um marco no app", { color: C.text2, font: Font.systemFont(11) });
    return w;
  }

  text(w, d.milestone_title, { color: C.text1, font: Font.mediumSystemFont(small ? 11 : 12) });
  w.addSpacer(2);

  const value = w.addStack();
  value.bottomAlignContent();
  text(value, brl(d.current_cents), {
    color: d.achieved ? C.gold : C.volt,
    font: Font.boldMonospacedSystemFont(small ? 20 : 24),
  });
  if (!small) {
    value.addSpacer(6);
    text(value, "de " + brl(d.target_cents), { color: C.text2, font: Font.mediumMonospacedSystemFont(11) });
  }
  w.addSpacer(6);

  const barWidth = small ? 130 : family === "large" ? 300 : 300;
  const bar = w.addImage(progressBar(d, barWidth, 6));
  bar.imageSize = new Size(barWidth, 10);
  w.addSpacer(6);

  // faltam + ritmo
  const row = w.addStack();
  row.centerAlignContent();
  if (d.achieved) {
    text(row, "Marco batido", { color: C.gold, font: Font.semiboldSystemFont(12) });
  } else {
    text(row, "faltam " + brl(d.remaining_cents), { color: C.text0, font: Font.semiboldMonospacedSystemFont(12) });
    if (!small) {
      row.addSpacer();
      // meta diária arredondada pra cima, igual ao briefing
      text(row, brl(Math.ceil(d.pace_needed_cents / 100) * 100) + "/dia útil", {
        color: d.on_track ? C.volt : C.ember,
        font: Font.mediumMonospacedSystemFont(11),
      });
    }
  }

  if (small) {
    w.addSpacer();
    return w;
  }

  // dia: foco e hábitos (abordagens entram com o Pipeline)
  w.addSpacer();
  const day = w.addStack();
  day.centerAlignContent();
  label(day, "foco ");
  text(day, mins(d.focus_minutes) + "/" + mins(d.focus_goal_minutes), {
    color: d.focus_minutes > 0 ? C.plasma : C.text1,
    font: Font.mediumMonospacedSystemFont(11),
  });
  day.addSpacer();
  if (d.outreach_goal) {
    label(day, "abordagens ");
    text(day, d.outreach_today + "/" + d.outreach_goal, { color: C.text1, font: Font.mediumMonospacedSystemFont(11) });
    day.addSpacer();
  }
  label(day, "hábitos ");
  text(day, d.habits_expected ? d.habits_done + "/" + d.habits_expected : "-", {
    color: d.habits_expected && d.habits_done >= d.habits_expected ? C.volt : C.text1,
    font: Font.mediumMonospacedSystemFont(11),
  });

  if (family === "large") {
    w.addSpacer(10);
    text(w, d.bd_left + (d.bd_left === 1 ? " dia útil restante" : " dias úteis restantes"), {
      color: C.text2,
      font: Font.systemFont(11),
    });
  }
  return w;
}

// ------------------------------------------------------------------ principal

async function main() {
  let token = Keychain.contains(TOKEN_KEY) ? Keychain.get(TOKEN_KEY) : null;
  if (config.runsInApp) {
    // No app: permite configurar/trocar o token antes de mostrar a prévia.
    const a = new Alert();
    a.title = "NÚCLEO";
    a.message = token ? "Token já configurado." : "Ainda sem token.";
    a.addAction(token ? "Ver prévia" : "Configurar token");
    if (token) a.addAction("Trocar token");
    a.addCancelAction("Sair");
    const choice = await a.present();
    if (choice === -1) {
      Script.complete();
      return;
    }
    if (!token || choice === 1) token = await askToken();
  }
  
  const family = config.widgetFamily || "medium";
  const result = token ? await load(token) : { error: "Abra o script no Scriptable para configurar o token." };
  const widget = build(result, family);
  
  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else if (family === "small") {
    await widget.presentSmall();
  } else if (family === "large") {
    await widget.presentLarge();
  } else {
    await widget.presentMedium();
  }
  Script.complete();
}

await main();
