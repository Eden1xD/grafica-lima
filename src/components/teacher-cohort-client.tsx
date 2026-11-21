"use client";

import { useState } from "react";
import { CalendarDays, ClipboardCheck, GraduationCap, Plus } from "lucide-react";
import { createActivityAction, publishActivityAction, saveAttendanceAction, saveGradesAction, updateSessionAction } from "@/server/actions/academic";
import { cn, fmtDate, fmtScore, todayISO } from "@/lib/utils";
import { Badge, btnCls, Card, Field, Input, Select, StatusBadge, Textarea } from "@/components/ui";
import { ActionForm, Collapse, SubmitButton } from "@/components/action-form";

type RosterRow = { enrollmentId: string; name: string; status: string; attPct: number | null };
type SessionRow = {
  id: string; date: string; startTime: string; endTime: string; status: string; topic: string | null;
  records: Record<string, string>;
};
type ActivityRow = {
  id: string; title: string; type: string; subject: string; dueDate: string; maxScoreH: number; weightH: number; status: string;
  grades: Record<string, { scoreH: number | null; kind: string; published: boolean; note: string | null }>;
};

const TYPE_LABEL: Record<string, string> = { prova: "Prova", trabalho: "Trabalho", projeto: "Projeto", pratica: "Prática", atividade: "Atividade", recuperacao: "Recuperação" };

export function TeacherCohortClient({
  cohort, course, roster, sessions, activities,
}: {
  cohort: { id: string; name: string; days: string; time: string; startDate: string; endDate: string };
  course: { name: string; minGradeH: number; minAttendancePct: number };
  roster: RosterRow[];
  sessions: SessionRow[];
  activities: ActivityRow[];
}) {
  const [tab, setTab] = useState<"chamada" | "notas" | "aulas">("chamada");
  const today = todayISO();
  const defaultSession = sessions.find((s) => s.date === today) ?? [...sessions].reverse().find((s) => s.date <= today) ?? sessions[0];
  const [sessionId, setSessionId] = useState(defaultSession?.id ?? "");
  const session = sessions.find((s) => s.id === sessionId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{course.name} <span className="font-normal text-muted">· {cohort.name}</span></h1>
          <p className="text-sm text-muted">{cohort.days} · {cohort.time} · {fmtDate(cohort.startDate)} a {fmtDate(cohort.endDate)} · {roster.length} aluno(s)</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {[
            { id: "chamada" as const, label: "Chamada", icon: ClipboardCheck },
            { id: "notas" as const, label: "Atividades e notas", icon: GraduationCap },
            { id: "aulas" as const, label: "Aulas", icon: CalendarDays },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition", tab === t.id ? "bg-brand text-white" : "text-muted hover:text-brand")}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {roster.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Nenhum aluno com matrícula ativa nesta turma ainda. As matrículas aparecem aqui após a confirmação do pagamento.</Card>
      ) : null}

      {/* CHAMADA */}
      {tab === "chamada" && roster.length > 0 ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label="Aula (data)">
              <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fmtDate(s.date)} · {s.startTime}–{s.endTime} {s.status === "concluida" ? "· concluída" : s.status === "cancelada" ? "· cancelada" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {session ? <StatusBadge status={session.status} /> : null}
          </div>
          {session ? (
            <ActionForm key={session.id} action={saveAttendanceAction} className="mt-5">
              <input type="hidden" name="sessionId" value={session.id} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2.5">Aluno</th>
                      <th className="px-3 py-2.5">Frequência geral</th>
                      <th className="px-3 py-2.5">Presença</th>
                      <th className="px-3 py-2.5">Falta</th>
                      <th className="px-3 py-2.5">Justificada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => {
                      const current = session.records[r.enrollmentId] ?? "presente";
                      return (
                        <tr key={r.enrollmentId} className="border-b border-line/60 last:border-0">
                          <td className="px-3 py-3 font-semibold text-ink">{r.name}</td>
                          <td className="px-3 py-3">
                            {r.attPct === null ? <span className="text-xs text-muted">—</span> : (
                              <Badge variant={r.attPct >= course.minAttendancePct ? "success" : "warn"}>{r.attPct}%</Badge>
                            )}
                          </td>
                          {(["presente", "ausente", "justificado"] as const).map((v) => (
                            <td key={v} className="px-3 py-3">
                              <input type="radio" name={`a:${r.enrollmentId}`} value={v} defaultChecked={current === v} aria-label={`${r.name}: ${v}`} />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Justificativa (obrigatória em correções)" className="min-w-64">
                    <Input name="reason" placeholder="Ex.: atestado apresentado" />
                  </Field>
                  <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
                    <input type="checkbox" name="conclude" defaultChecked /> Marcar aula como concluída
                  </label>
                </div>
                <SubmitButton label="Salvar chamada" />
              </div>
            </ActionForm>
          ) : null}
        </Card>
      ) : null}

      {/* ATIVIDADES E NOTAS */}
      {tab === "notas" ? (
        <div className="space-y-5">
          <Collapse title="+ Nova atividade (prova, trabalho, projeto, prática, recuperação…)">
            <ActionForm action={createActivityAction} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="cohortId" value={cohort.id} />
              <Field label="Título"><Input name="title" required minLength={3} placeholder="Ex.: Prova 1 — Excel básico" /></Field>
              <Field label="Disciplina"><Input name="subject" defaultValue="Geral" required /></Field>
              <Field label="Tipo">
                <Select name="type" defaultValue="atividade">
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Data"><Input name="dueDate" type="date" required defaultValue={today} /></Field>
              <Field label="Valor máximo" hint="Ex.: 10"><Input name="maxScore" defaultValue="10" required /></Field>
              <Field label="Peso" hint="Ex.: 1 ou 2"><Input name="weight" defaultValue="1" required /></Field>
              <Field label="Descrição (opcional)" className="sm:col-span-2"><Textarea name="description" rows={2} /></Field>
              <div className="flex items-center justify-between sm:col-span-2">
                <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="publish" />Publicar imediatamente para os alunos</label>
                <SubmitButton label="Criar atividade" icon={<Plus className="h-4 w-4" />} />
              </div>
            </ActionForm>
          </Collapse>

          {activities.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted">Nenhuma atividade criada. Crie a primeira acima.</Card>
          ) : (
            activities.map((a) => (
              <Card key={a.id} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{a.title}</p>
                    <p className="text-xs text-muted">{a.subject} · {TYPE_LABEL[a.type] ?? a.type} · {fmtDate(a.dueDate)} · máx. {fmtScore(a.maxScoreH)} · peso {fmtScore(a.weightH)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.status === "rascunho" ? (
                      <ActionForm action={publishActivityAction} hidden={{ id: a.id }} submitLabel="Publicar atividade" submitVariant="soft" submitSize="sm" />
                    ) : null}
                  </div>
                </div>
                {roster.length > 0 ? (
                  <ActionForm action={saveGradesAction} className="mt-4">
                    <input type="hidden" name="activityId" value={a.id} />
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                            <th className="px-3 py-2.5">Aluno</th>
                            <th className="px-3 py-2.5">Nota / situação</th>
                            <th className="px-3 py-2.5">Observação</th>
                            <th className="px-3 py-2.5">Publicada?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.map((r) => {
                            const g = a.grades[r.enrollmentId];
                            const def = g ? (g.kind !== "nota" ? g.kind : g.scoreH !== null ? String(g.scoreH / 100).replace(".", ",") : "") : "";
                            return (
                              <tr key={r.enrollmentId} className="border-b border-line/60 last:border-0">
                                <td className="px-3 py-2.5 font-semibold text-ink">{r.name}</td>
                                <td className="px-3 py-2.5">
                                  <Input name={`g:${r.enrollmentId}`} defaultValue={def} placeholder={`0–${fmtScore(a.maxScoreH)}, ausente, nao_entregue`} className="h-9 max-w-56" />
                                </td>
                                <td className="px-3 py-2.5">
                                  <Input name={`n:${r.enrollmentId}`} defaultValue={g?.note ?? ""} placeholder="Obs. (opcional)" className="h-9" />
                                </td>
                                <td className="px-3 py-2.5">{g?.published ? <Badge variant="success">Sim</Badge> : <Badge variant="neutral">Não</Badge>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                      <Field label="Justificativa (obrigatória ao corrigir nota publicada)" className="min-w-64 flex-1">
                        <Input name="reason" placeholder="Ex.: erro de digitação na correção" />
                      </Field>
                      <div className="flex gap-2">
                        <SubmitButton label="Salvar rascunho" variant="secondary" />
                        <button type="submit" name="publish" value="on" className={btnCls("primary", "md")}>Publicar notas</button>
                      </div>
                    </div>
                  </ActionForm>
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}

      {/* AULAS */}
      {tab === "aulas" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Cancele, remarque ou conclua aulas. Alunos são notificados automaticamente em cancelamentos e remarcações.</p>
          {sessions.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">{fmtDate(s.date)} · {s.startTime}–{s.endTime}</p>
                  {s.topic ? <p className="text-xs text-muted">{s.topic}</p> : null}
                </div>
                <StatusBadge status={s.status} />
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-brand">Editar aula</summary>
                <ActionForm action={updateSessionAction} className="mt-3 grid gap-3 sm:grid-cols-5">
                  <input type="hidden" name="sessionId" value={s.id} />
                  <Field label="Data"><Input name="date" type="date" defaultValue={s.date} /></Field>
                  <Field label="Início"><Input name="startTime" type="time" defaultValue={s.startTime} /></Field>
                  <Field label="Fim"><Input name="endTime" type="time" defaultValue={s.endTime} /></Field>
                  <Field label="Status">
                    <Select name="status" defaultValue={s.status}>
                      <option value="agendada">Agendada</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </Select>
                  </Field>
                  <Field label="Conteúdo"><Input name="topic" defaultValue={s.topic ?? ""} /></Field>
                  <div className="sm:col-span-5"><SubmitButton label="Salvar aula" size="sm" /></div>
                </ActionForm>
              </details>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}