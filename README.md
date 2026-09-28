# Marcos e Ana

Convite do jantar de casamento (sexta-feira, 16/10/2026, 19h30), com confirmação de presença por família e um painel para os noivos acompanharem as respostas.

No ar em https://marcos-e-ana-casamento.vercel.app (painel em /painel).

## Como está organizado

- `public/index.html`: o convite. No link geral, cada pessoa escreve os nomes. Com `?c=<código>`, vira o convite nominal da família, já com os nomes para marcar quem vai.
- `public/painel.html`: painel dos noivos em `/painel`. Cadastra famílias (uma a uma ou várias de uma vez), gera o link de cada uma, mostra quem respondeu, as restrições alimentares e baixa a planilha.
- `api/`: funções da Vercel.
  - `GET /api/convite?c=<código>`: nomes da família e a resposta mais recente.
  - `POST /api/rsvp`: grava uma confirmação.
  - `GET|POST /api/painel`: dados e ações do painel (exige o cabeçalho `x-chave`).
- As respostas ficam num Blob store **privado** da Vercel: `familias.json` com a lista de convidados e `respostas/<chave>/…json`, uma entrada por envio (vale a mais recente).

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
