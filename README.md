# Projeto 2 – Aplicação Full Stack de Controle Financeiro

API REST em **Node.js/Express + PostgreSQL** e SPA em **React (Vite)** para controle financeiro pessoal: cadastro e login com JWT, categorias, fontes/destinos (contas, rendas e cartões), lançamentos com parcelamento no cartão, relatórios, previsão de faturas e página de saúde financeira (desafio).

Enunciado: <https://costasilvati.github.io/fullStack/projeto-2.html>

---

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Banco | PostgreSQL 14+ |
| Back-end | Node.js 18+, Express 4, `pg` (pool de conexões), `bcrypt`, `jsonwebtoken`, `dotenv`, `express-rate-limit`, `cors` |
| Front-end | React 18 + Vite 5, React Router 6, Context API, Recharts (gráficos), `fetch` encapsulado em um cliente HTTP único |
| Testes | `node:test` (regras de fatura, parcelamento, CPF e valores) |

> ⚠️ Conforme o enunciado, o banco (**PostgreSQL**) e as bibliotecas `cors` e `recharts` precisam ser comunicados/aprovados pelo professor antes da entrega.

---

## Estrutura

```
.
├── backend/
│   ├── database/
│   │   ├── schema.sql          # DDL (tabelas, FKs, UNIQUE, CHECK, índices)
│   │   ├── seed.js             # 2 usuários + ~4 meses de lançamentos (inclui parcelados)
│   │   └── executar-sql.js     # executa um .sql (cria o banco se não existir)
│   ├── src/
│   │   ├── server.js
│   │   ├── config/             # env.js (variáveis) e db.js (pool + transação)
│   │   ├── middlewares/        # auth (JWT), errorHandler, rateLimit, validacao
│   │   ├── models/             # ÚNICA camada com acesso ao banco + regras de fatura
│   │   └── routes/             # rotas com os controladores dentro
│   ├── tests/                  # testes automatizados (node --test)
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/         # layout/, ui/ e paginas/
    │   ├── contexts/           # AuthContext
    │   └── services/           # api.js (cliente HTTP único), formatadores, hook de requisição
    └── .env.example
```

---

## Como executar (linha de comando)

### 1. Banco de dados

Tenha um PostgreSQL rodando (local ou Docker). Exemplo com Docker:

```bash
docker run --name financas-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

### 2. Back-end

```bash
cd backend
cp .env.example .env        # ajuste usuário/senha do banco e gere um JWT_SECRET
npm install
npm run db:schema           # cria o banco "financas" (se não existir) e as tabelas
npm run db:seed             # popula com 2 usuários e lançamentos de exemplo
npm run dev                 # API em http://localhost:3001/api
```

Outros scripts:

| Script | O que faz |
|---|---|
| `npm run db:reset` | recria as tabelas e roda o seed |
| `npm start` | inicia a API sem watch |
| `npm test` | roda os testes de regras de negócio |

Gerar um segredo JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Front-end

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:3001/api
npm install
npm run dev                 # http://localhost:5173
```

### Usuários do seed

| E-mail | Senha | Observação |
|---|---|---|
| `ana@exemplo.com` | `Senha123` | 2 cartões (Nubank fecha 3/vence 10; Visa fecha 25/vence 5), compras parceladas |
| `bruno@exemplo.com` | `Senha123` | 1 cartão (fecha 31 → testa ajuste de dias inexistentes) |

As datas do seed são relativas ao dia em que ele é executado, então sempre há 3 meses completos + o mês atual.

---

## Variáveis de ambiente

**backend/.env**

| Variável | Exemplo | Descrição |
|---|---|---|
| `PORT` | `3001` | porta da API |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `localhost`, `5432`, `postgres`, `postgres`, `financas` | conexão PostgreSQL |
| `DB_POOL_MAX` | `10` | tamanho máximo do pool |
| `JWT_SECRET` | (aleatório) | segredo de assinatura do JWT |
| `JWT_EXPIRES_IN` | `1h` | expiração do token |
| `CORS_ORIGIN` | `http://localhost:5173` | origem(ns) permitida(s), separadas por vírgula |
| `BCRYPT_ROUNDS` | `10` | custo do bcrypt |

**frontend/.env**

| Variável | Exemplo |
|---|---|
| `VITE_API_URL` | `http://localhost:3001/api` |

Os arquivos `.env` estão no `.gitignore`; apenas os `.env.example` são versionados.

---

## Rotas da API

Todas as rotas sob `/api` exigem `Authorization: Bearer <token>`, exceto cadastro e login.

| Método | Rota | Função | Status |
|---|---|---|---|
| POST | `/api/auth/cadastro` | Cadastro (retorna usuário + token) | 201, 400, 409 |
| POST | `/api/auth/login` | Login e JWT | 200, 400, 401, 429 |
| GET | `/api/auth/me` | Usuário logado | 200, 401 |
| GET | `/api/categorias?tipo=` | Listar | 200 |
| POST | `/api/categorias` | Criar | 201, 400, 409 |
| GET | `/api/categorias/:id` | Detalhar | 200, 404 |
| PUT | `/api/categorias/:id` | Editar | 200, 400, 404, 409 |
| DELETE | `/api/categorias/:id[?moverPara=ID]` | Excluir (opcionalmente movendo os lançamentos) | 204, 400, 404, 409 |
| GET | `/api/fontes-destinos?tipo=` | Listar | 200 |
| POST | `/api/fontes-destinos` | Criar | 201, 400, 409 |
| GET | `/api/fontes-destinos/:id` | Detalhar | 200, 404 |
| PUT | `/api/fontes-destinos/:id` | Editar | 200, 400, 404, 409 |
| DELETE | `/api/fontes-destinos/:id[?moverPara=ID]` | Excluir | 204, 400, 404, 409 |
| GET | `/api/lancamentos` | Listar com filtros e paginação | 200, 400 |
| POST | `/api/lancamentos` | Criar (com parcelas) | 201, 400 |
| GET | `/api/lancamentos/:id` | Detalhar (inclui as parcelas do grupo) | 200, 404 |
| PUT | `/api/lancamentos/:id` | Editar | 200, 400, 404 |
| DELETE | `/api/lancamentos/:id[?todasParcelas=true]` | Excluir parcela ou compra inteira | 204, 404 |
| GET | `/api/relatorios/categorias?inicio=&fim=` | RF7 | 200, 400 |
| GET | `/api/relatorios/fontes-destinos?inicio=&fim=` | RF8 | 200, 400 |
| GET | `/api/relatorios/faturas?meses=3[&cartaoId=]` | RF9 | 200, 400 |
| GET | `/api/saude-financeira` | Desafio | 200 |
| GET | `/api/status` | Healthcheck (público) | 200 |

**Filtros de `GET /api/lancamentos`:** `inicio`, `fim` (AAAA-MM-DD; padrão = mês corrente), `tipo`, `categoriaId`, `fonteDestinoId`, `busca`, `pagina` (padrão 1), `limite` (1–100, padrão 20). A resposta traz `itens`, `paginacao` e `totais` (entradas, saídas e saldo do período filtrado, independentemente da página).

**Corpo de `POST /api/lancamentos`:**

```json
{
  "tipo": "saida",
  "descricao": "Notebook",
  "valor": "4.299,90",
  "data": "2026-11-20",
  "categoriaId": 10,
  "fonteDestinoId": 4,
  "totalParcelas": 10
}
```

`valor` é o valor total e aceita número (`4299.9`) ou texto (`"4.299,90"`); internamente tudo é convertido para centavos inteiros.

**Formato único de erro:**

```json
{
  "erro": "Dados inválidos. Verifique os campos.",
  "campos": { "cpf": "CPF inválido.", "senha": "A senha deve ter no mínimo 8 caracteres, com letras e números." }
}
```

---

## Regras de negócio implementadas

### Autenticação e isolamento
- E-mail é gravado em minúsculas e CPF só com dígitos; o banco garante com `UNIQUE` + `CHECK`. Duplicidade retorna **409** indicando o(s) campo(s).
- CPF validado pelos dígitos verificadores; senha com 8+ caracteres, letras e números.
- Senha com `bcrypt` (salt aleatório por hash). O hash nunca é retornado.
- Login retorna JWT com expiração (`JWT_EXPIRES_IN`); credenciais inválidas → **401** com mensagem genérica. Rate limiting no login (10 tentativas falhas/15 min por IP) e no cadastro.
- O middleware `autenticar` define `req.usuarioId` a partir do token; **toda** consulta filtra por esse id (nunca pelo corpo/URL). Registros de outro usuário retornam **404**. Além disso, as FKs compostas `(categoria_id, usuario_id)` e `(fonte_destino_id, usuario_id)` impedem, no próprio banco, que um lançamento use categoria/fonte de outra pessoa.

### Cadastros
- Ao cadastrar um usuário são criadas categorias padrão (Salário, Freelance, Rendimentos, Outros / Alimentação, Moradia, Saúde, Mobilidade, Lazer, Educação, Outros) e as fontes "Conta corrente" e "Salário mensal" — tudo em uma transação.
- Categoria: nome único por usuário + tipo (sem diferenciar maiúsculas). Não é possível mudar o tipo de categoria com lançamentos.
- Cartão de crédito exige dia de fechamento, dia de vencimento (1–31) e limite (**400** se faltar).
- Exclusão de categoria/fonte com lançamentos retorna **409**, a menos que seja informado `?moverPara=ID` (os lançamentos são movidos e a exclusão é feita em transação). A tela oferece essa opção.

### Lançamentos e parcelamento
- Valor positivo, data válida no calendário e tipo do lançamento compatível com o tipo da categoria.
- Valores sempre em **centavos (`BIGINT`)**, nunca `float`.
- Parcelamento (1 a 48) somente em **cartão de crédito** e para **saídas**: uma linha por parcela, mesmo `grupo_parcelamento` (UUID), gravadas em **uma transação**. A diferença de arredondamento fica na 1ª parcela (R$ 100,00 em 3× → 33,34 + 33,33 + 33,33).
- Cada parcela guarda `data_compra` (data original, base do cálculo da fatura) e `data` (competência: compra + k−1 meses, usada na listagem e nos relatórios).
- Em uma parcela é possível editar descrição, valor e categoria; data, cartão e nº de parcelas não podem ser alterados isoladamente. Na exclusão, o usuário escolhe excluir só a parcela ou todas.

### Relatórios
- **Por categoria (RF7):** totais por categoria com `GROUP BY`/`SUM`, percentual sobre o total do tipo (ordem decrescente) e comparação com o período anterior de mesmo tamanho (se o período for de meses inteiros, o anterior também é: nov → out; caso contrário, mesmo nº de dias).
- **Por fonte/destino (RF8):** entradas, saídas e saldo no período, além do saldo acumulado até o fim do período.

### Previsão de faturas (RF9)
Implementada em `backend/src/models/fatura.js` (`calcularFatura`) e coberta por testes com os exemplos do enunciado:
- compra **antes** do dia de fechamento → fatura que fecha no mesmo mês; **no dia** do fechamento ou depois → mês seguinte;
- a parcela *k* cai *k − 1* meses depois da 1ª;
- vencimento no mesmo mês do fechamento se o dia de vencimento for maior que o de fechamento; senão, no mês seguinte;
- dias inexistentes viram o último dia do mês (ex.: fechamento dia 31 em fevereiro → 28/02);
- a fatura é identificada pelo mês do vencimento (ex.: Visa fecha 25/vence 5, compra em 28/12/2026 → fatura 02/2027, fecha 25/01/2027, vence 05/02/2027).

A resposta traz, por cartão, a fatura fechada ainda não vencida (se houver), a fatura atual (aberta) e as próximas *N*, cada uma com fechamento, vencimento, lançamentos (com indicação `k/n` da parcela) e total, além do limite utilizado (todas as parcelas de faturas ainda não vencidas, inclusive as futuras) e disponível.

### Desafio – Saúde financeira
Página com aviso visível de que o conteúdo é educativo e **não é recomendação financeira profissional**. Base: média dos 3 últimos meses completos. Não usa API externa.

| Indicador | Cálculo | Saudável / Atenção / Crítico |
|---|---|---|
| Taxa de poupança | (renda média − despesa média) / renda média | ≥ 20% / ≥ 10% / < 10% |
| Comprometimento com cartões | próxima fatura de todos os cartões / renda média | ≤ 30% / ≤ 50% / > 50% |
| Parcelas futuras | soma das parcelas já contratadas após o mês atual; status pelo % da renda do próximo mês | ≤ 15% / ≤ 30% / > 30% |
| Regra 50/30/20 | necessidades (Moradia, Alimentação, Saúde, Mobilidade, Educação) e desejos (demais) sobre a renda | maior desvio ≤ 0 / ≤ 10 p.p. / > 10 p.p. |
| Reserva de emergência | saldo acumulado / despesa média mensal | ≥ 6 / ≥ 3 / < 3 meses |
| Categorias fora da curva | gasto do mês atual > 130% da média e ao menos R$ 50 acima | 0 / 1 / 2+ categorias |

**Projeção de saldo (6 meses, com gráfico):** saldo(m) = saldo(m−1) + renda média − despesas médias à vista − parcelas já contratadas do mês.
**Dicas:** geradas por regras fixas a partir do status de cada indicador.

---

## Front-end

- Rotas protegidas (`RotaProtegida`) redirecionam ao login; `AuthContext` expõe `usuario`, `token`, `login`, `logout` e `cadastrar`, persistindo o token no `localStorage` (sobrevive ao recarregar) e validando-o com `/auth/me`. Logout automático quando o token expira.
- `services/api.js` é o cliente HTTP único: injeta o `Authorization` e, ao receber **401**, faz logout.
- Validação no cliente + exibição das mensagens do servidor junto aos campos (inclusive o 409 de e-mail/CPF no cadastro). Máscaras de CPF e moeda.
- Estados de carregamento, lista vazia e erro em todas as telas que consomem a API.
- Valores em reais (`pt-BR`) e datas no formato brasileiro.
- Telas: login, cadastro, dashboard, lançamentos, categorias, fontes/destinos, relatórios, faturas e saúde financeira.
