"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { DgLevel } from "@prisma/client";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const optionalDateString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);

const editSchema = z
  .object({
    organizationId: z.string().min(1, "Empresa obrigatoria"),
    name: z.string().min(3, "Nome obrigatorio"),
    unitArea: z.string().min(1, "Unidade/Area obrigatoria"),
    scope: z.string().min(1, "Escopo obrigatorio"),
    ownerName: z.string().min(1, "Responsavel obrigatorio"),
    designGoal: z.nativeEnum(DgLevel),
    startDate: z.string().min(1, "Data de inicio obrigatoria"),
    reviewDate: optionalDateString,
    notes: z.string().optional()
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Data de inicio invalida"
      });
    }

    if (data.reviewDate) {
      const review = new Date(data.reviewDate);
      if (Number.isNaN(review.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewDate"],
          message: "Data de revisao invalida"
        });
      } else if (!Number.isNaN(start.getTime()) && review < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewDate"],
          message: "Data de revisao deve ser igual ou posterior a data de inicio"
        });
      }
    }
  });

type EditSchema = z.infer<typeof editSchema>;
type EditErrors = Partial<Record<keyof EditSchema, string>>;

type OrganizationOption = {
  id: string;
  name: string;
};

type AssessmentEditDialogProps = {
  assessment: {
    id: string;
    organizationId: string;
    name: string;
    unit: string;
    scope: string;
    assessmentOwner: string;
    dgLevel: DgLevel;
    startDate: string;
    reviewDate: string | null;
    notes: string | null;
  };
  organizations: OrganizationOption[];
  canEdit: boolean;
  isAdmin: boolean;
  disabledReason?: string | null;
};

function formatDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function AssessmentEditDialog({
  assessment,
  organizations,
  canEdit,
  isAdmin,
  disabledReason
}: AssessmentEditDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<EditErrors>({});

  const defaultValues = useMemo<EditSchema>(
    () => ({
      organizationId: assessment.organizationId,
      name: assessment.name,
      unitArea: assessment.unit,
      scope: assessment.scope,
      ownerName: assessment.assessmentOwner,
      designGoal: assessment.dgLevel,
      startDate: formatDateInput(assessment.startDate),
      reviewDate: formatDateInput(assessment.reviewDate),
      notes: assessment.notes ?? ""
    }),
    [assessment]
  );

  const [formValues, setFormValues] = useState<EditSchema>(defaultValues);

  useEffect(() => {
    if (open) {
      setFormValues(defaultValues);
      setErrors({});
    }
  }, [open, defaultValues]);

  const setField = <K extends keyof EditSchema>(field: K, value: EditSchema[K]) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (values: EditSchema) => {
    const parsed = editSchema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return { ok: true as const, data: parsed.data };
    }

    const fieldErrors: EditErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof EditSchema | undefined;
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return { ok: false as const };
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized: EditSchema = {
      ...formValues,
      reviewDate: formValues.reviewDate?.trim() ? formValues.reviewDate : undefined,
      notes: formValues.notes?.trim() ? formValues.notes : undefined
    };
    const result = validateForm(normalized);
    if (!result.ok) return;

    setIsSaving(true);
    const response = await fetch(`/api/assessments/${assessment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data)
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: "Erro ao atualizar assessment",
        description: data.error || "Nao foi possivel atualizar.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Assessment atualizado com sucesso"
    });
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <span title={!canEdit && disabledReason ? disabledReason : undefined}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canEdit}
          onClick={() => setOpen(true)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar assessment</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <select
                value={formValues.organizationId}
                onChange={(event) => setField("organizationId", event.target.value)}
                disabled={!isAdmin}
                className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-900/70"
              >
                <option value="">Selecione</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {errors.organizationId ? (
                <p className="text-xs text-red-600">{errors.organizationId}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do assessment</label>
              <Input
                value={formValues.name}
                onChange={(event) => setField("name", event.target.value)}
              />
              {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Unidade/Area</label>
              <Input
                value={formValues.unitArea}
                onChange={(event) => setField("unitArea", event.target.value)}
              />
              {errors.unitArea ? (
                <p className="text-xs text-red-600">{errors.unitArea}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Escopo</label>
              <Input
                value={formValues.scope}
                onChange={(event) => setField("scope", event.target.value)}
              />
              {errors.scope ? <p className="text-xs text-red-600">{errors.scope}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsavel</label>
              <Input
                value={formValues.ownerName}
                onChange={(event) => setField("ownerName", event.target.value)}
              />
              {errors.ownerName ? (
                <p className="text-xs text-red-600">{errors.ownerName}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">DG (Design Goal)</label>
              <select
                value={formValues.designGoal}
                onChange={(event) => setField("designGoal", event.target.value as DgLevel)}
                className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
              >
                <option value={DgLevel.DG1}>DG1</option>
                <option value={DgLevel.DG2}>DG2</option>
                <option value={DgLevel.DG3}>DG3</option>
              </select>
              {errors.designGoal ? (
                <p className="text-xs text-red-600">{errors.designGoal}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de inicio</label>
              <Input
                type="date"
                value={formValues.startDate}
                onChange={(event) => setField("startDate", event.target.value)}
              />
              {errors.startDate ? (
                <p className="text-xs text-red-600">{errors.startDate}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de revisao</label>
              <Input
                type="date"
                value={formValues.reviewDate ?? ""}
                onChange={(event) => setField("reviewDate", event.target.value)}
              />
              {errors.reviewDate ? (
                <p className="text-xs text-red-600">{errors.reviewDate}</p>
              ) : null}
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Observacoes</label>
              <Textarea
                rows={4}
                value={formValues.notes ?? ""}
                onChange={(event) => setField("notes", event.target.value)}
              />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar alteracoes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
