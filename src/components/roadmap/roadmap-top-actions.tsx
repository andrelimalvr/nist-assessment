import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";

export type RoadmapActionRow = {
  id: string;
  groupId: string;
  taskId: string;
  taskName: string;
  priority: number;
  gap: number;
  weight: number;
  statusLabel: string;
  owner: string | null;
};

type RoadmapTopActionsProps = {
  rows: RoadmapActionRow[];
  title?: string;
};

export default function RoadmapTopActions({ rows, title = "Top 10 proximas acoes" }: RoadmapTopActionsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Grupo</TableHead>
            <TableHead>Tarefa</TableHead>
            <TableHead>Gap</TableHead>
            <TableHead>Peso</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Responsavel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-semibold">{row.groupId}</TableCell>
              <TableCell>
                <div className="text-xs text-muted-foreground">{row.taskId}</div>
                <div className="font-medium">{row.taskName}</div>
              </TableCell>
              <TableCell>{row.gap}</TableCell>
              <TableCell>{row.weight}</TableCell>
              <TableCell>{formatNumber(row.priority, 1)}</TableCell>
              <TableCell>{row.owner || "-"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-sm text-muted-foreground">
                Nenhuma acao encontrada.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
