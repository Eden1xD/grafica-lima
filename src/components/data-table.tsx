"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Search, Inbox } from "lucide-react";
import { Badge, STATUS_BADGES, type BadgeVariant } from "@/components/ui";
import { brl, cn, fmtDate, fmtDateTime } from "@/lib/utils";

export type Column = {
  key: string;
  label: string;
  type?: "text" | "money" | "date" | "datetime" | "status" | "bool" | "badge";
  badgeMap?: Record<string, { label: string; variant: BadgeVariant }>;
  className?: string;
};

export type Row = { id: string; _actions?: ReactNode; [key: string]: unknown };

function cellText(col: Column, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (col.type) {
    case "money":
      return brl(Number(value));
    case "date":
      return fmtDate(String(value));
    case "datetime":
      return fmtDateTime(String(value));
    case "bool":
      return value ? "Sim" : "Não";
    case "status":
      return (col.badgeMap ?? STATUS_BADGES)[String(value)]?.label ?? String(value);
    default:
      return String(value);
  }
}

export function DataTable({
  columns,
  rows,
  pageSize = 10,
  filterKey,
  filterIncludes = false,
  exportName,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription,
  toolbar,
}: {
  columns: Column[];
  rows: Row[];
  pageSize?: number;
  filterKey?: string;
  /** Quando true, o valor da célula é uma lista "a|b|c" e o filtro casa por inclusão. */
  filterIncludes?: boolean;
  exportName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("todos");

  const filterOptions = useMemo(() => {
    if (!filterKey) return [];
    const values = filterIncludes ? rows.flatMap((r) => String(r[filterKey] ?? "").split("|")) : rows.map((r) => String(r[filterKey] ?? ""));
    return [...new Set(values)].filter(Boolean);
  }, [rows, filterKey, filterIncludes]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filterKey && filter !== "todos")
      out = out.filter((r) => (filterIncludes ? String(r[filterKey] ?? "").split("|").includes(filter) : String(r[filterKey]) === filter));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((r) => columns.some((c) => cellText(c, r[c.key]).toLowerCase().includes(needle)));
    }
    return out;
  }, [rows, q, filter, filterKey, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function exportCsv() {
    const header = columns.map((c) => c.label).join(";");
    const lines = filtered.map((r) => columns.map((c) => `"${cellText(c, r[c.key]).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["\uFEFF" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3.5">
        <div className="relative min-w-0 flex-1 basis-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Pesquisar…"
            aria-label="Pesquisar na tabela"
            className="h-9 w-full rounded-lg border border-line bg-bg pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        {filterKey ? (
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Filtrar por status"
            className="h-9 rounded-lg border border-line bg-bg px-2.5 text-sm focus:border-brand focus:outline-none"
          >
            <option value="todos">Todos</option>
            {filterOptions.map((o) => (
              <option key={o} value={o}>
                {(columns.find((c) => c.key === filterKey)?.badgeMap ?? STATUS_BADGES)[o]?.label ?? o}
              </option>
            ))}
          </select>
        ) : null}
        {toolbar}
        {exportName ? (
          <button onClick={exportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-muted transition hover:border-brand/50 hover:text-brand" aria-label="Exportar CSV">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        ) : null}
      </div>
      {slice.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Inbox className="h-8 w-8 text-muted" />
          <p className="font-semibold text-ink">{emptyTitle}</p>
          {emptyDescription ? <p className="max-w-sm text-sm text-muted">{emptyDescription}</p> : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {columns.map((c) => (
                  <th key={c.key} className={cn("px-4 py-3 font-semibold", c.className)}>
                    {c.label}
                  </th>
                ))}
                {rows.some((r) => r._actions) ? <th className="px-4 py-3 text-right font-semibold">Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-bg/60">
                  {columns.map((c) => {
                    const v = r[c.key];
                    const isBadge = c.type === "status" || c.type === "badge";
                    const map = c.badgeMap ?? STATUS_BADGES;
                    const b = map[String(v)];
                    return (
                      <td key={c.key} className={cn("px-4 py-3 text-ink", c.className)}>
                        {isBadge && v ? <Badge variant={b?.variant ?? "neutral"}>{b?.label ?? String(v)}</Badge> : cellText(c, v)}
                      </td>
                    );
                  })}
                  {rows.some((x) => x._actions) ? <td className="px-4 py-3 text-right">{r._actions}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted">
        <span>
          {filtered.length === 0 ? "0 registros" : `${safePage * pageSize + 1}–${Math.min(filtered.length, (safePage + 1) * pageSize)} de ${filtered.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Página anterior" className="flex h-7 w-7 items-center justify-center rounded-lg border border-line disabled:opacity-40 hover:border-brand/50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-1.5 font-medium">{safePage + 1} / {pages}</span>
          <button disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label="Próxima página" className="flex h-7 w-7 items-center justify-center rounded-lg border border-line disabled:opacity-40 hover:border-brand/50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}