# SSDF Assessment (NIST SP 800-218)

Sistema web para conduzir assessments SSDF, registrar evidencias, calcular maturidade e gerar metrics para BI.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- Prisma + PostgreSQL
- NextAuth (Credentials) com preparo para OIDC
- Docker Compose (app + postgres)
- Zod, ESLint, Prettier

## Como rodar (local)
1) Copie `.env.example` para `.env` e ajuste as variaveis.
2) Suba o Postgres e o app:

```bash
docker compose up --build
```

3) Rode migrations e seed (no container app ou local):

```bash
npm install
npm run prisma:migrate
npm run prisma:seed
```

4) Acesse: http://localhost:3000

## Seed SSDF (Excel)
- O seed tenta ler o Excel em `SSDF_EXCEL_PATH`.
- Se nao encontrar, usa `data/ssdf-sample.json` como fallback.
- Para usar o template real, coloque o arquivo em `data/ssdf-template.xlsx` ou ajuste a variavel.

## Usuarios demo
- Admin: `admin@ssdf.local` / `Admin123!`
- Assessor: `assessor@ssdf.local` / `Assessor123!`
- Viewer: `viewer@ssdf.local` / `Viewer123!`

## Power BI
- Rode o script `sql/bi_views.sql` no Postgres.
- Configure `NEXT_PUBLIC_POWER_BI_URL` para exibir o atalho dentro do app.
- Para atualizacao em tempo real, use DirectQuery no Power BI e habilite Auto Page Refresh.
- Consulte `sql/README.md` para as views recomendadas e dicas de modelagem.

## Exportacoes
- No Dashboard, use o botao Exportar para gerar relatorios em XLSX, CSV, JSON ou TSV.
- O XLSX inclui abas com resumo executivo, indicadores por grupo e detalhes completos das tarefas.

## Campos do assessment
- Aplicavel: define se a tarefa se aplica ao escopo (Sim/Não).
- Maturidade: nivel atual (0-5) de implementacao da tarefa.
- Alvo: nivel desejado (0-5) para a tarefa.
- Gap: diferenca entre Alvo e Maturidade (Alvo - Maturidade).
- Peso: importancia da tarefa (1-5).
- Prioridade: Gap * Peso (pode ser negativo se Maturidade > Alvo).

## Usuarios e roles
- Acesse `/users` como Admin para criar usuarios e definir roles (Admin, Assessor, Viewer).

## SSO (Okta, Azure AD, OIDC)
- Configure as variaveis no `.env`:
  - `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `OKTA_ISSUER`
  - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
  - `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`
- As opcoes sao exibidas na tela de login automaticamente quando configuradas.

## Scripts principais
- `npm run dev`
- `npm run build`
- `npm run prisma:migrate`
- `npm run prisma:seed`

## Observacoes
- Ao criar um assessment, o sistema cria respostas para todas as tarefas SSDF.
- Gap, prioridade e progresso ponderado sao calculados automaticamente.
- O usuario pode alternar o tema claro/escuro na interface.
