"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";

type HistoryField = {
  value: string;
  label: string;
};

type HistoryItem = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason?: string | null;
  changedAt: string;
  changedByUser?: { id: string; name: string | null; email: string | null } | null;
};

type HistoryDrawerProps = {
  title: string;
  fetchUrl: string;
  fields: HistoryField[];
  triggerLabel?: string;
};

export default function HistoryDrawer({ title, fetchUrl, fields, triggerLabel }: HistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const fieldLabels = useMemo(() => {
    const map = new Map<string, string>();
    fields.forEach((field) => map.set(field.value, field.label));
    return map;
  }, [fields]);

  useEffect(() => {
    if (!open) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (userFilter.trim()) params.set("user", userFilter.trim());
      if (fieldFilter) params.set("field", fieldFilter);
      if (fromFilter) params.set("from", fromFilter);
      if (toFilter) params.set("to", toFilter);

      const response = await fetch(`${fetchUrl}?${params.toString()}`);
      if (!response.ok) {
        setError("Erro ao carregar historico.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      setItems(data.items ?? []);
      setLoading(false);
    };

    fetchHistory();
  }, [open, userFilter, fieldFilter, fromFilter, toFilter, fetchUrl]);

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {triggerLabel ?? "Historico"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-auto right-0 top-0 flex h-full w-full max-w-xl translate-x-0 translate-y-0 flex-col gap-4 rounded-none sm:rounded-l-lg sm:rounded-r-none">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Alteracoes registradas para este item.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Usuario</label>
              <Input
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
                placeholder="Nome ou email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Campo</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-white/80 px-3 text-sm dark:bg-slate-900/70"
                value={fieldFilter}
                onChange={(event) => setFieldFilter(event.target.value)}
              >
                <option value="">Todos</option>
                {fields.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">De</label>
              <Input type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Ate</label>
              <Input type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} />
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {!loading && !error && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteracao registrada.</p>
            ) : null}
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-white/80 p-3 text-sm dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{fieldLabels.get(item.fieldName) ?? item.fieldName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(item.changedAt))}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.changedByUser?.name || item.changedByUser?.email || "Usuario desconhecido"}
                </div>
                {item.reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">Motivo: {item.reason}</p>
                ) : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/40 p-2">
                    <p className="text-xs uppercase text-muted-foreground">Antes</p>
                    <p className="text-sm">{item.oldValue ?? "-"}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/40 p-2">
                    <p className="text-xs uppercase text-muted-foreground">Depois</p>
                    <p className="text-sm">{item.newValue ?? "-"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
