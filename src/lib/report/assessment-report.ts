import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import type { AssessmentSnapshot } from "@/lib/assessment-release";

type ReportAssessment = {
  organizationName: string;
  assessmentName: string;
  unit: string;
  scope: string;
  owner: string;
  designGoal: string;
  startDate: Date;
  reviewDate: Date | null;
};

type ReportSnapshotRef = {
  label: string;
  snapshot: AssessmentSnapshot;
};

type RoadmapItem = {
  taskId: string;
  taskName: string;
  groupId: string;
  gap: number;
  weight: number;
  priority: number;
  hasEvidence: boolean;
  owner: string | null;
};

type TimelinePoint = {
  label: string;
  score: number;
  coverage: number;
};

type ReportData = {
  generatedAt: Date;
  assessment: ReportAssessment;
  current: ReportSnapshotRef;
  previous: ReportSnapshotRef | null;
  timeline: TimelinePoint[];
  cisControls: AssessmentSnapshot["cis"]["controls"];
  igStats: AssessmentSnapshot["cis"]["igStats"];
  roadmap: {
    top: RoadmapItem[];
    plan30: RoadmapItem[];
    plan60: RoadmapItem[];
    plan90: RoadmapItem[];
  };
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBarList(items: { label: string; value: number; suffix?: string }[]) {
  return items
    .map((item) => {
      const width = Math.max(0, Math.min(100, item.value * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(item.label)}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${width}%"></div>
          </div>
          <div class="bar-value">${formatPercent(item.value, 1)}${item.suffix ?? ""}</div>
        </div>
      `;
    })
    .join("");
}

function renderLineChart(points: TimelinePoint[]) {
  if (points.length === 0) return "";
  const width = 520;
  const height = 140;
  const padding = 20;
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.score, point.coverage)));
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const lineFor = (values: number[]) =>
    values
      .map((value, index) => {
        const x = padding + index * stepX;
        const y = height - padding - (value / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

  const scoreLine = lineFor(points.map((point) => point.score));
  const coverageLine = lineFor(points.map((point) => point.coverage));

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline fill="none" stroke="#2563eb" stroke-width="2" points="${scoreLine}" />
      <polyline fill="none" stroke="#10b981" stroke-width="2" points="${coverageLine}" />
    </svg>
  `;
}

export function buildAssessmentReportHtml(data: ReportData) {
  const { assessment, current, previous, timeline, cisControls, igStats, roadmap } = data;
  const groupBars = current.snapshot.groupStats.map((group) => ({
    label: group.id,
    value: group.weightedScore
  }));
  const coverageBars = current.snapshot.groupStats.map((group) => ({
    label: group.id,
    value: group.coverageRate
  }));

  const groupComparisonRows = current.snapshot.groupStats.map((group) => {
    const prev = previous?.snapshot.groupStats.find((item) => item.id === group.id);
    return {
      id: group.id,
      currentMaturity: group.maturityAvg,
      prevMaturity: prev?.maturityAvg ?? 0,
      currentCoverage: group.coverageRate,
      prevCoverage: prev?.coverageRate ?? 0
    };
  });

  const cisRows = cisControls.map((control) => ({
    id: control.controlId,
    name: control.controlName,
    safeguardsTotal: control.safeguardsTotal,
    derivedCount: control.derivedCount,
    manualOverrideCount: control.manualOverrideCount,
    gapCount: control.gapCount,
    avgMaturity: control.avgMaturity,
    avgCoverage: control.avgCoverage
  }));
  const topGapControls = [...cisRows].sort((a, b) => b.gapCount - a.gapCount).slice(0, 10);

  const timelineHtml = renderLineChart(timeline);

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Relatorio SSDF Compass</title>
      <style>
        :root {
          color-scheme: light;
        }
        body {
          font-family: "Helvetica", "Arial", sans-serif;
          margin: 0;
          padding: 32px;
          color: #0f172a;
          background: #f8fafc;
        }
        h1, h2, h3 {
          margin: 0 0 8px;
        }
        h1 { font-size: 28px; }
        h2 { font-size: 20px; }
        h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; }
        .page {
          background: #ffffff;
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }
        .cover {
          min-height: 720px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }
        .meta-item {
          background: #f1f5f9;
          border-radius: 10px;
          padding: 12px;
          font-size: 12px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          background: #ffffff;
        }
        .kpi-value {
          font-size: 24px;
          font-weight: 700;
        }
        .bar-row {
          display: grid;
          grid-template-columns: 60px 1fr 80px;
          align-items: center;
          gap: 12px;
          margin: 6px 0;
          font-size: 12px;
        }
        .bar-track {
          height: 8px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          background: #2563eb;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        thead {
          display: table-header-group;
        }
        th, td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 6px;
          text-align: left;
          vertical-align: top;
        }
        th {
          font-weight: 600;
          color: #475569;
          background: #f8fafc;
        }
        .section {
          margin-top: 20px;
        }
        .section-title {
          margin-bottom: 12px;
        }
        .timeline {
          margin-top: 12px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          background: #e2e8f0;
          border-radius: 999px;
          font-size: 11px;
        }
        .page-break {
          page-break-after: always;
        }
        .note {
          margin-top: 8px;
          font-size: 12px;
          color: #b45309;
        }
      </style>
    </head>
    <body>
      <div class="page cover page-break">
        <div>
          <h1>Relatorio SSDF Compass</h1>
          <p>Versao gerada em ${formatDateTime(data.generatedAt)}</p>
          <div class="meta-grid">
            <div class="meta-item"><strong>Empresa:</strong> ${escapeHtml(assessment.organizationName)}</div>
            <div class="meta-item"><strong>Assessment:</strong> ${escapeHtml(assessment.assessmentName)}</div>
            <div class="meta-item"><strong>Unidade/Area:</strong> ${escapeHtml(assessment.unit)}</div>
            <div class="meta-item"><strong>Escopo:</strong> ${escapeHtml(assessment.scope)}</div>
            <div class="meta-item"><strong>Responsavel:</strong> ${escapeHtml(assessment.owner)}</div>
            <div class="meta-item"><strong>DG:</strong> ${escapeHtml(assessment.designGoal)}</div>
            <div class="meta-item"><strong>Inicio:</strong> ${formatDate(assessment.startDate)}</div>
            <div class="meta-item"><strong>Revisao:</strong> ${formatDate(assessment.reviewDate)}</div>
          </div>
        </div>
        <div>
          <p class="badge">Snapshot atual: ${escapeHtml(current.label)}</p>
          ${previous ? `<p class="badge">Comparado com: ${escapeHtml(previous.label)}</p>` : ""}
        </div>
      </div>

      <div class="page page-break">
        <div class="section">
          <h2 class="section-title">Sumario executivo</h2>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-value">${formatPercent(current.snapshot.totals.coverageRate, 1)}</div>
              <div>Cobertura</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${formatPercent(current.snapshot.totals.weightedScore, 1)}</div>
              <div>Score ponderado</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value">${formatNumber(current.snapshot.totals.maturityAvg, 2)}</div>
              <div>Maturidade media</div>
            </div>
          </div>
        </div>
        <div class="section grid-2">
          <div>
            <h3>Maturidade por grupo</h3>
            ${renderBarList(groupBars)}
          </div>
          <div>
            <h3>Cobertura por grupo</h3>
            ${renderBarList(coverageBars)}
          </div>
        </div>
        <div class="section">
          <h3>Evolucao no tempo</h3>
          <div class="timeline">${timelineHtml}</div>
          ${previous ? "" : "<p class=\"note\">Somente um snapshot disponivel. Crie outro para acompanhar a evolucao.</p>"}
        </div>
      </div>

      <div class="page page-break">
        <h2 class="section-title">Comparativo SSDF</h2>
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Maturidade atual</th>
              <th>Maturidade anterior</th>
              <th>Delta</th>
              <th>Cobertura atual</th>
              <th>Cobertura anterior</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            ${groupComparisonRows
              .map((row) => {
                const deltaMaturity = row.currentMaturity - row.prevMaturity;
                const deltaCoverage = row.currentCoverage - row.prevCoverage;
                return `
                  <tr>
                    <td>${row.id}</td>
                    <td>${formatNumber(row.currentMaturity, 2)}</td>
                    <td>${formatNumber(row.prevMaturity, 2)}</td>
                    <td>${formatNumber(deltaMaturity, 2)}</td>
                    <td>${formatPercent(row.currentCoverage, 1)}</td>
                    <td>${formatPercent(row.prevCoverage, 1)}</td>
                    <td>${formatNumber(deltaCoverage * 100, 1)} pp</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="page page-break">
        <h2 class="section-title">Comparativo CIS Controls</h2>
        <table>
          <thead>
            <tr>
              <th>Controle</th>
              <th>Salvaguardas</th>
              <th>Derivados</th>
              <th>Overrides</th>
              <th>Lacunas</th>
              <th>Maturidade media</th>
              <th>Cobertura media</th>
            </tr>
          </thead>
          <tbody>
            ${cisRows
              .map((row) => {
                return `
                  <tr>
                    <td>${row.id} - ${escapeHtml(row.name)}</td>
                    <td>${row.safeguardsTotal}</td>
                    <td>${row.derivedCount}</td>
                    <td>${row.manualOverrideCount}</td>
                    <td>${row.gapCount}</td>
                    <td>${formatNumber(row.avgMaturity, 2)}</td>
                    <td>${formatPercent(row.avgCoverage, 1)}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
        <div class="section">
          <h3>Top 10 controles com maiores lacunas</h3>
          <table>
            <thead>
              <tr>
                <th>Controle</th>
                <th>Lacunas</th>
              </tr>
            </thead>
            <tbody>
              ${topGapControls
                .map((row) => {
                  return `
                    <tr>
                      <td>${row.id} - ${escapeHtml(row.name)}</td>
                      <td>${row.gapCount}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="page page-break">
        <h2 class="section-title">Top gaps e Roadmap 30/60/90</h2>
        <h3>Top 10 itens por prioridade</h3>
        <table>
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Grupo</th>
              <th>Gap</th>
              <th>Peso</th>
              <th>Prioridade</th>
              <th>Evidencia atual</th>
              <th>Owner sugerido</th>
            </tr>
          </thead>
          <tbody>
            ${roadmap.top
              .map((item) => {
                return `
                  <tr>
                    <td>${escapeHtml(item.taskId)} - ${escapeHtml(item.taskName)}</td>
                    <td>${item.groupId}</td>
                    <td>${item.gap}</td>
                    <td>${item.weight}</td>
                    <td>${formatNumber(item.priority, 1)}</td>
                    <td>${item.hasEvidence ? "Sim" : "Nao"}</td>
                    <td>${item.owner ? escapeHtml(item.owner) : "-"}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>

        <div class="section">
          <h3>Plano 30 dias</h3>
          <ul>
            ${roadmap.plan30
              .map((item) => `<li>${escapeHtml(item.taskId)} - ${escapeHtml(item.taskName)}</li>`)
              .join("")}
          </ul>
          <h3>Plano 60 dias</h3>
          <ul>
            ${roadmap.plan60
              .map((item) => `<li>${escapeHtml(item.taskId)} - ${escapeHtml(item.taskName)}</li>`)
              .join("")}
          </ul>
          <h3>Plano 90 dias</h3>
          <ul>
            ${roadmap.plan90
              .map((item) => `<li>${escapeHtml(item.taskId)} - ${escapeHtml(item.taskName)}</li>`)
              .join("")}
          </ul>
        </div>
      </div>

      <div class="page">
        <h2 class="section-title">Resumo IG</h2>
        <table>
          <thead>
            <tr>
              <th>IG</th>
              <th>Cobertura media</th>
            </tr>
          </thead>
          <tbody>
            ${igStats
              .map((ig) => {
                return `
                  <tr>
                    <td>${ig.ig}</td>
                    <td>${formatPercent(ig.avgCoverage, 1)}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </body>
  </html>
  `;
}

export type { ReportData, ReportAssessment, ReportSnapshotRef, RoadmapItem, TimelinePoint };
