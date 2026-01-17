import AssessmentPicker from "@/components/assessment/assessment-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EvidenceTable from "@/components/evidences/evidence-table";
import { getServerSession } from "next-auth";
import { AssessmentReleaseStatus, EvidenceReviewStatus, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evidenceTypeOptions } from "@/lib/ssdf";
import { createEvidence } from "@/app/(app)/evidences/actions";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import { canEditAssessment } from "@/lib/assessment-editing";

export default async function EvidencesPage({
  searchParams
}: {
  searchParams?: { assessmentId?: string };
}) {
  const session = await getServerSession(authOptions);

  const accessibleOrgIds = await getAccessibleOrganizationIds(session);
  const assessmentFilter =
    session?.user?.role === Role.ADMIN || accessibleOrgIds === null
      ? { organization: { is: { deletedAt: null } }, deletedAt: null }
      : { organizationId: { in: accessibleOrgIds }, deletedAt: null };

  const assessments = await prisma.assessment.findMany({
    where: assessmentFilter,
    include: { organization: true },
    orderBy: { createdAt: "desc" }
  });

  const assessmentOptions = assessments.map((assessment) => ({
    id: assessment.id,
    label: `${assessment.organization.name} - ${assessment.name} - ${assessment.unit}`
  }));

  const selectedId = searchParams?.assessmentId ?? assessments[0]?.id;
  const selected = assessments.find((item) => item.id === selectedId);

  if (!selected) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Evidencias
        </h1>
        <p className="text-muted-foreground">Nenhum assessment encontrado.</p>
      </div>
    );
  }

  const responses = await prisma.assessmentSsdfTaskResult.findMany({
    where: { assessmentId: selected.id },
    include: { ssdfTask: { include: { practice: true } } },
    orderBy: { ssdfTaskId: "asc" }
  });

  const evidences = await prisma.evidence.findMany({
    where: { ssdfResult: { assessmentId: selected.id } },
    include: {
      ssdfResult: { include: { ssdfTask: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const release = await prisma.assessmentRelease.findFirst({
    where: { assessmentId: selected.id },
    orderBy: { createdAt: "desc" }
  });
  const releaseStatus = release?.status ?? AssessmentReleaseStatus.DRAFT;
  const canEdit = canEditAssessment({
    role: session?.user?.role,
    releaseStatus,
    editingMode: selected.editingMode
  });
  const showReadOnlyBanner =
    session?.user?.role === Role.ASSESSOR &&
    releaseStatus !== AssessmentReleaseStatus.DRAFT;
  const releaseLabel =
    releaseStatus === AssessmentReleaseStatus.APPROVED
      ? "Aprovada"
      : releaseStatus === AssessmentReleaseStatus.IN_REVIEW
        ? "Em revisao"
        : "Rascunho";

  const evidenceRows = evidences.map((evidence) => ({
    id: evidence.id,
    taskId: evidence.ssdfResult.ssdfTask.id,
    taskName: evidence.ssdfResult.ssdfTask.name,
    type: evidence.type,
    reviewStatus: evidence.reviewStatus,
    description: evidence.description,
    link: evidence.link,
    owner: evidence.owner,
    date: evidence.date ? evidence.date.toISOString() : null,
    validUntil: evidence.validUntil ? evidence.validUntil.toISOString() : null,
    dateValue: evidence.date ? evidence.date.getTime() : 0,
    validUntilValue: evidence.validUntil ? evidence.validUntil.getTime() : 0,
    notes: evidence.notes
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Evidencias
          </h1>
          <p className="text-muted-foreground">
            Registre evidencias e vincule aos itens do assessment.
          </p>
          <p className="text-xs text-muted-foreground">Revisao: {releaseLabel}</p>
        </div>
        <AssessmentPicker assessments={assessmentOptions} selectedId={selected.id} basePath="/evidences" />
      </div>

      {showReadOnlyBanner ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este assessment esta aprovado ou em revisao e nao pode ser editado. Solicite ao admin liberar uma nova revisao.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Nova evidencia</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <form action={createEvidence} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="assessmentId" value={selected.id} />
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Tarefa</label>
                <select
                  name="ssdfResultId"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  required
                >
                  <option value="">Selecione</option>
                  {responses.map((response) => (
                    <option key={response.id} value={response.id}>
                      {response.ssdfTask.id} - {response.ssdfTask.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <select
                  name="type"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  required
                >
                  {evidenceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status de revisao</label>
                <select
                  name="reviewStatus"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                >
                  <option value={EvidenceReviewStatus.PENDING}>Pendente</option>
                  <option value={EvidenceReviewStatus.APPROVED}>Aprovado</option>
                  <option value={EvidenceReviewStatus.REJECTED}>Rejeitado</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Owner</label>
                <Input name="owner" placeholder="Responsavel" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data</label>
                <Input name="date" type="date" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Validade</label>
                <Input name="validUntil" type="date" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Evidencia</label>
                <Textarea name="description" placeholder="Descricao da evidencia" required />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Link/ID</label>
                <Input name="link" placeholder="URL ou identificador" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Observacoes</label>
                <Textarea name="notes" placeholder="Observacoes adicionais" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Motivo da alteracao</label>
                <Textarea name="reason" placeholder="Opcional" />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Salvar evidencia
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Acesso somente leitura.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidencias registradas</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceTable rows={evidenceRows} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
