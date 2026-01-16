import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createAssessment } from "@/app/(app)/assessments/actions";
import { formatDate } from "@/lib/format";

export default async function AssessmentsPage() {
  const session = await getServerSession(authOptions);
  const allowEdit = canEdit(session?.user?.role);

  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" }
  });

  const assessments = await prisma.assessment.findMany({
    include: { organization: true },
    orderBy: { createdAt: "desc" }
  });

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
                <TableHead>Unidade/Area</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Revisao</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-semibold">{assessment.organization.name}</TableCell>
                  <TableCell>{assessment.unit}</TableCell>
                  <TableCell>{assessment.scope}</TableCell>
                  <TableCell>{assessment.assessmentOwner}</TableCell>
                  <TableCell>{formatDate(assessment.startDate)}</TableCell>
                  <TableCell>{formatDate(assessment.reviewDate)}</TableCell>
                  <TableCell>
                    <Button asChild size="sm">
                      <Link href={`/assessments/${assessment.id}`}>Abrir</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {assessments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
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
