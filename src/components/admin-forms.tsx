import type { Course } from "@/db/schema";
import { classrooms, courseCategories } from "@/db/schema";
import { CheckCircle2 } from "lucide-react";
import { saveCourseAction, saveCohortAction, createCategoryAction, createClassroomAction } from "@/server/actions/admin-courses";
import { ActionForm } from "@/components/action-form";
import { TeacherPicker } from "@/components/teacher-picker";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { WEEKDAYS } from "@/lib/utils";

type Classroom = typeof classrooms.$inferSelect;

type Category = typeof courseCategories.$inferSelect;
type CohortLike = {
  id: string; name: string; courseId: string; teacherId: string | null; roomId: string | null;
  daysOfWeek: number[]; startTime: string; endTime: string; startDate: string; endDate: string; capacity: number; status: string;
  extraTeacherIds?: string[];
};

export function CourseForm({ course, categories }: { course?: Course; categories: Category[] }) {
  return (
    <ActionForm action={saveCourseAction} submitLabel={course ? "Salvar alterações" : "Criar curso"} className="grid gap-4 sm:grid-cols-2">
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <Field label="Nome do curso"><Input name="name" required minLength={3} defaultValue={course?.name ?? ""} /></Field>
      <Field label="Categoria">
        <Select name="categoryId" defaultValue={course?.categoryId ?? ""}>
          <option value="">Sem categoria</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Descrição curta (card)" className="sm:col-span-2"><Input name="shortDescription" defaultValue={course?.shortDescription ?? ""} maxLength={200} /></Field>
      <Field label="Descrição completa" className="sm:col-span-2"><Textarea name="description" rows={4} defaultValue={course?.description ?? ""} /></Field>
      <Field label="URL da imagem" hint="Cole uma URL de imagem (https://…)" className="sm:col-span-2"><Input name="imageUrl" defaultValue={course?.imageUrl ?? ""} /></Field>
      <Field label="Carga horária (h)"><Input name="workloadHours" type="number" min={1} defaultValue={course?.workloadHours ?? 40} required /></Field>
      <Field label="Duração (meses)"><Input name="durationMonths" type="number" min={1} defaultValue={course?.durationMonths ?? 3} required /></Field>
      <Field label="Valor total (R$)" hint="Ex.: 890,00"><Input name="price" required defaultValue={course ? (course.priceCents / 100).toFixed(2).replace(".", ",") : ""} /></Field>
      <Field label="Entrada do plano mensal (R$)" hint="Ex.: 150,00"><Input name="entry" defaultValue={course ? (course.entryCents / 100).toFixed(2).replace(".", ",") : "0"} /></Field>
      <Field label="Máx. mensalidades / parcelas"><Input name="maxInstallments" type="number" min={1} max={12} defaultValue={course?.maxInstallments ?? 4} required /></Field>
      <Field label="Frequência mínima (%)"><Input name="minAttendancePct" type="number" min={0} max={100} defaultValue={course?.minAttendancePct ?? 75} required /></Field>
      <Field label="Média mínima (0–10)"><Input name="minGrade" defaultValue={course ? String(course.minGradeH / 100) : "7"} required /></Field>
      <Field label="Status">
        <Select name="status" defaultValue={course?.status ?? "rascunho"}>
          <option value="rascunho">Rascunho</option>
          <option value="publicado">Publicado</option>
          <option value="arquivado">Arquivado</option>
        </Select>
      </Field>
      <Field label="Pré-requisitos"><Textarea name="prerequisites" rows={2} defaultValue={course?.prerequisites ?? ""} /></Field>
      <Field label="Materiais incluídos"><Textarea name="materials" rows={2} defaultValue={course?.materials ?? ""} /></Field>
      <Field label="Conteúdo programático (um item por linha)" className="sm:col-span-2"><Textarea name="syllabus" rows={5} defaultValue={course?.syllabus ?? ""} /></Field>
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="certificateEnabled" defaultChecked={course?.certificateEnabled ?? true} />Emite certificado</label>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="featured" defaultChecked={course?.featured ?? false} />Destaque na home</label>
      </div>
    </ActionForm>
  );
}

export function CohortForm({ cohort, courses, teachers, rooms, defaultCourseId }: {
  cohort?: CohortLike;
  courses: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string }>;
  rooms: Classroom[];
  defaultCourseId?: string;
}) {
  return (
    <ActionForm action={saveCohortAction} submitLabel={cohort ? "Salvar turma" : "Criar turma e gerar aulas"} className="grid gap-4 sm:grid-cols-2">
      {cohort ? <input type="hidden" name="id" value={cohort.id} /> : null}
      <Field label="Nome da turma"><Input name="name" required defaultValue={cohort?.name ?? ""} placeholder="Ex.: TURMA A — noite" /></Field>
      <Field label="Curso">
        <Select name="courseId" defaultValue={cohort?.courseId ?? defaultCourseId ?? ""} required>
          <option value="" disabled>Selecione…</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Sala">
        <Select name="roomId" defaultValue={cohort?.roomId ?? ""}>
          <option value="">A definir</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity} lugares)</option>)}
        </Select>
      </Field>
      <Field label="Professores responsáveis" className="sm:col-span-2" hint="Pesquise, selecione vários e defina o principal. Conflitos de horário são verificados no servidor.">
        <TeacherPicker
          teachers={teachers}
          defaultSelected={cohort ? [...new Set([cohort.teacherId, ...(cohort.extraTeacherIds ?? [])].filter(Boolean) as string[])] : []}
          defaultPrimary={cohort?.teacherId ?? null}
        />
      </Field>
      <Field label="Dias da semana" className="sm:col-span-2">
        <div className="flex flex-wrap gap-3 pt-1">
          {WEEKDAYS.map((d, i) => (
            <label key={i} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="checkbox" name="days" value={i} defaultChecked={cohort?.daysOfWeek.includes(i) ?? (i >= 1 && i <= 5)} />
              {d.slice(0, 3)}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Horário inicial"><Input name="startTime" type="time" required defaultValue={cohort?.startTime ?? "19:00"} /></Field>
      <Field label="Horário final"><Input name="endTime" type="time" required defaultValue={cohort?.endTime ?? "21:00"} /></Field>
      <Field label="Data de início"><Input name="startDate" type="date" required defaultValue={cohort?.startDate ?? ""} /></Field>
      <Field label="Data de término"><Input name="endDate" type="date" required defaultValue={cohort?.endDate ?? ""} /></Field>
      <Field label="Capacidade (vagas)"><Input name="capacity" type="number" min={1} max={200} required defaultValue={cohort?.capacity ?? 15} /></Field>
      <Field label="Status">
        <Select name="status" defaultValue={cohort?.status ?? "aberta"}>
          <option value="aberta">Aberta (matrículas liberadas)</option>
          <option value="em_andamento">Em andamento</option>
          <option value="encerrada">Encerrada</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </Field>
      <p className="text-xs text-muted sm:col-span-2"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-success" />Conflitos de professor e sala são verificados automaticamente. As aulas são geradas no calendário ao salvar.</p>
    </ActionForm>
  );
}

export function CategoryQuickForm() {
  return (
    <ActionForm action={createCategoryAction} submitLabel="Criar categoria" submitSize="sm" className="flex items-end gap-3">
      <Field label="Nova categoria"><Input name="name" required minLength={2} placeholder="Ex.: Informática" /></Field>
    </ActionForm>
  );
}

export function RoomQuickForm() {
  return (
    <ActionForm action={createClassroomAction} submitLabel="Criar sala" submitSize="sm" className="flex items-end gap-3">
      <Field label="Nome da sala"><Input name="name" required minLength={2} placeholder="Ex.: Laboratório 1" /></Field>
      <Field label="Capacidade"><Input name="capacity" type="number" min={1} defaultValue={20} className="w-24" /></Field>
    </ActionForm>
  );
}