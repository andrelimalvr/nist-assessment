import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateMapping } from "@/app/(app)/mappings/actions";

export default async function MappingEditPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === Role.ADMIN;

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Editar mapeamento
        </h1>
        <p className="text-muted-foreground">Acesso restrito ao admin.</p>
      </div>
    );
  }

  const mapping = await prisma.ssdfCisMapping.findUnique({
    where: { id: params.id },
    include: {
      ssdfTask: { include: { practice: { include: { group: true } } } }
    }
  });

  if (!mapping) {
    notFound();
  }

  const [ssdfTasks, cisControls, cisSafeguards] = await Promise.all([
    prisma.ssdfTask.findMany({
      include: { practice: { include: { group: true } } },
      orderBy: { id: "asc" }
    }),
    prisma.cisControl.findMany({ orderBy: { id: "asc" } }),
    prisma.cisSafeguard.findMany({ orderBy: { id: "asc" } })
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Editar mapeamento
          </h1>
          <p className="text-muted-foreground">{mapping.ssdfTask.id}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/mappings">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do mapeamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateMapping} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="mappingId" value={mapping.id} />
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Tarefa SSDF</label>
              <select
                name="ssdfTaskId"
                defaultValue={mapping.ssdfTaskId}
                className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                required
              >
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
                defaultValue={mapping.cisControlId ?? ""}
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
                defaultValue={mapping.cisSafeguardId ?? ""}
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
                defaultValue={mapping.mappingType}
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
              <Input
                name="weight"
                type="number"
                min={0}
                max={1}
                step={0.1}
                defaultValue={mapping.weight}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Observacoes</label>
              <Input name="notes" defaultValue={mapping.notes ?? ""} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Salvar alteracoes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
