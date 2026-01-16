import Link from "next/link";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createMapping } from "@/app/(app)/mappings/actions";

export default async function MappingsPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  const [ssdfTasks, cisControls, cisSafeguards, mappings] = await Promise.all([
    prisma.ssdfTask.findMany({
      include: { practice: { include: { group: true } } },
      orderBy: { id: "asc" }
    }),
    prisma.cisControl.findMany({ orderBy: { id: "asc" } }),
    prisma.cisSafeguard.findMany({
      include: { control: true },
      orderBy: { id: "asc" }
    }),
    prisma.ssdfCisMapping.findMany({
      include: {
        ssdfTask: { include: { practice: { include: { group: true } } } },
        cisControl: true,
        cisSafeguard: { include: { control: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Mapeamento SSDF x CIS
        </h1>
        <p className="text-muted-foreground">
          Ajuste os mapeamentos conforme o guia CIS/SAFECode e a realidade da empresa.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo mapeamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <form action={createMapping} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Tarefa SSDF</label>
                <select
                  name="ssdfTaskId"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  required
                >
                  <option value="">Selecione</option>
                  {ssdfTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.practice.groupId} {task.id} - {task.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CIS Control</label>
                <select
                  name="cisControlId"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                >
                  <option value="">Opcional</option>
                  {cisControls.map((control) => (
                    <option key={control.id} value={control.id}>
                      {control.id} - {control.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CIS Safeguard</label>
                <select
                  name="cisSafeguardId"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                >
                  <option value="">Opcional</option>
                  {cisSafeguards.map((safeguard) => (
                    <option key={safeguard.id} value={safeguard.id}>
                      {safeguard.id} - {safeguard.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de mapeamento</label>
                <select
                  name="mappingType"
                  className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                  required
                >
                  <option value="DIRECT">DIRECT</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="SUPPORTS">SUPPORTS</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Peso (0-1)</label>
                <Input name="weight" type="number" min={0} max={1} step={0.1} defaultValue={1} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Observacoes</label>
                <Input name="notes" placeholder="Justificativa/observacao" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Criar mapeamento</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Acesso somente leitura.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapeamentos cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SSDF</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>CIS Control</TableHead>
                <TableHead>CIS Safeguard</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{mapping.ssdfTask.id}</div>
                    <div className="font-medium">{mapping.ssdfTask.name}</div>
                  </TableCell>
                  <TableCell>{mapping.ssdfTask.practice.groupId}</TableCell>
                  <TableCell>
                    {mapping.cisControl
                      ? `${mapping.cisControl.id} - ${mapping.cisControl.name}`
                      : mapping.cisSafeguard?.control
                        ? `${mapping.cisSafeguard.control.id} - ${mapping.cisSafeguard.control.name}`
                        : "-"}
                  </TableCell>
                  <TableCell>
                    {mapping.cisSafeguard
                      ? `${mapping.cisSafeguard.id} - ${mapping.cisSafeguard.name}`
                      : "-"}
                  </TableCell>
                  <TableCell>{mapping.mappingType}</TableCell>
                  <TableCell>{mapping.weight}</TableCell>
                  <TableCell>{mapping.notes || "-"}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/mappings/${mapping.id}`}>Editar</Link>
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    Nenhum mapeamento cadastrado.
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
