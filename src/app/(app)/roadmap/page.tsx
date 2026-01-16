import AssessmentPicker from "@/components/assessment/assessment-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { statusLabels } from "@/lib/ssdf";

export default async function RoadmapPage({
  searchParams
}: {
  searchParams?: {
    assessmentId?: string;
    group?: string;
    owner?: string;
    status?: string;
  };
}) {
  const assessments = await prisma.assessment.findMany({
    include: { organization: true },
    orderBy: { createdAt: "desc" }
  });

  const assessmentOptions = assessments.map((assessment) => ({
    id: assessment.id,
    label: `${assessment.organization.name} - ${assessment.unit}`
  }));

  const selectedId = searchParams?.assessmentId ?? assessments[0]?.id;
  const selected = assessments.find((item) => item.id === selectedId);

  if (!selected) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Roadmap
        </h1>
        <p className="text-muted-foreground">Nenhum assessment encontrado.</p>
      </div>
    );
  }

  const where: any = {
    assessmentId: selected.id,
    applicable: true
  };

  if (searchParams?.owner) {
    where.owner = { contains: searchParams.owner, mode: "insensitive" };
  }

  if (searchParams?.status) {
    where.status = searchParams.status;
  }

  if (searchParams?.group) {
    where.task = { practice: { groupId: searchParams.group } };
  }

  const responses = await prisma.assessmentTaskResponse.findMany({
    where,
    include: {
      task: {
        include: {
          practice: { include: { group: true } }
        }
      }
    }
  });

  const items = responses
    .map((response) => {
      const gap = response.target - response.maturity;
      const priority = gap * response.weight;
      return {
        id: response.id,
        groupId: response.task.practice.group.id,
        taskId: response.taskId,
        taskName: response.task.name,
        status: response.status,
        gap,
        priority,
        maturity: response.maturity,
        target: response.target,
        weight: response.weight,
        owner: response.owner,
        team: response.team
      };
    })
    .sort((a, b) => b.priority - a.priority);

  const groups = await prisma.ssdfGroup.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Roadmap
          </h1>
          <p className="text-muted-foreground">
            Priorize tarefas por gap e peso para orientar o plano de acao.
          </p>
        </div>
        <AssessmentPicker assessments={assessmentOptions} selectedId={selected.id} basePath="/roadmap" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4" method="GET">
            <input type="hidden" name="assessmentId" value={selected.id} />
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
            <input
              name="owner"
              defaultValue={searchParams?.owner || ""}
              placeholder="Responsavel"
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            />
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
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Aplicar
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista priorizada</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Gap</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsavel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.priority}</TableCell>
                  <TableCell>{item.groupId}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{item.taskId}</div>
                    <div className="font-medium">{item.taskName}</div>
                  </TableCell>
                  <TableCell>{item.gap}</TableCell>
                  <TableCell>{item.weight}</TableCell>
                  <TableCell>{statusLabels[item.status]}</TableCell>
                  <TableCell>{item.owner || "-"}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Nenhum item encontrado.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
