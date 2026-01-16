import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const formats = ["xlsx", "csv", "json", "tsv"] as const;

type ExportFormat = (typeof formats)[number];

function isoDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function escapeDelimited(value: unknown, delimiter: string) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  const needsQuotes =
    stringValue.includes("\"") ||
    stringValue.includes("\n") ||
    stringValue.includes("\r") ||
    stringValue.includes(delimiter);
  const escaped = stringValue.replace(/"/g, "\"\"");
  return needsQuotes ? `"${escaped}"` : escaped;
}

function toDelimited(rows: Record<string, unknown>[], delimiter: string) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(delimiter)];
  for (const row of rows) {
    const values = headers.map((header) => escapeDelimited(row[header], delimiter));
    lines.push(values.join(delimiter));
  }
  return lines.join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const formatParam = (url.searchParams.get("format") || "xlsx").toLowerCase();
  const format = formats.includes(formatParam as ExportFormat)
    ? (formatParam as ExportFormat)
    : "xlsx";

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { organization: true }
  });

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const responses = await prisma.assessmentTaskResponse.findMany({
    where: { assessmentId: assessment.id },
    include: {
      task: {
        include: {
          practice: { include: { group: true } }
        }
      }
    },
    orderBy: { taskId: "asc" }
  });

  const evidences = await prisma.evidence.findMany({
    where: { response: { assessmentId: assessment.id } },
    include: { response: { include: { task: true } } },
    orderBy: { createdAt: "desc" }
  });

  const detailedRows = responses.map((response) => {
    const gap = response.target - response.maturity;
    const priority = gap * response.weight;
    const progressWeighted = (response.maturity / 5) * response.weight;

    return {
      Empresa: assessment.organization.name,
      "Unidade/Area": assessment.unit,
      Escopo: assessment.scope,
      Grupo: response.task.practice.group.id,
      "Grupo Nome": response.task.practice.group.name,
      "Pratica ID": response.task.practice.id,
      Pratica: response.task.practice.name,
      "Tarefa ID": response.task.id,
      Tarefa: response.task.name,
      "Exemplos (NIST)": response.task.examples ?? "",
      "Referencias (NIST)": response.task.references ?? "",
      Aplicavel: response.applicable ? "Sim" : "Nao",
      Status: response.status,
      Maturidade: response.maturity,
      Alvo: response.target,
      Gap: gap,
      Peso: response.weight,
      Prioridade: priority,
      "Evidencias / links": response.evidenceText ?? "",
      "Links adicionais": response.evidenceLinks ?? "",
      Responsavel: response.owner ?? "",
      "Area/Time": response.team ?? "",
      Prazo: isoDate(response.dueDate),
      "Ultima revisao": isoDate(response.lastReview),
      Observacoes: response.notes ?? "",
      "Progresso ponderado": Number(progressWeighted.toFixed(3))
    };
  });

  const evidenceRows = evidences.map((evidence) => ({
    "Tarefa ID": evidence.response.taskId,
    Tarefa: evidence.response.task.name,
    Tipo: evidence.type,
    Evidencia: evidence.description,
    "Link/ID": evidence.link ?? "",
    Owner: evidence.owner ?? "",
    Data: isoDate(evidence.date),
    Validade: isoDate(evidence.validUntil),
    Observacoes: evidence.notes ?? ""
  }));

  const applicableResponses = responses.filter((response) => response.applicable);
  const applicableCount = applicableResponses.length;
  const implementedCount = applicableResponses.filter(
    (response) => response.status === "IMPLEMENTADO"
  ).length;
  const weightSum = applicableResponses.reduce((sum, response) => sum + response.weight, 0);
  const weightedProgress = applicableResponses.reduce(
    (sum, response) => sum + (response.maturity / 5) * response.weight,
    0
  );
  const score = weightSum > 0 ? weightedProgress / weightSum : 0;
  const avgMaturity =
    applicableCount > 0
      ? applicableResponses.reduce((sum, response) => sum + response.maturity, 0) /
        applicableCount
      : 0;
  const avgTarget =
    applicableCount > 0
      ? applicableResponses.reduce((sum, response) => sum + response.target, 0) / applicableCount
      : 0;

  const executiveSummary = [
    { Indicador: "Empresa", Valor: assessment.organization.name },
    { Indicador: "Unidade/Area", Valor: assessment.unit },
    { Indicador: "Escopo", Valor: assessment.scope },
    { Indicador: "Responsavel", Valor: assessment.assessmentOwner },
    { Indicador: "Inicio", Valor: isoDate(assessment.startDate) },
    { Indicador: "Revisao", Valor: isoDate(assessment.reviewDate) },
    { Indicador: "Total de tarefas", Valor: responses.length },
    { Indicador: "Aplicaveis (Sim)", Valor: applicableCount },
    { Indicador: "Implementadas", Valor: implementedCount },
    { Indicador: "Percent implementadas", Valor: Number((implementedCount / (applicableCount || 1)).toFixed(4)) },
    { Indicador: "Score ponderado (0-1)", Valor: Number(score.toFixed(4)) },
    { Indicador: "Score 0-100", Valor: Number((score * 100).toFixed(2)) },
    { Indicador: "Maturidade media", Valor: Number(avgMaturity.toFixed(2)) },
    { Indicador: "Alvo medio", Valor: Number(avgTarget.toFixed(2)) },
    { Indicador: "Peso total", Valor: weightSum },
    { Indicador: "Progresso ponderado", Valor: Number(weightedProgress.toFixed(2)) }
  ];

  const groupMap = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      total: number;
      applicable: number;
      implemented: number;
      weightSum: number;
      weightedProgress: number;
    }
  >();

  for (const response of responses) {
    const group = response.task.practice.group;
    const entry = groupMap.get(group.id) ?? {
      groupId: group.id,
      groupName: group.name,
      total: 0,
      applicable: 0,
      implemented: 0,
      weightSum: 0,
      weightedProgress: 0
    };
    entry.total += 1;
    if (response.applicable) {
      entry.applicable += 1;
      if (response.status === "IMPLEMENTADO") {
        entry.implemented += 1;
      }
      entry.weightSum += response.weight;
      entry.weightedProgress += (response.maturity / 5) * response.weight;
    }
    groupMap.set(group.id, entry);
  }

  const groupSummary = Array.from(groupMap.values())
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
    .map((group) => {
      const scoreValue = group.weightSum > 0 ? group.weightedProgress / group.weightSum : 0;
      const implementedRate = group.applicable > 0 ? group.implemented / group.applicable : 0;
      return {
        Grupo: group.groupId,
        "Grupo Nome": group.groupName,
        "Tarefas (Total)": group.total,
        "Aplicaveis (Sim)": group.applicable,
        Implementadas: group.implemented,
        "Percent implementadas": Number(implementedRate.toFixed(4)),
        "Score ponderado (0-1)": Number(scoreValue.toFixed(4)),
        "Score 0-100": Number((scoreValue * 100).toFixed(2)),
        "Peso total": group.weightSum,
        "Progresso ponderado": Number(group.weightedProgress.toFixed(2))
      };
    });

  groupSummary.push({
    Grupo: "TOTAL",
    "Grupo Nome": "TOTAL",
    "Tarefas (Total)": responses.length,
    "Aplicaveis (Sim)": applicableCount,
    Implementadas: implementedCount,
    "Percent implementadas": Number((implementedCount / (applicableCount || 1)).toFixed(4)),
    "Score ponderado (0-1)": Number(score.toFixed(4)),
    "Score 0-100": Number((score * 100).toFixed(2)),
    "Peso total": weightSum,
    "Progresso ponderado": Number(weightedProgress.toFixed(2))
  });

  const practiceMap = new Map<
    string,
    {
      practiceId: string;
      practiceName: string;
      groupId: string;
      total: number;
      applicable: number;
      implemented: number;
      weightSum: number;
      weightedProgress: number;
    }
  >();

  for (const response of responses) {
    const practice = response.task.practice;
    const entry = practiceMap.get(practice.id) ?? {
      practiceId: practice.id,
      practiceName: practice.name,
      groupId: practice.group.id,
      total: 0,
      applicable: 0,
      implemented: 0,
      weightSum: 0,
      weightedProgress: 0
    };
    entry.total += 1;
    if (response.applicable) {
      entry.applicable += 1;
      if (response.status === "IMPLEMENTADO") {
        entry.implemented += 1;
      }
      entry.weightSum += response.weight;
      entry.weightedProgress += (response.maturity / 5) * response.weight;
    }
    practiceMap.set(practice.id, entry);
  }

  const practiceSummary = Array.from(practiceMap.values())
    .sort((a, b) => a.practiceId.localeCompare(b.practiceId))
    .map((practice) => {
      const scoreValue = practice.weightSum > 0 ? practice.weightedProgress / practice.weightSum : 0;
      const implementedRate = practice.applicable > 0 ? practice.implemented / practice.applicable : 0;
      return {
        "Pratica ID": practice.practiceId,
        Pratica: practice.practiceName,
        Grupo: practice.groupId,
        "Tarefas (Total)": practice.total,
        "Aplicaveis (Sim)": practice.applicable,
        Implementadas: practice.implemented,
        "Percent implementadas": Number(implementedRate.toFixed(4)),
        "Score ponderado (0-1)": Number(scoreValue.toFixed(4)),
        "Score 0-100": Number((scoreValue * 100).toFixed(2))
      };
    });

  const statusOrder = ["NAO_INICIADO", "EM_ANDAMENTO", "IMPLEMENTADO", "NA"];
  const statusSummary = statusOrder.map((status) => ({
    Status: status,
    "Contagem aplicaveis": applicableResponses.filter((response) => response.status === status)
      .length
  }));

  const roadmapTop = applicableResponses
    .map((response) => {
      const gap = response.target - response.maturity;
      return {
        Prioridade: gap * response.weight,
        Grupo: response.task.practice.group.id,
        "Pratica ID": response.task.practice.id,
        "Tarefa ID": response.task.id,
        Tarefa: response.task.name,
        Gap: gap,
        Peso: response.weight,
        Status: response.status,
        Responsavel: response.owner ?? "",
        "Area/Time": response.team ?? ""
      };
    })
    .sort((a, b) => b.Prioridade - a.Prioridade)
    .slice(0, 15);

  const fileBase = safeFileName(
    `ssdf_assessment_${assessment.organization.name}_${assessment.unit}_${assessment.id}`
  );

  if (format === "json") {
    return NextResponse.json(
      {
        assessment: {
          id: assessment.id,
          organization: assessment.organization.name,
          unit: assessment.unit,
          scope: assessment.scope,
          assessmentOwner: assessment.assessmentOwner,
          startDate: isoDate(assessment.startDate),
          reviewDate: isoDate(assessment.reviewDate)
        },
        summary: executiveSummary,
        groupSummary,
        practiceSummary,
        statusSummary,
        responses: detailedRows,
        evidences: evidenceRows,
        roadmapTop
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="${fileBase}.json"`
        }
      }
    );
  }

  if (format === "csv" || format === "tsv") {
    const delimiter = format === "csv" ? "," : "\t";
    const content = toDelimited(detailedRows, delimiter);
    return new NextResponse(content, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv" : "text/tab-separated-values",
        "Content-Disposition": `attachment; filename="${fileBase}.${format}"`
      }
    });
  }

  const workbook = xlsx.utils.book_new();
  const summarySheet = xlsx.utils.json_to_sheet(executiveSummary);
  const groupSheet = xlsx.utils.json_to_sheet(groupSummary);
  const practiceSheet = xlsx.utils.json_to_sheet(practiceSummary);
  const statusSheet = xlsx.utils.json_to_sheet(statusSummary);
  const roadmapSheet = xlsx.utils.json_to_sheet(roadmapTop);
  const responsesSheet = xlsx.utils.json_to_sheet(detailedRows);
  const evidenceSheet = xlsx.utils.json_to_sheet(evidenceRows);

  xlsx.utils.book_append_sheet(workbook, summarySheet, "Executive_Summary");
  xlsx.utils.book_append_sheet(workbook, groupSheet, "Group_Summary");
  xlsx.utils.book_append_sheet(workbook, practiceSheet, "Practice_Summary");
  xlsx.utils.book_append_sheet(workbook, statusSheet, "Status_Summary");
  xlsx.utils.book_append_sheet(workbook, roadmapSheet, "Roadmap_Top");
  xlsx.utils.book_append_sheet(workbook, responsesSheet, "Assessment_Responses");
  xlsx.utils.book_append_sheet(workbook, evidenceSheet, "Evidences");

  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`
    }
  });
}
