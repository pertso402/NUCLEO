# Widget do NÚCLEO no iPhone (Scriptable)

O widget mostra o marco em destaque na tela inicial:
- quanto entrou e quanto falta;
- a barra com a marca de "onde deveria estar hoje";
- o valor por dia útil, em verde se você está no ritmo e em laranja se está abaixo;
- o dia: score, foco e hábitos.

Tocar no widget abre o app. Ele se atualiza a cada ~15 min, que é o limite do iOS.

## Instalar (uma vez)
1. Instale o **Scriptable**, que é grátis na App Store.
2. No Scriptable, toque em **+**. Cole o conteúdo de [`nucleo-widget.js`](nucleo-widget.js) e dê o nome **NÚCLEO**.
3. Toque em ▶︎ pra rodar e escolha **Configurar token**. Cole o `NUCLEO_API_TOKEN`:
   - ele fica só no Keychain do iPhone, não no script;
   - o valor está no `.env.local` do projeto e é o mesmo da Vercel.
4. Escolha **Ver prévia** pra conferir.
5. Na tela inicial:
   - segure num espaço vazio, toque em **+** e escolha **Scriptable**;
   - escolha o tamanho **médio** (recomendado) ou pequeno e adicione;
   - segure o widget, toque em **Editar widget** e, em *Script*, escolha **NÚCLEO**.

## Tamanhos
- **Pequeno:** marco, valor atual, barra e quanto falta.
- **Médio:** o mesmo, mais "de R$ X", o valor por dia útil e a linha do dia (foco e hábitos). As abordagens entram quando o Pipeline existir (Fase 3).
- **Grande:** o médio, mais os dias úteis restantes.

## Problemas
- **"Token inválido":** rode o script no app e escolha **Trocar token**.
- **"offline · HH:MM":** o iPhone não alcançou o servidor. O widget mostra os últimos números guardados e o horário deles.
- **Endpoint:** `GET https://nucleo-beta.vercel.app/api/widget` com o header `x-nucleo-token`. Ele devolve só números prontos (ver `lib/widget.ts`).
