import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, courses, enrollments, payments, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { userIsStaff } from "@/lib/auth/guards";
import { receiptPdf, pdfResponse } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { integral: "Pagamento integral do curso", matricula: "Entrada / matricula", mensalidade: "Mensalidade" };
const METHOD: Record<string, string> = { pix: "Pix", cartao: "Cartao", dinheiro: "Dinheiro", transferencia: "Transferencia", outro: "Outro" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });
  const [row] = await db
    .select({ p: payments, e: enrollments, student: users.name, course: courses.name, cohort: cohorts.name })
    .from(payments)
    .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(eq(payments.id, id))
    .limit(1);
  if (!row) return Response.json({ error: "não encontrado" }, { status: 404 });
  if (row.e.userId !== user.id && !userIsStaff(user)) return Response.json({ error: "acesso negado" }, { status: 403 });
  if (row.p.status !== "aprovado") return Response.json({ error: "recibo disponível apenas para pagamentos aprovados" }, { status: 409 });
  const cfg = await getSettings();
  const bytes = await receiptPdf({
    receiptNumber: row.p.receiptSeq,
    studentName: row.student,
    courseName: row.course,
    cohortName: row.cohort,
    description: KIND[row.p.kind] ?? row.p.kind,
    amountCents: row.p.amountCents,
    method: METHOD[row.p.method] ?? row.p.method,
    paidAt: row.p.paidAt ?? row.p.createdAt,
    institutionName: `${cfg.institution.name} — ${cfg.institution.tagline}`,
  });
  return pdfResponse(bytes, `recibo-${String(row.p.receiptSeq).padStart(5, "0")}.pdf`);
}