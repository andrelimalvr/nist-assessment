import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortableTableHeader from "@/components/table/sortable-table-header";

export type RoadmapRow = {
  id: string;
  priority: number;
  groupId: string;
  taskId: string;
  taskName: string;
  gap: number;
  weight: number;
  statusLabel: string;
  owner: string | null;
};

type SortKey = "priority" | "groupId" | "taskId" | "gap" | "weight" | "status" | "owner";
const DEFAULT_SORT_KEY: SortKey = "priority";

export default function RoadmapTable({ rows }: { rows: RoadmapRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead title="Prioridade = Gap * Peso">
            <SortableTableHeader
              label="Prioridade"
              sortKey="priority"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
              initialDirection="desc"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label="Grupo"
              sortKey="groupId"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label="Tarefa"
              sortKey="taskId"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
            />
          </TableHead>
          <TableHead title="Distancia entre alvo e maturidade">
            <SortableTableHeader
              label="Gap"
              sortKey="gap"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
            />
          </TableHead>
          <TableHead title="Peso da tarefa no score">
            <SortableTableHeader
              label="Peso"
              sortKey="weight"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label="Status"
              sortKey="status"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label="Responsavel"
              sortKey="owner"
              defaultSortKey={DEFAULT_SORT_KEY}
              defaultDirection="desc"
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-semibold">{item.priority}</TableCell>
            <TableCell>{item.groupId}</TableCell>
            <TableCell>
              <div className="text-xs text-muted-foreground">{item.taskId}</div>
              <div className="font-medium">{item.taskName}</div>
            </TableCell>
            <TableCell>{item.gap}</TableCell>
            <TableCell>{item.weight}</TableCell>
            <TableCell>{item.statusLabel}</TableCell>
            <TableCell>{item.owner || "-"}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-sm text-muted-foreground">
              Nenhum item encontrado.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
