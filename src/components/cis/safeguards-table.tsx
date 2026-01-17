import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SortableTableHeader from "@/components/table/sortable-table-header";
import { formatNumber } from "@/lib/format";
import { ptBR } from "@/lib/i18n/ptBR";

type SafeguardRow = {
  safeguardId: string;
  safeguardLabel: string;
  controlId: string;
  controlLabel: string;
  ig: string;
  statusKey: string;
  statusLabel: string;
  maturity: number;
  coverage: number;
  origin: string;
  sourceTaskSortKey: string;
  sourceTasks: string;
};

type SortKey =
  | "safeguardId"
  | "controlId"
  | "ig"
  | "status"
  | "maturity"
  | "coverage"
  | "origin"
  | "sourceTask";
const DEFAULT_SORT_KEY: SortKey = "safeguardId";

type SafeguardsTableProps = {
  rows: SafeguardRow[];
};

export default function SafeguardsTable({ rows }: SafeguardsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.safeguard}
              sortKey="safeguardId"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.control}
              sortKey="controlId"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.ig}
              sortKey="ig"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.status}
              sortKey="status"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.maturity}
              sortKey="maturity"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.coverage}
              sortKey="coverage"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.columns.source}
              sortKey="origin"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
          <TableHead>
            <SortableTableHeader
              label={ptBR.cis.relatedSsdf}
              sortKey="sourceTask"
              defaultSortKey={DEFAULT_SORT_KEY}
              paramKey="safeguardsSort"
              dirParamKey="safeguardsDir"
            />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.safeguardId}>
            <TableCell className="font-medium">{row.safeguardLabel}</TableCell>
            <TableCell>{row.controlLabel}</TableCell>
            <TableCell>{row.ig}</TableCell>
            <TableCell>{row.statusLabel}</TableCell>
            <TableCell>{row.maturity}</TableCell>
            <TableCell>{formatNumber(row.coverage, 1)}%</TableCell>
            <TableCell>{row.origin}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {row.sourceTasks || ptBR.common.notAvailable}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-sm text-muted-foreground">
              {ptBR.cis.emptySafeguards}
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
