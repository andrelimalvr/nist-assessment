create schema if not exists bi;

create or replace view bi.dim_organization as
select
  o.id as organization_id,
  o.name as organization_name,
  o.created_at,
  o.updated_at
from organizations o;

create or replace view bi.dim_assessment as
select
  a.id as assessment_id,
  a.organization_id,
  o.name as organization_name,
  a.name as assessment_name,
  a.unit,
  a.scope,
  a.assessment_owner,
  a.dg_level,
  a.start_date,
  a.review_date,
  a.notes,
  a.created_at,
  a.updated_at
from assessments a
join organizations o on o.id = a.organization_id;

create or replace view bi.dim_ssdf_group as
select
  g.id as group_id,
  g.name as group_name,
  g.description
from ssdf_groups g;

create or replace view bi.dim_ssdf_practice as
select
  p.id as practice_id,
  p.name as practice_name,
  p.group_id,
  g.name as group_name
from ssdf_practices p
join ssdf_groups g on g.id = p.group_id;

create or replace view bi.dim_ssdf_task as
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

create or replace view bi.dim_cis_control as
select
  c.id as control_id,
  c.name as control_name,
  c.description
from cis_controls c;

create or replace view bi.dim_cis_safeguard as
select
  s.id as safeguard_id,
  s.name as safeguard_name,
  s.description,
  s.implementation_group,
  s.control_id,
  c.name as control_name
from cis_safeguards s
join cis_controls c on c.id = s.control_id;

create or replace view bi.fact_ssdf_task_result as
select
  r.id as ssdf_result_id,
  r.assessment_id,
  a.organization_id,
  o.name as organization_name,
  a.name as assessment_name,
  a.unit,
  a.scope,
  r.ssdf_task_id,
  t.name as task_name,
  t.practice_id,
  p.name as practice_name,
  p.group_id,
  g.name as group_name,
  r.status,
  (r.status <> 'NOT_APPLICABLE') as applicable,
  r.maturity_level,
  r.target_level,
  r.weight,
  (r.target_level - r.maturity_level) as gap,
  case when r.status <> 'NOT_APPLICABLE' then (r.target_level - r.maturity_level) * r.weight else 0 end as prioridade,
  case when r.status <> 'NOT_APPLICABLE' then (r.maturity_level::numeric / 3) * r.weight else 0 end as progresso_ponderado,
  case when r.status <> 'NOT_APPLICABLE' then (r.maturity_level::numeric / 3) else 0 end as score_percent,
  r.owner,
  r.team,
  r.due_date,
  r.last_review,
  r.evidence_text,
  r.evidence_links,
  r.comments,
  r.created_at,
  r.updated_at
from assessment_ssdf_task_results r
join assessments a on a.id = r.assessment_id
join organizations o on o.id = a.organization_id
join ssdf_tasks t on t.id = r.ssdf_task_id
join ssdf_practices p on p.id = t.practice_id
join ssdf_groups g on g.id = p.group_id;

create or replace view bi.fact_cis_result as
select
  r.id as cis_result_id,
  r.assessment_id,
  a.organization_id,
  o.name as organization_name,
  a.name as assessment_name,
  a.unit,
  a.scope,
  r.cis_control_id,
  cc.name as cis_control_name,
  r.cis_safeguard_id,
  cs.name as cis_safeguard_name,
  cs.implementation_group,
  r.derived_status,
  r.derived_maturity_level,
  r.derived_coverage_score,
  r.derived_from_ssdf,
  r.derived_from_task_ids,
  r.manual_override,
  r.manual_status,
  r.manual_maturity_level,
  case
    when r.manual_override and r.manual_status is not null then r.manual_status
    else r.derived_status
  end as effective_status,
  case
    when r.manual_override and r.manual_maturity_level is not null then r.manual_maturity_level
    else r.derived_maturity_level
  end as effective_maturity_level,
  r.created_at,
  r.updated_at
from assessment_cis_results r
join assessments a on a.id = r.assessment_id
join organizations o on o.id = a.organization_id
left join cis_controls cc on cc.id = r.cis_control_id
left join cis_safeguards cs on cs.id = r.cis_safeguard_id;

create or replace view bi.fact_mapping as
select
  m.id as mapping_id,
  m.ssdf_task_id,
  t.name as ssdf_task_name,
  p.group_id,
  g.name as group_name,
  m.cis_control_id,
  cc.name as cis_control_name,
  m.cis_safeguard_id,
  cs.name as cis_safeguard_name,
  m.mapping_type,
  m.weight,
  m.notes,
  m.created_at,
  m.updated_at
from ssdf_cis_mappings m
join ssdf_tasks t on t.id = m.ssdf_task_id
join ssdf_practices p on p.id = t.practice_id
join ssdf_groups g on g.id = p.group_id
left join cis_controls cc on cc.id = m.cis_control_id
left join cis_safeguards cs on cs.id = m.cis_safeguard_id;

create or replace view bi.fact_evidence as
select
  e.id as evidence_id,
  e.ssdf_result_id,
  r.assessment_id,
  a.organization_id,
  o.name as organization_name,
  r.ssdf_task_id,
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
join assessment_ssdf_task_results r on r.id = e.ssdf_result_id
join assessments a on a.id = r.assessment_id
join organizations o on o.id = a.organization_id
join ssdf_tasks t on t.id = r.ssdf_task_id;
