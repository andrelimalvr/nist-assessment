create schema if not exists bi;

create or replace view bi.dim_group as
select
  g.id as group_id,
  g.name as group_name,
  g.description
from ssdf_groups g;

create or replace view bi.dim_practice as
select
  p.id as practice_id,
  p.name as practice_name,
  p.group_id,
  g.name as group_name
from ssdf_practices p
join ssdf_groups g on g.id = p.group_id;

create or replace view bi.dim_task as
select
  t.id as task_id,
  t.name as task_name,
  t.practice_id,
  p.name as practice_name,
  p.group_id,
  g.name as group_name,
  t.examples,
  t."references" as references_nist
from ssdf_tasks t
join ssdf_practices p on p.id = t.practice_id
join ssdf_groups g on g.id = p.group_id;

create or replace view bi.dim_assessment as
select
  a.id as assessment_id,
  a.organization_id,
  o.name as organization_name,
  a.unit,
  a.scope,
  a.assessment_owner,
  a.start_date,
  a.review_date,
  a.notes,
  a.created_at
from assessments a
join organizations o on o.id = a.organization_id;

create or replace view bi.fact_assessment_task as
select
  r.id as response_id,
  r.assessment_id,
  a.organization_id,
  o.name as organization_name,
  a.unit,
  a.scope,
  r.task_id,
  t.name as task_name,
  t.practice_id,
  p.name as practice_name,
  p.group_id,
  g.name as group_name,
  r.applicable,
  r.status,
  r.maturity,
  r.target,
  r.weight,
  (r.target - r.maturity) as gap,
  case when r.applicable then (r.target - r.maturity) * r.weight else 0 end as prioridade,
  case when r.applicable then (r.maturity::numeric / 5) * r.weight else 0 end as progresso_ponderado,
  case when r.applicable then (r.maturity::numeric / 5) else 0 end as score_percent,
  r.owner,
  r.team,
  r.due_date,
  r.last_review,
  r.evidence_text,
  r.evidence_links,
  r.notes,
  r.created_at,
  r.updated_at
from assessment_task_responses r
join assessments a on a.id = r.assessment_id
join organizations o on o.id = a.organization_id
join ssdf_tasks t on t.id = r.task_id
join ssdf_practices p on p.id = t.practice_id
join ssdf_groups g on g.id = p.group_id;

create or replace view bi.fact_evidence as
select
  e.id as evidence_id,
  e.response_id,
  r.assessment_id,
  a.organization_id,
  o.name as organization_name,
  r.task_id,
  t.name as task_name,
  e.type,
  e.description,
  e.link,
  e.owner,
  e.date,
  e.valid_until,
  e.notes,
  e.created_at
from evidences e
join assessment_task_responses r on r.id = e.response_id
join assessments a on a.id = r.assessment_id
join organizations o on o.id = a.organization_id
join ssdf_tasks t on t.id = r.task_id;
