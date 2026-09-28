# Marcos e Ana

Convite do jantar de casamento (sexta-feira, 16/10/2026, 19h30), com confirmação de presença por família e um painel para os noivos acompanharem as respostas.

No ar em https://marcos-e-ana-casamento.vercel.app (painel em /painel).

## Como está organizado

- `public/index.html`: o convite. Abre com um envelope com o nome do convidado (só na primeira visita em cada aparelho; sempre com `?previa=1`), depois os cartões em papel de borda rasgada com ramos de oliveira em aquarela. No link geral, cada pessoa escreve os nomes. Com `?c=<código>`, vira o convite nominal (de uma pessoa ou de uma família), já com os nomes para marcar quem vai.
- Artes em `public/`: `aquarela-*.webp`, `raminho.webp` e `forro.webp` (aquarela), `lacre.webp` (selo de cera), `papel-rasgado.webp` e `grao.webp` (papel), `og-convite.jpg` (prévia de link).
- `public/painel.html`: painel dos noivos em `/painel`. Cadastra convidados em lote, gera o link de cada um, mostra quem abriu, quem respondeu, as restrições alimentares e baixa a planilha.
- `api/`: funções da Vercel.
  - `GET /api/convite?c=<código>`: nomes da família e a resposta mais recente.
  - `POST /api/rsvp`: grava uma confirmação.
  - `POST /api/abertura`: registra que um convidado abriu o próprio link. A página só chama depois de ~2,5 s visível; prévias de link não rodam o script e robôs são descartados pelo user agent. Não conta com `?previa=1` nem em aparelhos que já entraram no painel.
  - `GET|POST /api/painel`: dados e ações do painel (exige o cabeçalho `x-chave`).
- As respostas ficam num Blob store **privado** da Vercel: `familias.json` com a lista de convidados e `respostas/<chave>/…json`, uma entrada por envio (vale a mais recente), e `aberturas/<código>/…json`, uma entrada por abertura (a data fica no nome do arquivo).

## Configuração na Vercel

1. Importar este repositório (preset "Other", sem comando de build; a pasta servida é `public`).
2. Em Storage, criar um Blob store com acesso **privado** e conectar ao projeto. Isso cria as variáveis que as funções usam.
3. Em Settings > Environment Variables, criar `PAINEL_CHAVE` com a senha do painel.
4. Fazer um novo deploy para as variáveis valerem.

## Rodar localmente

```
npm run dev
```

Abre em http://localhost:3000, com os dados em memória (somem ao reiniciar). O painel fica em `/painel` com a chave `teste`.

## Local

Restaurante Maestro Caramelo, em Guaratuba (PR). O link do mapa está no bloco "Onde" de `public/index.html` e no evento de `public/casamento.ics`.
