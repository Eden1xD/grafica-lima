import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseCategories, courses } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { DataTable } from "@/components/data-table";
import { Collapse } from "@/components/action-form";
import { CourseForm, CategoryQuickForm, RoomQuickForm } from "@/components/admin-forms";
import { LinkButton, PageTitle } from "@/components/ui";
import { AdminCourseDelete } from "@/components/admin-course-delete";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cursos — administração" };

export default async function AdminCursosPage() {
  const actor = await requireRole(STAFF, "/admin/cursos");
  const canDelete = actor.roles.includes("admin");
  const rows = await db.select({ course: courses, category: courseCategories.name })
    .from(courses)
    .leftJoin(courseCategories, eq(courseCategories.id, courses.categoryId))
    .orderBy(asc(courses.name));
  const categories = await db.select().from(courseCategories).orderBy(asc(courseCategories.name));

  return (
    <div>
      <PageTitle title="Cursos" description="Catálogo, preços, regras de certificação e publicação." />
      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        <Collapse title="+ Novo curso"><CourseForm categories={categories} /></Collapse>
        <Collapse title="+ Categoria"><CategoryQuickForm /></Collapse>
        <Collapse title="+ Sala"><RoomQuickForm /></Collapse>
      </div>
      <DataTable
        exportName="cursos"
        filterKey="status"
        columns={[
          { key: "name", label: "Curso" },
          { key: "category", label: "Categoria" },
          { key: "priceCents", label: "Valor", type: "money" },
          { key: "workloadHours", label: "Carga (h)" },
          { key: "featured", label: "Destaque", type: "bool" },
          { key: "status", label: "Status", type: "status" },
        ]}
        rows={rows.map(({ course, category }) => ({
          id: course.id,
          name: course.name,
          category: category ?? "—",
          priceCents: course.priceCents,
          workloadHours: course.workloadHours,
          featured: course.featured,
          status: course.status,
          _actions: (
            <div className="flex items-center justify-end gap-2">
              <LinkButton href={`/admin/cursos/${course.id}`} variant="secondary" size="sm">Editar</LinkButton>
              {canDelete ? <AdminCourseDelete id={course.id} name={course.name} /> : null}
            </div>
          ),
        }))}
        emptyTitle="Nenhum curso cadastrado"
        emptyDescription="Crie o primeiro curso no painel acima."
      />
    </div>
  );
}
