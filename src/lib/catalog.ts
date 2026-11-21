import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, gt } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, courseCategories, courses, enrollments, type Course } from "@/db/schema";
import { todayISO } from "@/lib/utils";

export type CatalogItem = {
  course: Course;
  categoryName: string | null;
  nextCohort: { id: string; name: string; startDate: string; available: number; capacity: number } | null;
};

export async function getCatalog(opts: {
  q?: string;
  category?: string;
  order?: string;
  page?: number;
  pageSize?: number;
  featuredOnly?: boolean;
}): Promise<{ items: CatalogItem[]; total: number; categories: Array<{ id: string; name: string; slug: string }> }> {
  const pageSize = opts.pageSize ?? 9;
  const page = Math.max(1, opts.page ?? 1);
  try {
    const conditions = [eq(courses.status, "publicado")];
    if (opts.q) conditions.push(or(ilike(courses.name, `%${opts.q}%`), ilike(courses.shortDescription, `%${opts.q}%`))!);
    if (opts.category) conditions.push(eq(courseCategories.slug, opts.category));
    if (opts.featuredOnly) conditions.push(eq(courses.featured, true));
    const where = and(...conditions);
    const orderBy =
      opts.order === "preco-asc" ? asc(courses.priceCents)
      : opts.order === "preco-desc" ? desc(courses.priceCents)
      : opts.order === "nome" ? asc(courses.name)
      : desc(courses.createdAt);

    const [rows, totals, categories] = await Promise.all([
      db
        .select({ course: courses, categoryName: courseCategories.name })
        .from(courses)
        .leftJoin(courseCategories, eq(courseCategories.id, courses.categoryId))
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: count() }).from(courses).leftJoin(courseCategories, eq(courseCategories.id, courses.categoryId)).where(where),
      db.select().from(courseCategories).orderBy(asc(courseCategories.name)),
    ]);

    const courseIds = rows.map((r) => r.course.id);
    let nextByCourse = new Map<string, CatalogItem["nextCohort"]>();
    if (courseIds.length > 0) {
      const openCohorts = await db
        .select()
        .from(cohorts)
        .where(and(inArray(cohorts.courseId, courseIds), eq(cohorts.status, "aberta"), gte(cohorts.endDate, todayISO())))
        .orderBy(asc(cohorts.startDate));
      const cohortIds = openCohorts.map((c) => c.id);
      const seatRows = cohortIds.length
        ? await db
            .select({ cohortId: enrollments.cohortId, n: count() })
            .from(enrollments)
            .where(
              and(
                inArray(enrollments.cohortId, cohortIds),
                or(
                  inArray(enrollments.status, ["ativa", "trancada", "concluida"]),
                  and(eq(enrollments.status, "pendente_pagamento"), or(isNull(enrollments.pendingExpiresAt), gt(enrollments.pendingExpiresAt, new Date()))),
                ),
              ),
            )
            .groupBy(enrollments.cohortId)
        : [];
      const seats = new Map(seatRows.map((s) => [s.cohortId, Number(s.n)]));
      for (const c of openCohorts) {
        if (!nextByCourse.has(c.courseId)) {
          const taken = seats.get(c.id) ?? 0;
          nextByCourse.set(c.courseId, { id: c.id, name: c.name, startDate: c.startDate, available: Math.max(0, c.capacity - taken), capacity: c.capacity });
        }
      }
    }
    return {
      items: rows.map((r) => ({ course: r.course, categoryName: r.categoryName, nextCohort: nextByCourse.get(r.course.id) ?? null })),
      total: Number(totals[0]?.n ?? 0),
      categories,
    };
  } catch {
    return { items: [], total: 0, categories: [] };
  }
}

export async function getCourseBySlug(slug: string) {
  try {
    const [row] = await db
      .select({ course: courses, categoryName: courseCategories.name })
      .from(courses)
      .leftJoin(courseCategories, eq(courseCategories.id, courses.categoryId))
      .where(and(eq(courses.slug, slug), eq(courses.status, "publicado")))
      .limit(1);
    if (!row) return null;
    const openCohorts = await db
      .select()
      .from(cohorts)
      .where(and(eq(cohorts.courseId, row.course.id), inArray(cohorts.status, ["aberta", "em_andamento"])))
      .orderBy(asc(cohorts.startDate));
    const withSeats = await Promise.all(
      openCohorts.map(async (c) => {
        const [{ n }] = await db
          .select({ n: count() })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.cohortId, c.id),
              or(
                inArray(enrollments.status, ["ativa", "trancada", "concluida"]),
                and(eq(enrollments.status, "pendente_pagamento"), or(isNull(enrollments.pendingExpiresAt), gt(enrollments.pendingExpiresAt, new Date()))),
              ),
            ),
          );
        return { ...c, available: Math.max(0, c.capacity - Number(n)) };
      }),
    );
    return { ...row, cohorts: withSeats };
  } catch {
    return null;
  }
}

