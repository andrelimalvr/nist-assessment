import Link from "next/link";
import { getServerSession } from "next-auth";
import { AssessmentReleaseStatus, DgLevel, Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import { canEditAssessment } from "@/lib/assessment-editing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAssessment } from "@/app/(app)/assessments/actions";
import { formatDate } from "@/lib/format";
import DeleteAssessmentButton from "@/components/assessments/delete-assessment-button";
import AssessmentEditDialog from "@/components/assessments/assessment-edit-dialog";

export default async function AssessmentsPage() {
  const session = await getServerSession(authOptions);
  const allowEdit = canEdit(session?.user?.role);
  const isAdmin = session?.user?.role === Role.ADMIN;

  const accessibleOrgIds = await getAccessibleOrganizationIds(session);
  const orgFilter =
    session?.user?.role === Role.ADMIN || accessibleOrgIds === null
      ? { deletedAt: null }
      : { id: { in: accessibleOrgIds }, deletedAt: null };

  const organizations = await prisma.organization.findMany({
    where: orgFilter,
    orderBy: { name: "asc" }
  });

  const assessmentFilter =
    session?.user?.role === Role.ADMIN || accessibleOrgIds === null
      ? { organization: { is: { deletedAt: null } }, deletedAt: null }
      : { organizationId: { in: accessibleOrgIds }, deletedAt: null };

  const assessments = await prisma.assessment.findMany({
    where: assessmentFilter,
    include: { organization: true },
    orderBy: { createdAt: "desc" }
  });

  const releaseStatuses = assessments.length
    ? await prisma.assessmentRelease.findMany({
        where: { assessmentId: { in: assessments.map((assessment) => assessment.id) } },
        orderBy: { createdAt: "desc" },
        select: { assessmentId: true, status: true }
      })
    : [];

  const releaseStatusByAssessmentId = new Map<string, AssessmentReleaseStatus>();
  for (const release of releaseStatuses) {
    if (!releaseStatusByAssessmentId.has(release.assessmentId)) {
      releaseStatusByAssessmentId.set(release.assessmentId, release.status);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Assessments
        </h1>
        <p className="text-muted-foreground">
          Cadastre escopos, unidades e acompanhe o progresso do SSDF.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo assessment</CardTitle>
        </CardHeader>
        <CardContent>
          {allowEdit ? (
            organizations.length > 0 ? (
              <form action={createAssessment} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Empresa</label>
                  <select
                    name="organizationId"
                    className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                    required
                  >
                    <option value="">Selecione</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do assessment</label>
                  <Input name="name" placeholder="Assessment 2024" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unidade/Area</label>
                  <Input name="unit" placeholder="Ex: Engenharia" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Escopo</label>
                  <Input name="scope" placeholder="Produtos, sistemas, squads" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Responsavel</label>
                  <Input name="assessmentOwner" placeholder="Nome do responsavel" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">DG (Design Goal)</label>
                  <select
                    name="dgLevel"
                    className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                    required
                  >
                    <option value={DgLevel.DG1}>DG1</option>
                    <option value={DgLevel.DG2}>DG2</option>
                    <option value={DgLevel.DG3}>DG3</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data de inicio</label>
                  <Input name="startDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data de revisao</label>
                  <Input name="reviewDate" type="date" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">Observacoes</label>
                  <Textarea name="notes" placeholder="Observacoes adicionais" />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">Criar assessment</Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cadastre uma organizacao antes de criar assessments.
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Acesso somente leitura.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessments cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Unidade/Area</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Revisao</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((assessment) => {
                const releaseStatus =
                  releaseStatusByAssessmentId.get(assessment.id) ?? AssessmentReleaseStatus.DRAFT;
                const canEditRow =
                  session?.user?.role === Role.ADMIN
                    ? true
                    : canEditAssessment({
                        role: session?.user?.role,
                        releaseStatus,
                        editingMode: assessment.editingMode
                      });
                const showEdit = session?.user?.role === Role.ADMIN || session?.user?.role === Role.ASSESSOR;
                return (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-semibold">{assessment.organization.name}</TableCell>
                    <TableCell>{assessment.name}</TableCell>
                    <TableCell>{assessment.unit}</TableCell>
                    <TableCell>{assessment.scope}</TableCell>
                    <TableCell>{assessment.assessmentOwner}</TableCell>
                    <TableCell>{formatDate(assessment.startDate)}</TableCell>
                    <TableCell>{formatDate(assessment.reviewDate)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm">
                          <Link href={`/assessments/${assessment.id}`}>Abrir</Link>
                        </Button>
                        {showEdit ? (
                          <AssessmentEditDialog
                            assessment={{
                              id: assessment.id,
                              organizationId: assessment.organizationId,
                              name: assessment.name,
                              unit: assessment.unit,
                              scope: assessment.scope,
                              assessmentOwner: assessment.assessmentOwner,
                              dgLevel: assessment.dgLevel,
                              startDate: assessment.startDate.toISOString(),
                              reviewDate: assessment.reviewDate ? assessment.reviewDate.toISOString() : null,
                              notes: assessment.notes
                            }}
                            organizations={organizations.map((org) => ({ id: org.id, name: org.name }))}
                            canEdit={canEditRow}
                            isAdmin={isAdmin}
                            disabledReason={
                              !canEditRow && !isAdmin
                                ? "Edicao bloqueada pelo admin ou pelo status de publicacao"
                                : null
                            }
                          />
                        ) : null}
                        {isAdmin ? (
                          <DeleteAssessmentButton
                            assessmentId={assessment.id}
                            assessmentName={assessment.name}
                            organizationName={assessment.organization.name}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {assessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    Nenhum assessment cadastrado.
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
