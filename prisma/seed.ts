import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import bcrypt from "bcryptjs";
import {
  AssessmentReleaseStatus,
  DgLevel,
  EvidenceType,
  ImplementationGroup,
  MappingType,
  PrismaClient,
  Role,
  SsdfStatus
} from "@prisma/client";
import { recalculateCisForAssessment } from "../src/lib/cis/replication";

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

type CisControlSeed = {
  id: string;
  name: string;
  description?: string;
  safeguards?: Array<{
    id: string;
    name: string;
    description?: string;
    implementationGroup: ImplementationGroup;
  }>;
};

type CisMappingSeed = {
  ssdfTaskId: string;
  cisControlId?: string;
  cisSafeguardId?: string;
  mappingType: MappingType;
  weight: number;
  notes?: string;
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

function loadFromJson<T>(jsonPath: string, fallback: T): T {
  if (!fs.existsSync(jsonPath)) {
    return fallback;
  }
  const content = fs.readFileSync(jsonPath, "utf-8");
  return JSON.parse(content) as T;
}

async function seedSsdfTasks(): Promise<TaskRow[]> {
  const excelPath = process.env.SSDF_EXCEL_PATH || path.join(process.cwd(), "data", "ssdf-template.xlsx");
  const jsonPath = path.join(process.cwd(), "data", "ssdf-sample.json");

  const fromExcel = loadFromExcel(excelPath);
  const tasks = fromExcel.length > 0 ? fromExcel : loadFromJson<{ tasks: TaskRow[] }>(jsonPath, { tasks: [] }).tasks;

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

async function seedCisControls() {
  const jsonPath = path.join(process.cwd(), "data", "cis-controls-sample.json");
  const payload = loadFromJson<{ controls: CisControlSeed[] }>(jsonPath, { controls: [] });

  for (const control of payload.controls) {
    await prisma.cisControl.upsert({
      where: { id: control.id },
      update: { name: control.name, description: control.description || null },
      create: { id: control.id, name: control.name, description: control.description || null }
    });

    for (const safeguard of control.safeguards ?? []) {
      await prisma.cisSafeguard.upsert({
        where: { id: safeguard.id },
        update: {
          name: safeguard.name,
          description: safeguard.description || null,
          implementationGroup: safeguard.implementationGroup,
          controlId: control.id
        },
        create: {
          id: safeguard.id,
          name: safeguard.name,
          description: safeguard.description || null,
          implementationGroup: safeguard.implementationGroup,
          controlId: control.id
        }
      });
    }
  }
}

async function seedMappings() {
  const jsonPath = path.join(process.cwd(), "data", "ssdf-cis-mapping-sample.json");
  const payload = loadFromJson<{ mappings: CisMappingSeed[] }>(jsonPath, { mappings: [] });

  if (payload.mappings.length === 0) return;

  const [ssdfTasks, cisControls, cisSafeguards] = await Promise.all([
    prisma.ssdfTask.findMany({ select: { id: true } }),
    prisma.cisControl.findMany({ select: { id: true } }),
    prisma.cisSafeguard.findMany({ select: { id: true } })
  ]);

  const taskIds = new Set(ssdfTasks.map((task) => task.id));
  const controlIds = new Set(cisControls.map((control) => control.id));
  const safeguardIds = new Set(cisSafeguards.map((safeguard) => safeguard.id));

  const filtered = payload.mappings.filter((mapping) => {
    if (!taskIds.has(mapping.ssdfTaskId)) return false;
    if (mapping.cisSafeguardId && !safeguardIds.has(mapping.cisSafeguardId)) return false;
    if (mapping.cisControlId && !controlIds.has(mapping.cisControlId)) return false;
    return Boolean(mapping.cisSafeguardId || mapping.cisControlId);
  });

  if (filtered.length === 0) return;

  await prisma.ssdfCisMapping.createMany({
    data: filtered.map((mapping) => ({
      ssdfTaskId: mapping.ssdfTaskId,
      cisControlId: mapping.cisControlId || null,
      cisSafeguardId: mapping.cisSafeguardId || null,
      mappingType: mapping.mappingType,
      weight: mapping.weight,
      notes: mapping.notes || null
    })),
    skipDuplicates: true
  });
}

async function seedUsersAndOrganizations() {
  const org1 = await prisma.organization.upsert({
    where: { name: "VR Beneficios" },
    update: {},
    create: { name: "VR Beneficios" }
  });

  const org2 = await prisma.organization.upsert({
    where: { name: "Cliente Demo" },
    update: {},
    create: { name: "Cliente Demo" }
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@ssdf.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";

  const adminHash = bcrypt.hashSync(adminPassword, 10);
  const assessorHash = bcrypt.hashSync("Assessor123!", 10);
  const viewerHash = bcrypt.hashSync("Viewer123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
      mustChangePassword: false
    },
    create: {
      name: "Admin",
      email: adminEmail,
      passwordHash: adminHash,
      role: Role.ADMIN,
      mustChangePassword: false
    }
  });

  const assessor = await prisma.user.upsert({
    where: { email: "assessor@ssdf.local" },
    update: {
      name: "Assessor",
      passwordHash: assessorHash,
      role: Role.ASSESSOR,
      mustChangePassword: true
    },
    create: {
      name: "Assessor",
      email: "assessor@ssdf.local",
      passwordHash: assessorHash,
      role: Role.ASSESSOR,
      mustChangePassword: true
    }
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@ssdf.local" },
    update: {
      name: "Viewer",
      passwordHash: viewerHash,
      role: Role.VIEWER,
      mustChangePassword: true
    },
    create: {
      name: "Viewer",
      email: "viewer@ssdf.local",
      passwordHash: viewerHash,
      role: Role.VIEWER,
      mustChangePassword: true
    }
  });

  const userOrganizations = [
    { userId: admin.id, organizationId: org1.id },
    { userId: admin.id, organizationId: org2.id },
    { userId: assessor.id, organizationId: org1.id },
    { userId: viewer.id, organizationId: org1.id }
  ];

  await prisma.userOrganization.createMany({
    data: userOrganizations,
    skipDuplicates: true
  });

  return { org1, org2, admin };
}

async function seedAssessments(org1Id: string, org2Id: string, adminId: string) {
  const assessment1 = await prisma.assessment.upsert({
    where: { id: "demo-assessment-1" },
    update: {},
    create: {
      id: "demo-assessment-1",
      organizationId: org1Id,
      name: "SSDF 2024",
      unit: "Seguranca e Plataforma",
      scope: "Produtos digitais e APIs",
      assessmentOwner: "Maria Souza",
      dgLevel: DgLevel.DG2,
      startDate: new Date("2024-06-01"),
      reviewDate: new Date("2024-12-01"),
      notes: "Assessment demo inicial para SSDF.",
      createdById: adminId
    }
  });

  const assessment2 = await prisma.assessment.upsert({
    where: { id: "demo-assessment-2" },
    update: {},
    create: {
      id: "demo-assessment-2",
      organizationId: org2Id,
      name: "SSDF 2024",
      unit: "Engenharia",
      scope: "Squads e plataformas internas",
      assessmentOwner: "Joao Lima",
      dgLevel: DgLevel.DG1,
      startDate: new Date("2024-07-15"),
      reviewDate: new Date("2025-01-20"),
      notes: "Assessment inicial para comparativos.",
      createdById: adminId
    }
  });

  const tasks = await prisma.ssdfTask.findMany({ select: { id: true } });
  for (const assessment of [assessment1, assessment2]) {
    const existingRelease = await prisma.assessmentRelease.findFirst({
      where: { assessmentId: assessment.id },
      orderBy: { createdAt: "desc" }
    });
    if (!existingRelease) {
      await prisma.assessmentRelease.create({
        data: {
          assessmentId: assessment.id,
          status: AssessmentReleaseStatus.DRAFT,
          createdByUserId: adminId,
          notes: "Release inicial gerado no seed"
        }
      });
    }

    const existing = await prisma.assessmentSsdfTaskResult.findMany({
      where: { assessmentId: assessment.id },
      select: { ssdfTaskId: true }
    });
    const existingIds = new Set(existing.map((row) => row.ssdfTaskId));

    const responseData = tasks
      .filter((task) => !existingIds.has(task.id))
      .map((task) => ({
        assessmentId: assessment.id,
        ssdfTaskId: task.id,
        status: SsdfStatus.NOT_STARTED,
        maturityLevel: 0,
        targetLevel: 2,
        weight: 3
      }));

    if (responseData.length > 0) {
      await prisma.assessmentSsdfTaskResult.createMany({ data: responseData });
    }

    const sampleResponses = await prisma.assessmentSsdfTaskResult.findMany({
      where: { assessmentId: assessment.id },
      orderBy: { ssdfTaskId: "asc" },
      take: 6
    });

    for (const [index, response] of sampleResponses.entries()) {
      const maturityLevel = Math.min(3, index + 1);
      await prisma.assessmentSsdfTaskResult.update({
        where: { id: response.id },
        data: {
          status: index < 2 ? SsdfStatus.IMPLEMENTED : SsdfStatus.IN_PROGRESS,
          maturityLevel,
          targetLevel: 3,
          weight: 4,
          owner: "Time AppSec",
          team: "Seguranca",
          lastReview: new Date("2024-09-10"),
          evidenceText: "Evidencias registradas no backlog de seguranca.",
          evidenceLinks: ["https://example.com/evidence"],
          comments: "Revisado na sprint atual."
        }
      });
    }

    if (sampleResponses.length > 0) {
      const first = sampleResponses[0];
      const existingEvidence = await prisma.evidence.findFirst({
        where: { ssdfResultId: first.id }
      });
      if (!existingEvidence) {
        await prisma.evidence.create({
          data: {
            ssdfResultId: first.id,
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

    await recalculateCisForAssessment(prisma, assessment.id, adminId);
  }
}

async function main() {
  await seedSsdfTasks();
  await seedCisControls();
  await seedMappings();
  const { org1, org2, admin } = await seedUsersAndOrganizations();
  await seedAssessments(org1.id, org2.id, admin.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
