# SSDF + CIS Assessment (NIST SP 800-218 / CIS Controls v8.1)

Sistema web para conduzir assessments SSDF, registrar evidencias, calcular maturidade e gerar metricas para BI. Inclui visao CIS derivada do SSDF e comparativos.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- Prisma + PostgreSQL
- NextAuth (Credentials) com preparo para OIDC
- Docker Compose (app + postgres)
- Zod, ESLint, Prettier

## Pre-requisitos
- Docker + Docker Compose instalados no servidor
- (Opcional para dev local sem Docker) Node.js 20+ e PostgreSQL 16+

## Instalacao (servidor com Docker)
1) Clone o repo e copie o `.env`:

```bash
git clone <repo>
cd nist-assessment
cp .env.example .env
```

2) Ajuste variaveis essenciais:
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL` (se usar DB externo)

3) Suba os containers:

```bash
docker compose up -d --build
```

4) Aplique migrations e seed no container do app:

```bash
docker exec nist-assessment-app-1 npx prisma migrate deploy
docker exec nist-assessment-app-1 npx prisma db seed
```

5) Acesse: http://localhost:3000

## Como rodar (local sem Docker)
Se preferir usar Docker localmente, siga a secao "Instalacao (servidor com Docker)".

1) Instale Node.js 20+ e PostgreSQL 16+.
2) Copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
3) Instale dependencias e rode migrations/seed:

```bash
npm install
npx prisma migrate deploy
npm run prisma:seed
```

4) Inicie o app:

```bash
npm run dev
```

5) Acesse: http://localhost:3000

## Seed (SSDF + CIS)
- SSDF: o seed tenta ler o Excel em `SSDF_EXCEL_PATH`.
- Fallback SSDF: `data/ssdf-sample.json`.
- CIS Controls: `data/cis-controls-sample.json`.
- Mapeamento SSDF x CIS: `data/ssdf-cis-mapping-sample.json`.

Para usar o template real, coloque o arquivo em `data/ssdf-template.xlsx` ou ajuste a variavel.

## Usuarios demo
- Admin: `admin@ssdf.local` / `Admin123!`
- Assessor: `assessor@ssdf.local` / `Assessor123!`
- Viewer: `viewer@ssdf.local` / `Viewer123!`

## Multi-tenant e roles
- ADMIN: acesso a todas as organizacoes; cria usuarios; define empresas por usuario.
- ASSESSOR: acesso apenas as organizacoes delegadas; pode editar assessments.
- VIEWER: acesso apenas as organizacoes delegadas; somente leitura.
- A tabela `user_organizations` controla os acessos por empresa.

## SSDF (campos do assessment)
- Aplicavel: derivado do status (`NOT_APPLICABLE` = Nao aplicavel).
- Maturidade: nivel atual (0-3) por tarefa.
- Alvo: nivel desejado (0-3).
- Gap: diferenca entre Alvo e Maturidade (max(Alvo - Maturidade, 0)).
- Peso: importancia da tarefa (1-5).
- Prioridade: Gap * Peso.

## CIS Controls View + replicacao
- O modulo CIS e alimentado automaticamente a partir dos resultados do SSDF.
- Ao atualizar uma tarefa SSDF, o sistema recalcula os resultados CIS mapeados.
- Overrides manuais podem ser aplicados na tela "CIS View".
- O mapeamento e editavel por Admin em `/mappings`.

## Power BI
- Rode `sql/bi_views.sql` no Postgres.
- Configure `NEXT_PUBLIC_POWER_BI_URL` para exibir o atalho dentro do app.
- Para atualizacao em tempo real, use DirectQuery no Power BI e habilite Auto Page Refresh.
- Consulte `sql/README.md` para as views recomendadas e dicas de modelagem.

## Exportacoes
- No Dashboard, use o botao Exportar para gerar relatorios em PDF, XLSX, CSV, JSON ou TSV.
- O XLSX inclui abas com resumo executivo, indicadores por grupo e detalhes completos das tarefas.
- O PDF e gerado server-side com Playwright/Chromium (incluso na imagem Docker).

## SSO (Okta, Azure AD, OIDC)
- Configure as variaveis no `.env`:
  - `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `OKTA_ISSUER`
  - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
  - `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`
- As opcoes sao exibidas na tela de login automaticamente quando configuradas.

## Testes
- Replicacao SSDF -> CIS:

```bash
npm run test:cis
```

## Scripts principais
- `npm run dev`
- `npm run build`
- `npm run prisma:migrate`
- `npm run prisma:seed`
- `npm run test:cis`

## Observacoes
- Ao criar um assessment, o sistema cria respostas para todas as tarefas SSDF.
- Gap, prioridade e progresso ponderado sao calculados automaticamente.
- O usuario pode alternar o tema claro/escuro na interface.
