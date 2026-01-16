# Power BI + Postgres (SSDF)

## Passos rapidos
1) Suba o banco com Docker Compose.
2) Rode migrations e seed.
3) Execute `sql/bi_views.sql` no Postgres (pode ser via psql, DBeaver, ou Adminer).
4) No Power BI:
   - Get Data -> PostgreSQL
   - Server: `localhost`  (ou host do container)
   - Database: `ssdf`
   - Modo: Import ou DirectQuery

## Views recomendadas
- `bi.dim_assessment`
- `bi.dim_group`
- `bi.dim_practice`
- `bi.dim_task`
- `bi.fact_assessment_task`
- `bi.fact_evidence`

## Dicas de modelagem
- Use `bi.fact_assessment_task` como fato principal.
- Relacione com `bi.dim_assessment`, `bi.dim_task`, `bi.dim_practice` e `bi.dim_group`.
- Para KPI de score ponderado:
  - `SUM(progresso_ponderado) / SUM(weight)` (filtrando `applicable = true`).
- Para % implementadas:
  - `COUNT(status = 'IMPLEMENTADO') / COUNT(applicable = true)`.
- Para atualizacao em tempo real, prefira DirectQuery e Auto Page Refresh.

## Observacoes
- Todos os IDs sao estaveis (group/practice/task usam o codigo do SSDF).
- Os campos de data sao `date`/`timestamp` no Postgres e aparecem corretamente no Power BI.
- Em `bi.dim_task`, a coluna de referencias aparece como `references_nist`.
