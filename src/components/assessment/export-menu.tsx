"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type ExportMenuProps = {
  assessmentId: string;
  reportView?: "draft" | "official";
};

const formats = [
  { value: "pdf", label: "Relatorio PDF" },
  { value: "xlsx", label: "Excel (XLSX)" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "tsv", label: "TSV" }
];

export default function ExportMenu({ assessmentId, reportView }: ExportMenuProps) {
  const download = (format: string) => {
    const url =
      format === "pdf"
        ? `/api/reports/assessment/${assessmentId}/pdf${reportView === "official" ? "?view=official" : ""}`
        : `/api/exports/assessment/${assessmentId}?format=${format}`;
    window.location.href = url;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem key={format.value} onSelect={() => download(format.value)}>
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
