"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ptBR } from "@/lib/i18n/ptBR";

export type AssessmentOption = {
  id: string;
  label: string;
};

type AssessmentPickerProps = {
  assessments: AssessmentOption[];
  selectedId?: string | null;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
};

export default function AssessmentPicker({
  assessments,
  selectedId,
  basePath,
  extraParams
}: AssessmentPickerProps) {
  const router = useRouter();

  if (assessments.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedId ?? assessments[0]?.id}
      onValueChange={(value) => {
        const params = new URLSearchParams();
        params.set("assessmentId", value);
        if (extraParams) {
          Object.entries(extraParams).forEach(([key, paramValue]) => {
            if (!paramValue) return;
            params.set(key, paramValue);
          });
        }
        router.push(`${basePath}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder={ptBR.common.selectAssessment} />
      </SelectTrigger>
      <SelectContent>
        {assessments.map((assessment) => (
          <SelectItem key={assessment.id} value={assessment.id}>
            {assessment.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
