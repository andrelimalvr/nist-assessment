import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import bcrypt from "bcryptjs";
import { PrismaClient, Role, TaskStatus, EvidenceType } from "@prisma/client";

const prisma = new PrismaClient();

type TaskRow = {
  group: string;
  practiceId: string;
  practice: string;
  taskId: string;
  task: string;
  examples?: string;
  references?: string;
};

const GROUP_NAMES: Record<string, string> = {
  PO: "Preparar a organizacao",
  PS: "Proteger o software",
  PW: "Produzir software seguro",
  RV: "Responder a vulnerabilidades"
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function mapRow(row: Record<string, unknown>): TaskRow | null {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normKey = normalizeHeader(key);
    normalized[normKey] = String(value ?? "").trim();
  }

  const group = normalized.grupo || normalized.group || "";
  const practiceId = normalized.praticaid || normalized.practiceid || "";
  const practice = normalized.pratica || normalized.practice || "";
  const taskId = normalized.tarefaid || normalized.taskid || "";
  const task = normalized.tarefa || normalized.task || "";
  const examples = normalized.exemplos || normalized.exemplosnist || normalized.examples || "";
  const references =
    normalized.referencias || normalized.referenciasnist || normalized.references || "";

  if (!group || !practiceId || !taskId || !task) {
    return null;
  }

  return {
    group: group.trim(),
    practiceId: practiceId.trim(),
    practice: practice.trim() || practiceId.trim(),
    taskId: taskId.trim(),
    task: task.trim(),
    examples: examples.trim() || undefined,
    references: references.trim() || undefined
  };
}

function loadFromExcel(excelPath: string): TaskRow[] {
  if (!fs.existsSync(excelPath)) {
    return [];
  }

  const workbook = xlsx.readFile(excelPath);
  const sheetName =
    workbook.SheetNames.find((name) =>
      ["02_assessment", "02 assessment", "ssdf"].includes(name.toLowerCase())
    ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });

  const tasks: TaskRow[] = [];
  for (const row of json) {
    const mapped = mapRow(row);
    if (mapped) {
      tasks.push(mapped);
    }
  }

  return tasks;
}

function loadFromJson(jsonPath: string): TaskRow[] {
  if (!fs.existsSync(jsonPath)) {
    return [];
  }
  const content = fs.readFileSync(jsonPath, "utf-8");
  const parsed = JSON.parse(content) as { tasks: TaskRow[] };
  return parsed.tasks || [];
}

async function seedSsdfTasks(): Promise<TaskRow[]> {
  const excelPath = process.env.SSDF_EXCEL_PATH || path.join(process.cwd(), "data", "ssdf-template.xlsx");
  const jsonPath = path.join(process.cwd(), "data", "ssdf-sample.json");

  const fromExcel = loadFromExcel(excelPath);
  const tasks = fromExcel.length > 0 ? fromExcel : loadFromJson(jsonPath);

  if (tasks.length === 0) {
    throw new Error("Nenhuma tarefa SSDF encontrada no Excel ou no JSON de fallback.");
  }

  const groups = new Set(tasks.map((t) => t.group));
  for (const group of groups) {
    await prisma.ssdfGroup.upsert({
      where: { id: group },
      update: { name: GROUP_NAMES[group] || group },
      create: { id: group, name: GROUP_NAMES[group] || group }
    });
  }

  const practices = new Map<string, TaskRow>();
  for (const task of tasks) {
    if (!practices.has(task.practiceId)) {
      practices.set(task.practiceId, task);
    }
  }

  for (const [practiceId, task] of practices) {
    await prisma.ssdfPractice.upsert({
      where: { id: practiceId },
      update: { name: task.practice, groupId: task.group },
      create: {
        id: practiceId,
        name: task.practice,
        groupId: task.group
      }
    });
  }

  const uniqueTasks = new Map<string, TaskRow>();
  for (const task of tasks) {
    if (!uniqueTasks.has(task.taskId)) {
      uniqueTasks.set(task.taskId, task);
    }
  }

  for (const task of uniqueTasks.values()) {
    await prisma.ssdfTask.upsert({
      where: { id: task.taskId },
      update: {
        name: task.task,
        examples: task.examples,
        references: task.references,
        practiceId: task.practiceId
      },
      create: {
        id: task.taskId,
        name: task.task,
        examples: task.examples,
        references: task.references,
        practiceId: task.practiceId
      }
    });
  }

  return Array.from(uniqueTasks.values());
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@ssdf.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const assessorEmail = "assessor@ssdf.local";
  const viewerEmail = "viewer@ssdf.local";

  const adminHash = bcrypt.hashSync(adminPassword, 10);
  const assessorHash = bcrypt.hashSync("Assessor123!", 10);
  const viewerHash = bcrypt.hashSync("Viewer123!", 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Admin", passwordHash: adminHash, role: Role.ADMIN },
    create: { name: "Admin", email: adminEmail, passwordHash: adminHash, role: Role.ADMIN }
  });

  await prisma.user.upsert({
    where: { email: assessorEmail },
    update: { name: "Assessor", passwordHash: assessorHash, role: Role.ASSESSOR },
    create: {
      name: "Assessor",
      email: assessorEmail,
      passwordHash: assessorHash,
      role: Role.ASSESSOR
    }
  });

  await prisma.user.upsert({
    where: { email: viewerEmail },
    update: { name: "Viewer", passwordHash: viewerHash, role: Role.VIEWER },
    create: {
      name: "Viewer",
      email: viewerEmail,
      passwordHash: viewerHash,
      role: Role.VIEWER
    }
  });
}

async function seedDemoAssessment() {
  const organization = await prisma.organization.upsert({
    where: { name: "VR Beneficios" },
    update: {},
    create: { name: "VR Beneficios" }
  });

  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });

  const assessment = await prisma.assessment.upsert({
    where: { id: "demo-assessment" },
    update: {},
    create: {
      id: "demo-assessment",
      organizationId: organization.id,
      unit: "Seguranca e Plataforma",
      scope: "Produtos digitais e APIs",
      assessmentOwner: "Maria Souza",
      startDate: new Date("2024-06-01"),
      reviewDate: new Date("2024-12-01"),
      notes: "Assessment demo inicial para SSDF.",
      createdById: admin?.id
    }
  });

  const tasks = await prisma.ssdfTask.findMany({ select: { id: true } });
  const existing = await prisma.assessmentTaskResponse.findMany({
    where: { assessmentId: assessment.id },
    select: { taskId: true }
  });
  const existingIds = new Set(existing.map((row) => row.taskId));

  const responseData = tasks
    .filter((task) => !existingIds.has(task.id))
    .map((task) => ({
      assessmentId: assessment.id,
      taskId: task.id,
      applicable: true,
      status: TaskStatus.NAO_INICIADO,
      maturity: 0,
      target: 3,
      weight: 3
    }));

  if (responseData.length > 0) {
    await prisma.assessmentTaskResponse.createMany({ data: responseData });
  }

  const sampleResponses = await prisma.assessmentTaskResponse.findMany({
    where: { assessmentId: assessment.id },
    orderBy: { taskId: "asc" },
    take: 6
  });

  for (const [index, response] of sampleResponses.entries()) {
    const maturity = Math.min(5, index + 2);
    await prisma.assessmentTaskResponse.update({
      where: { id: response.id },
      data: {
        status: index < 2 ? TaskStatus.IMPLEMENTADO : TaskStatus.EM_ANDAMENTO,
        maturity,
        target: 4,
        weight: 4,
        owner: "Time AppSec",
        team: "Seguranca",
        lastReview: new Date("2024-09-10"),
        evidenceText: "Evidencias registradas no backlog de seguranca.",
        evidenceLinks: "https://example.com/evidence",
        notes: "Revisado na sprint atual."
      }
    });
  }

  if (sampleResponses.length > 0) {
    const first = sampleResponses[0];
    await prisma.evidence.create({
      data: {
        responseId: first.id,
        description: "Checklist de release com aprovacao AppSec",
        type: EvidenceType.DOCUMENTO,
        link: "https://example.com/checklist",
        owner: "Time AppSec",
        date: new Date("2024-09-01"),
        validUntil: new Date("2025-09-01"),
        notes: "Documento aprovado e versionado."
      }
    });
  }
}

async function main() {
  await seedSsdfTasks();
  await seedUsers();
  await seedDemoAssessment();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
