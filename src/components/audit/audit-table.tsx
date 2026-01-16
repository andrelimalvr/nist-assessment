"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AuditSortHeader from "@/components/audit/audit-sort-header";

export type AuditRow = {
  id: string;
  timestamp: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string | null;
  fieldName: string | null;
  organizationName: string | null;
  success: boolean;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
};

type AuditTableProps = {
  rows: AuditRow[];
};

export default function AuditTable({ rows }: AuditTableProps) {
  const [selected, setSelected] = useState<AuditRow | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <AuditSortHeader label="Data/Hora" sortKey="timestamp" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Acao" sortKey="action" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Usuario" sortKey="user" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Funcao" sortKey="role" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Entidade" sortKey="entity" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Campo" sortKey="field" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Organizacao" sortKey="organization" />
            </TableHead>
            <TableHead>
              <AuditSortHeader label="Resultado" sortKey="result" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => setSelected(row)}
            >
              <TableCell className="font-medium">{row.timestamp}</TableCell>
              <TableCell>{row.action}</TableCell>
              <TableCell>{row.actorEmail || "-"}</TableCell>
              <TableCell>{row.actorRole || "-"}</TableCell>
              <TableCell>{row.entityType || "-"}</TableCell>
              <TableCell>{row.fieldName || "-"}</TableCell>
              <TableCell>{row.organizationName || "-"}</TableCell>
              <TableCell>{row.success ? "Sucesso" : "Falha"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-sm text-muted-foreground">
                Nenhum log encontrado.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => (!open ? setSelected(null) : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do log</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{selected.timestamp}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Acao</p>
                  <p className="font-medium">{selected.action}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="font-medium">{selected.actorEmail || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Funcao</p>
                  <p className="font-medium">{selected.actorRole || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entidade</p>
                  <p className="font-medium">{selected.entityType || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Campo</p>
                  <p className="font-medium">{selected.fieldName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Organizacao</p>
                  <p className="font-medium">{selected.organizationName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resultado</p>
                  <p className="font-medium">{selected.success ? "Sucesso" : "Falha"}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Old value</p>
                <p className="font-mono text-xs break-words">{selected.oldValue || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">New value</p>
                <p className="font-mono text-xs break-words">{selected.newValue || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Metadata</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
                  {JSON.stringify(selected.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
