"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RoadmapRow } from "@/components/roadmap/roadmap-table";
import { formatNumber } from "@/lib/format";

type RoadmapInsightsProps = {
  rows: RoadmapRow[];
};

type GroupMultiplier = {
  PO: number;
  PS: number;
  PW: number;
  RV: number;
};

const defaultMultipliers: GroupMultiplier = {
  PO: 1,
  PS: 1,
  PW: 1,
  RV: 1
};

export default function RoadmapInsights({ rows }: RoadmapInsightsProps) {
  const [multipliers, setMultipliers] = useState<GroupMultiplier>(defaultMultipliers);

  const rankedRows = useMemo(() => {
    const scored = rows.map((row) => {
      const multiplier = multipliers[row.groupId as keyof GroupMultiplier] ?? 1;
      const score = row.gap * row.weight * multiplier;
      return { ...row, priorityScore: score };
    });
    return scored.sort((a, b) => b.priorityScore - a.priorityScore);
  }, [rows, multipliers]);

  const topActions = rankedRows.slice(0, 10);
  const quickWins = rankedRows.filter((row) => row.gap <= 1 && row.weight >= 3).slice(0, 5);

  const updateMultiplier = (groupId: keyof GroupMultiplier, value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setMultipliers((prev) => ({ ...prev, [groupId]: Math.max(0, parsed) }));
  };

  const reset = () => setMultipliers(defaultMultipliers);

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border bg-white/70 p-4 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold">Multiplicadores por grupo</div>
          <div className="flex flex-wrap gap-3">
            {(["PO", "PS", "PW", "RV"] as const).map((groupId) => (
              <label key={groupId} className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{groupId}</span>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={multipliers[groupId]}
                  onChange={(event) => updateMultiplier(groupId, event.target.value)}
                  className="h-8 w-20"
                />
              </label>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            Resetar
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A pontuacao considera gap * peso * multiplicador do grupo. Ajuste para simular prioridades.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Top 10 proximas acoes</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topActions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.groupId}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{row.taskId}</div>
                    <div className="font-medium">{row.taskName}</div>
                  </TableCell>
                  <TableCell>{formatNumber(row.priorityScore, 1)}</TableCell>
                </TableRow>
              ))}
              {topActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    Nenhuma acao encontrada.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Quick wins</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quickWins.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.groupId}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{row.taskId}</div>
                    <div className="font-medium">{row.taskName}</div>
                  </TableCell>
                  <TableCell>{row.gap}</TableCell>
                </TableRow>
              ))}
              {quickWins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    Nenhuma quick win encontrada.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
