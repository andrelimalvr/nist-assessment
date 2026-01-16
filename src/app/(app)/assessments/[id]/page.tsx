import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import AssessmentTable from "@/components/assessment/assessment-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";

export default async function AssessmentDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: {
    group?: string;
    practice?: string;
    status?: string;
    applicable?: string;
    owner?: string;
    team?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const allowEdit = canEdit(session?.user?.role);

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { organization: true }
  });

  if (!assessment) {
    notFound();
  }

  const groups = await prisma.ssdfGroup.findMany({ orderBy: { id: "asc" } });
  const practices = await prisma.ssdfPractice.findMany({ orderBy: { id: "asc" } });

  const where: any = {
    assessmentId: assessment.id
  };

  if (searchParams?.status) {
    where.status = searchParams.status;
  }

  if (searchParams?.applicable) {
    where.applicable = searchParams.applicable === "sim";
  }

  if (searchParams?.owner) {
    where.owner = { contains: searchParams.owner, mode: "insensitive" };
  }

  if (searchParams?.team) {
    where.team = { contains: searchParams.team, mode: "insensitive" };
  }

  if (searchParams?.group || searchParams?.practice) {
    where.task = {
      practice: searchParams.group ? { groupId: searchParams.group } : undefined,
      practiceId: searchParams.practice || undefined
    };
  }

  const responses = await prisma.assessmentTaskResponse.findMany({
    where,
    include: {
      task: {
        include: {
          practice: { include: { group: true } }
        }
      }
    },
    orderBy: { taskId: "asc" }
  });

  const rows = responses.map((response) => ({
    id: response.id,
    taskId: response.taskId,
    taskName: response.task.name,
    practiceId: response.task.practice.id,
    practiceName: response.task.practice.name,
    groupId: response.task.practice.group.id,
    examples: response.task.examples,
    references: response.task.references,
    applicable: response.applicable,
    status: response.status,
    maturity: response.maturity,
    target: response.target,
    weight: response.weight,
    gap: response.target - response.maturity,
    priority: (response.target - response.maturity) * response.weight,
    progressWeighted: (response.maturity / 5) * response.weight,
    owner: response.owner,
    team: response.team,
    dueDate: response.dueDate ? response.dueDate.toISOString().slice(0, 10) : null,
    lastReview: response.lastReview ? response.lastReview.toISOString().slice(0, 10) : null,
    evidenceText: response.evidenceText,
    evidenceLinks: response.evidenceLinks,
    notes: response.notes
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Assessment
        </h1>
        <p className="text-muted-foreground">
          {assessment.organization.name} - {assessment.unit} - {assessment.scope}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do escopo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Responsavel</p>
            <p className="font-semibold">{assessment.assessmentOwner}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inicio</p>
            <p className="font-semibold">{formatDate(assessment.startDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revisao</p>
            <p className="font-semibold">{formatDate(assessment.reviewDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Notas</p>
            <p className="text-sm text-muted-foreground">{assessment.notes || "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6" method="GET">
            <select
              name="group"
              defaultValue={searchParams?.group || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.id}
                </option>
              ))}
            </select>
            <select
              name="practice"
              defaultValue={searchParams?.practice || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Pratica</option>
              {practices.map((practice) => (
                <option key={practice.id} value={practice.id}>
                  {practice.id}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={searchParams?.status || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Status</option>
              <option value="NAO_INICIADO">Nao iniciado</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="IMPLEMENTADO">Implementado</option>
              <option value="NA">N/A</option>
            </select>
            <select
              name="applicable"
              defaultValue={searchParams?.applicable || ""}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="">Aplicavel</option>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </select>
            <input
              name="owner"
              defaultValue={searchParams?.owner || ""}
              placeholder="Responsavel"
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            />
            <input
              name="team"
              defaultValue={searchParams?.team || ""}
              placeholder="Area/Time"
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            />
            <button
              type="submit"
              className="md:col-span-6 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Aplicar filtros
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabela principal</CardTitle>
        </CardHeader>
        <CardContent>
          <AssessmentTable assessmentId={assessment.id} responses={rows} canEdit={allowEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
