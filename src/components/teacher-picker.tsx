"use client";

import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Seleção pesquisável de professores responsáveis, com definição do principal. */
export function TeacherPicker({
  teachers,
  defaultSelected = [],
  defaultPrimary = null,
}: {
  teachers: Array<{ id: string; name: string }>;
  defaultSelected?: string[];
  defaultPrimary?: string | null;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [primary, setPrimary] = useState<string | null>(defaultPrimary);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? teachers.filter((t) => t.name.toLowerCase().includes(needle)) : teachers;
  }, [teachers, q]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      if (!next.includes(id) && primary === id) setPrimary(next[0] ?? null);
      if (next.includes(id) && !primary) setPrimary(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar professor…"
          aria-label="Pesquisar professor"
          className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      {teachers.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Nenhum professor cadastrado. Cadastre em Acadêmico → Professores.</p>
      ) : (
        <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto" role="list">
          {filtered.map((t) => {
            const checked = selected.includes(t.id);
            return (
              <li key={t.id} className={cn("flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition", checked ? "bg-brand-soft" : "hover:bg-surface")}>
                <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm text-ink">
                  <input type="checkbox" name="teacherIds" value={t.id} checked={checked} onChange={() => toggle(t.id)} />
                  {t.name}
                </label>
                {checked ? (
                  <label className={cn("flex cursor-pointer items-center gap-1 text-[11px] font-semibold", primary === t.id ? "text-brand" : "text-muted")} title="Definir como professor principal">
                    <input type="radio" name="primaryTeacherId" value={t.id} checked={primary === t.id} onChange={() => setPrimary(t.id)} className="h-3.5 w-3.5" />
                    <Star className={cn("h-3 w-3", primary === t.id && "fill-current")} />
                    Principal
                  </label>
                ) : null}
              </li>
            );
          })}
          {filtered.length === 0 ? <li className="px-2 py-2 text-xs text-muted">Nenhum resultado para “{q}”.</li> : null}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-muted">{selected.length} selecionado(s) · o principal aparece como responsável legado e recebe os alertas da turma.</p>
    </div>
  );
}