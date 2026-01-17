"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const editSchema = z.object({
  name: z.string().min(3, "Nome obrigatorio").max(100, "Nome deve ter no maximo 100 caracteres")
});

type EditSchema = z.infer<typeof editSchema>;
type EditErrors = Partial<Record<keyof EditSchema, string>>;

type OrganizationEditDialogProps = {
  organization: {
    id: string;
    name: string;
  };
};

export default function OrganizationEditDialog({ organization }: OrganizationEditDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<EditErrors>({});

  const defaultValues = useMemo<EditSchema>(
    () => ({
      name: organization.name
    }),
    [organization.name]
  );

  const [formValues, setFormValues] = useState<EditSchema>(defaultValues);

  useEffect(() => {
    if (open) {
      setFormValues(defaultValues);
      setErrors({});
    }
  }, [open, defaultValues]);

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
      name: formValues.name.trim()
    };
    const result = validateForm(normalized);
    if (!result.ok) return;

    setIsSaving(true);
    const response = await fetch(`/api/organizations/${organization.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data)
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: "Erro ao atualizar empresa",
        description: data.error || "Nao foi possivel atualizar.",
        variant: "destructive"
      });
      return;
    }

    toast({ title: "Empresa atualizada com sucesso" });
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da empresa</label>
              <Input
                value={formValues.name}
                onChange={(event) => setFormValues({ name: event.target.value })}
              />
              {errors.name ? <p className="text-xs text-red-600">{errors.name}</p> : null}
            </div>
            <DialogFooter>
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
