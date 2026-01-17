import AssessmentPicker from "@/components/assessment/assessment-picker";
import SnapshotCreateDialog from "@/components/assessment/snapshot-create-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { getAccessibleOrganizationIds } from "@/lib/tenant";
import { AssessmentSnapshot, buildAssessmentSnapshot, normalizeSnapshot } from "@/lib/assessment-release";

type SnapshotRecord = {
  id: string;
  type: string;
  label: string | null;
  createdAt: Date;
  releaseId: string | null;
  snapshot: AssessmentSnapshot;
};

function formatSnapshotLabel(snapshot: SnapshotRecord) {
  const typeLabel =
    snapshot.type === "APPROVED"
      ? "Aprovado"
      : snapshot.type === "MANUAL"
        ? "Manual"
        : "Auto";
  const label = snapshot.label ? `${snapshot.label}` : typeLabel;
  return `${label} - ${formatDateTime(snapshot.createdAt)}`;
}

function formatDelta(value: number, decimals = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value), decimals)}`;
}

export default async function EvolutionPage({
  searchParams
}: {
  searchParams?: { assessmentId?: string; current?: string; compare?: string };
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
          Evolucao
        </h1>
        <p className="text-muted-foreground">Nenhum assessment encontrado.</p>
      </div>
    );
  }

  const snapshotRecords = await prisma.assessmentSnapshot.findMany({
    where: { assessmentId: selected.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, label: true, createdAt: true, releaseId: true, snapshot: true }
  });

  const snapshots: SnapshotRecord[] = snapshotRecords.map((record) => ({
    ...record,
    snapshot: normalizeSnapshot(record.snapshot)
  }));

  const approvedSnapshot = snapshots.find((snapshot) => snapshot.type === "APPROVED");

  const currentKey = searchParams?.current ?? "draft";
  const compareKey = searchParams?.compare ?? (approvedSnapshot ? "approved" : "previous");

  const currentSnapshot =
    currentKey === "draft"
      ? await buildAssessmentSnapshot(selected.id)
      : snapshots.find((snapshot) => snapshot.id === currentKey)?.snapshot ?? null;
  const currentLabel =
    currentKey === "draft"
      ? "Rascunho atual"
      : snapshots.find((snapshot) => snapshot.id === currentKey)
        ? formatSnapshotLabel(snapshots.find((snapshot) => snapshot.id === currentKey)!)
        : "Snapshot";

  let compareSnapshot: AssessmentSnapshot | null = null;
  let compareLabel = "Anterior";

  if (compareKey === "approved") {
    if (approvedSnapshot) {
      compareSnapshot = approvedSnapshot.snapshot;
      compareLabel = `Ultimo aprovado (${formatDateTime(approvedSnapshot.createdAt)})`;
    }
  } else if (compareKey === "previous") {
    if (currentKey === "draft") {
      if (snapshots[0]) {
        compareSnapshot = snapshots[0].snapshot;
        compareLabel = formatSnapshotLabel(snapshots[0]);
      }
    } else {
      const idx = snapshots.findIndex((snapshot) => snapshot.id === currentKey);
      const previous = idx >= 0 ? snapshots[idx + 1] : snapshots[0];
      if (previous) {
        compareSnapshot = previous.snapshot;
        compareLabel = formatSnapshotLabel(previous);
      }
    }
  } else {
    const selectedCompare = snapshots.find((snapshot) => snapshot.id === compareKey);
    if (selectedCompare) {
      compareSnapshot = selectedCompare.snapshot;
      compareLabel = formatSnapshotLabel(selectedCompare);
    }
  }

  const canCompare = Boolean(compareSnapshot);

  const groupRows = currentSnapshot
    ? currentSnapshot.groupStats.map((group) => {
        const previous = compareSnapshot?.groupStats.find((item) => item.id === group.id);
        const prevCoverage = previous?.coverageRate ?? 0;
        const prevMaturity = previous?.maturityAvg ?? 0;
        const prevScore = previous?.weightedScore ?? 0;
        return {
          groupId: group.id,
          currentMaturity: group.maturityAvg,
          previousMaturity: prevMaturity,
          deltaMaturity: group.maturityAvg - prevMaturity,
          currentCoverage: group.coverageRate,
          previousCoverage: prevCoverage,
          deltaCoverage: group.coverageRate - prevCoverage,
          currentScore: group.weightedScore,
          previousScore: prevScore,
          deltaScore: group.weightedScore - prevScore
        };
      })
    : [];

  const practiceRows = currentSnapshot
    ? currentSnapshot.practiceStats.map((practice) => {
        const previous = compareSnapshot?.practiceStats.find((item) => item.id === practice.id);
        const prevCoverage = previous?.coverageRate ?? 0;
        const prevMaturity = previous?.maturityAvg ?? 0;
        return {
          id: practice.id,
          name: practice.name,
          groupId: practice.groupId,
          currentMaturity: practice.maturityAvg,
          previousMaturity: prevMaturity,
          deltaMaturity: practice.maturityAvg - prevMaturity,
          currentCoverage: practice.coverageRate,
          previousCoverage: prevCoverage,
          deltaCoverage: practice.coverageRate - prevCoverage
        };
      })
    : [];

  const controlRows = currentSnapshot
    ? currentSnapshot.cis.controls.map((control) => {
        const previous = compareSnapshot?.cis.controls.find(
          (item) => item.controlId === control.controlId
        );
        const prevCoverage = previous?.avgCoverage ?? 0;
        const prevMaturity = previous?.avgMaturity ?? 0;
        const prevGaps = previous?.gapCount ?? 0;
        return {
          id: control.controlId,
          name: control.controlName,
          currentMaturity: control.avgMaturity,
          previousMaturity: prevMaturity,
          deltaMaturity: control.avgMaturity - prevMaturity,
          currentCoverage: control.avgCoverage,
          previousCoverage: prevCoverage,
          deltaCoverage: control.avgCoverage - prevCoverage,
          currentGaps: control.gapCount,
          previousGaps: prevGaps,
          deltaGaps: control.gapCount - prevGaps
        };
      })
    : [];

  const igRows = currentSnapshot
    ? currentSnapshot.cis.igStats.map((ig) => {
        const previous = compareSnapshot?.cis.igStats.find((item) => item.ig === ig.ig);
        const prevCoverage = previous?.avgCoverage ?? 0;
        return {
          ig: ig.ig,
          currentCoverage: ig.avgCoverage,
          previousCoverage: prevCoverage,
          deltaCoverage: ig.avgCoverage - prevCoverage
        };
      })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Evolucao
          </h1>
          <p className="text-muted-foreground">
            Compare rascunho, snapshots e releases aprovados para ver tendencia e deltas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AssessmentPicker
            assessments={assessmentOptions}
            selectedId={selected.id}
            basePath="/evolucao"
            extraParams={{ current: currentKey, compare: compareKey }}
          />
          {session?.user?.role === Role.ADMIN || session?.user?.role === Role.ASSESSOR ? (
            <SnapshotCreateDialog assessmentId={selected.id} />
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparacao selecionada</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="assessmentId" value={selected.id} />
            <select
              name="current"
              defaultValue={currentKey}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              <option value="draft">Rascunho atual</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {formatSnapshotLabel(snapshot)}
                </option>
              ))}
            </select>
            <select
              name="compare"
              defaultValue={compareKey}
              className="h-10 rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
            >
              {approvedSnapshot ? <option value="approved">Ultimo aprovado</option> : null}
              <option value="previous">Snapshot anterior</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {formatSnapshotLabel(snapshot)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Atualizar
            </button>
          </form>
          <p className="mt-3 text-sm text-muted-foreground">
            Atual: {currentLabel} {canCompare ? `| Comparando com: ${compareLabel}` : ""}
          </p>
          {!canCompare ? (
            <p className="mt-2 text-sm text-amber-700">
              Nenhum snapshot disponivel para comparar. Crie um snapshot manual ou aprove um release.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao por grupo SSDF</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Maturidade atual</TableHead>
                <TableHead>Maturidade anterior</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Cobertura atual</TableHead>
                <TableHead>Cobertura anterior</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Score atual</TableHead>
                <TableHead>Score anterior</TableHead>
                <TableHead>Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupRows.map((row) => (
                <TableRow key={row.groupId}>
                  <TableCell className="font-semibold">{row.groupId}</TableCell>
                  <TableCell>{formatNumber(row.currentMaturity, 2)}</TableCell>
                  <TableCell>{formatNumber(row.previousMaturity, 2)}</TableCell>
                  <TableCell>{formatDelta(row.deltaMaturity, 2)}</TableCell>
                  <TableCell>{formatPercent(row.currentCoverage, 1)}</TableCell>
                  <TableCell>{formatPercent(row.previousCoverage, 1)}</TableCell>
                  <TableCell>{formatDelta(row.deltaCoverage * 100, 1)} pp</TableCell>
                  <TableCell>{formatPercent(row.currentScore, 1)}</TableCell>
                  <TableCell>{formatPercent(row.previousScore, 1)}</TableCell>
                  <TableCell>{formatDelta(row.deltaScore * 100, 1)} pp</TableCell>
                </TableRow>
              ))}
              {groupRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-sm text-muted-foreground">
                    Nenhum dado de grupo disponivel.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao por pratica</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Pratica</TableHead>
                <TableHead>Maturidade atual</TableHead>
                <TableHead>Maturidade anterior</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Cobertura atual</TableHead>
                <TableHead>Cobertura anterior</TableHead>
                <TableHead>Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {practiceRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.groupId}</TableCell>
                  <TableCell>{row.id} - {row.name}</TableCell>
                  <TableCell>{formatNumber(row.currentMaturity, 2)}</TableCell>
                  <TableCell>{formatNumber(row.previousMaturity, 2)}</TableCell>
                  <TableCell>{formatDelta(row.deltaMaturity, 2)}</TableCell>
                  <TableCell>{formatPercent(row.currentCoverage, 1)}</TableCell>
                  <TableCell>{formatPercent(row.previousCoverage, 1)}</TableCell>
                  <TableCell>{formatDelta(row.deltaCoverage * 100, 1)} pp</TableCell>
                </TableRow>
              ))}
              {practiceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    Nenhum dado de pratica disponivel.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao CIS Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Controle</TableHead>
                <TableHead>Maturidade atual</TableHead>
                <TableHead>Maturidade anterior</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Cobertura atual</TableHead>
                <TableHead>Cobertura anterior</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Lacunas atuais</TableHead>
                <TableHead>Lacunas anteriores</TableHead>
                <TableHead>Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.id} - {row.name}</TableCell>
                  <TableCell>{formatNumber(row.currentMaturity, 2)}</TableCell>
                  <TableCell>{formatNumber(row.previousMaturity, 2)}</TableCell>
                  <TableCell>{formatDelta(row.deltaMaturity, 2)}</TableCell>
                  <TableCell>{formatPercent(row.currentCoverage, 1)}</TableCell>
                  <TableCell>{formatPercent(row.previousCoverage, 1)}</TableCell>
                  <TableCell>{formatDelta(row.deltaCoverage * 100, 1)} pp</TableCell>
                  <TableCell>{row.currentGaps}</TableCell>
                  <TableCell>{row.previousGaps}</TableCell>
                  <TableCell>{formatDelta(row.deltaGaps, 0)}</TableCell>
                </TableRow>
              ))}
              {controlRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-sm text-muted-foreground">
                    Nenhum dado de CIS disponivel.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao por IG</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IG</TableHead>
                <TableHead>Cobertura atual</TableHead>
                <TableHead>Cobertura anterior</TableHead>
                <TableHead>Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {igRows.map((row) => (
                <TableRow key={row.ig}>
                  <TableCell className="font-semibold">{row.ig}</TableCell>
                  <TableCell>{formatPercent(row.currentCoverage, 1)}</TableCell>
                  <TableCell>{formatPercent(row.previousCoverage, 1)}</TableCell>
                  <TableCell>{formatDelta(row.deltaCoverage * 100, 1)} pp</TableCell>
                </TableRow>
              ))}
              {igRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    Nenhum dado de IG disponivel.
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
