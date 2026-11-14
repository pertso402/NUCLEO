# Atalho da Siri: "Lançar no Núcleo"

Você fala com a Siri, ela manda o texto pro NÚCLEO e lê a resposta. É o mesmo cérebro do WhatsApp e do botão do app (`/api/ingest`, canal `siri`), então tudo funciona igual:

| Você fala | O NÚCLEO faz |
|---|---|
| "gastei 38 no almoço" | lança a despesa |
| "recebi 1500 da pizzaria" | lança a receita e diz como está o marco |
| "tarefa: mandar proposta pra Gelato sexta" | cria a tarefa |
| "fiz academia" | marca o hábito |
| "começa timer cardápio" / "para o timer" | liga e desliga o timer |
| "quanto falta pro marco?" | responde com os números |
| "desfaz" | desfaz o último lançamento |

## Montar o Atalho (uma vez, ~3 minutos)

Abra o app **Atalhos**, toque em **+** e adicione as ações abaixo, nesta ordem. Os nomes são os do iOS em português.

1. **Ditar Texto**
   - Idioma: *Português (Brasil)*.
   - Parar de ouvir: *Após Pausa*.
2. **Obter Conteúdo do URL**
   - URL: `https://nucleo-beta.vercel.app/api/ingest`
   - Toque na seta (›) pra abrir as opções:
     - **Método:** `POST`.
     - **Cabeçalhos:** adicione `x-nucleo-token` com o valor do seu `NUCLEO_API_TOKEN`. O valor está no `.env.local` do projeto e é o mesmo da Vercel.
     - **Corpo da Solicitação:** `JSON`. Adicione dois campos do tipo **Texto**:
       - `channel` com o valor `siri`;
       - `text` com o valor **Texto Ditado**. Toque no campo e escolha a variável que a ação 1 gerou.
3. **Obter Valor do Dicionário**
   - Obter: **Valor** da chave `reply_text`, em **Conteúdo do URL**.
4. **Mostrar Resultado**, com o **Valor do Dicionário**. Se preferir que ela leia em voz alta, use **Falar Texto**.

Dê o nome **Lançar no Núcleo** ao atalho (toque no nome lá em cima). Esse nome é a frase que você fala.

## Usar
- **"E aí Siri, lançar no Núcleo"**. Ela pergunta o que lançar: fale normalmente, por exemplo "gastei 40 de gasolina e fiz academia", e ela mostra ou lê a confirmação.
- Também dá pra tocar no atalho, colocar o atalho na tela inicial ou ligar ao **Toque Traseiro**: Ajustes → Acessibilidade → Toque → Toque Traseiro → Toque duplo → *Lançar no Núcleo*.
- Pra mudar ou desfazer, é só rodar de novo e dizer "desfaz".

## Variação sem falar (digitando)
Troque a ação 1 por **Pedir Entrada**, com o tipo *Texto* e o prompt "O que lançar?". No campo `text`, use **Entrada Fornecida**. É útil em lugar barulhento.

## Segurança
- O token fica salvo dentro do atalho, só no seu iPhone. **Não compartilhe esse atalho** (nem por iCloud): quem tiver o token consegue lançar no seu NÚCLEO.
- Se o token vazar, gere outro, troque o `NUCLEO_API_TOKEN` na Vercel e no `.env.local`, e atualize o atalho e o widget.

## Se der errado
A resposta sempre vem em `reply_text`, então a Siri sempre diz alguma coisa:
- **"Token inválido. Confira o token no Atalho."**: o cabeçalho `x-nucleo-token` está errado ou com espaço sobrando.
- **"Não ouvi nada pra lançar."**: o ditado veio vazio.
- **"⚠️ Não consegui processar agora…"**: falha no servidor ou na OpenAI (por exemplo, sem crédito). Tudo fica registrado em `inbox_messages` pra depurar.
- **"Muitas mensagens seguidas…"**: passou de 30 lançamentos por minuto.
