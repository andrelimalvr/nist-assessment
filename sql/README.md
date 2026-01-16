# Power BI + Postgres (SSDF + CIS)

## Passos rapidos
1) Suba o banco com Docker Compose.
2) Rode migrations e seed.
3) Execute `sql/bi_views.sql` no Postgres (psql, DBeaver ou Adminer).
4) No Power BI:
   - Get Data -> PostgreSQL
   - Server: `localhost`
   - Database: `ssdf`
   - Modo: Import ou DirectQuery

## Views recomendadas
Dimensoes:
- `bi.dim_organization`
- `bi.dim_assessment`
- `bi.dim_ssdf_group`
- `bi.dim_ssdf_practice`
- `bi.dim_ssdf_task`
- `bi.dim_cis_control`
- `bi.dim_cis_safeguard`

Fatos:
- `bi.fact_ssdf_task_result`
- `bi.fact_cis_result`
- `bi.fact_mapping`
- `bi.fact_evidence`

## Dicas de modelagem
- Use `bi.fact_ssdf_task_result` como fato principal do SSDF.
- Use `bi.fact_cis_result` para controles CIS (derivados + override manual).
- Para KPI de score ponderado (SSDF):
  - `SUM(progresso_ponderado) / SUM(weight)` filtrando `applicable = true`.
- Para % implementadas (SSDF):
  - `COUNT(status = 'IMPLEMENTED') / COUNT(applicable = true)`.
- Para KPI CIS com override:
  - use `effective_status` e `effective_maturity_level` em `bi.fact_cis_result`.
- Para atualizacao em tempo real, prefira DirectQuery e Auto Page Refresh.

## Observacoes
- IDs sao estaveis (SSDF usa codigo de grupo/pratica/tarefa).
- Campos de data sao `date`/`timestamp`.
- Em `bi.dim_ssdf_task`, a coluna de referencias aparece como `references_nist`.
