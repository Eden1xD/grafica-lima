/**
 * Teste de integração real (PostgreSQL): execute com
 *   npm exec tsx -- scripts/integration-test.ts
 * Cria dados de teste isolados e os remove ao final.
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  activities, attendanceRecords, certificates, classSessions, cohorts, enrollments,
  grades, notifications, payments, userRoles, users,
} from "../src/db/schema";
import { getUserRoles } from "../src/lib/auth/session";
import { userIdsByRole } from "../src/lib/notifications";
import { approvePayment, takenSeats } from "../src/lib/payments/core";
import { publishedGrades, attendanceForEnrollment } from "../src/lib/academic";
import { certificateEligibility } from "../src/lib/domain";
import { certificatePdf } from "../src/lib/pdf";
import { randomCode } from "../src/lib/crypto";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✔" : "✘ FAIL"} ${name}`);
  if (!cond) failures++;
}

async function main() {
  const stamp = Date.now();
  const [u1] = await db.insert(users).values({ name: "Teste Um", email: `teste1+${stamp}@example.com`, role: "aluno" }).returning();
  const [u2] = await db.insert(users).values({ name: "Teste Dois", email: `teste2+${stamp}@example.com`, role: "aluno" }).returning();
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.status, "aberta")).limit(1);
  if (!cohort) throw new Error("Rode o seed antes (nenhuma turma aberta).");
  const originalCapacity = cohort.capacity;
  let enrollmentId = "";
  let activityId = "";
  let sessionId = "";

  try {
    // 1) Matrícula pendente + pagamento manual → ativação
    const [e] = await db.insert(enrollments).values({ userId: u1.id, cohortId: cohort.id, plan: "integral", totalCents: 69000, pendingExpiresAt: new Date(Date.now() + 3600e3) }).returning();
    enrollmentId = e.id;
    const [p] = await db.insert(payments).values({ enrollmentId: e.id, kind: "integral", method: "dinheiro", provider: "manual", amountCents: 69000 }).returning();
    const res = await approvePayment(p.id, "manual", null);
    const [after] = await db.select().from(enrollments).where(eq(enrollments.id, e.id));
    check("pagamento aprovado ativa a matrícula", res?.activated === true && after.status === "ativa");
    const [payAfter] = await db.select().from(payments).where(eq(payments.id, p.id));
    check("pagamento marcado como aprovado com data", payAfter.status === "aprovado" && !!payAfter.paidAt);
    const notifs = await db.select().from(notifications).where(eq(notifications.userId, u1.id));
    check("notificações reais criadas (pagamento + matrícula)", notifs.some((n) => n.type === "pagamento") && notifs.some((n) => n.type === "matricula"));

    // 2) Idempotência
    const res2 = await approvePayment(p.id, "webhook", null);
    const notifs2 = await db.select().from(notifications).where(eq(notifications.userId, u1.id));
    check("aprovação idempotente (sem duplicar efeitos)", res2?.activated === false && notifs2.length === notifs.length);

    // 3) Concorrência de vagas: capacidade = ocupadas + 1, duas transações simultâneas
    const taken = await takenSeats(cohort.id);
    await db.update(cohorts).set({ capacity: taken + 1 }).where(eq(cohorts.id, cohort.id));
    const attempt = (userId: string) =>
      db.transaction(async (tx) => {
        const [locked] = await tx.select().from(cohorts).where(eq(cohorts.id, cohort.id)).for("update");
        const t = await takenSeats(cohort.id, tx);
        if (t >= locked.capacity) throw new Error("Turma lotada");
        const [row] = await tx.insert(enrollments).values({ userId, cohortId: cohort.id, plan: "integral", totalCents: 69000 }).returning();
        return row.id;
      });
    const results = await Promise.allSettled([attempt(u1.id), attempt(u2.id)]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    check("lock de capacidade impede overbooking (exatamente 1 de 2)", okCount === 1);
    for (const r of results) {
      if (r.status === "fulfilled") await db.delete(enrollments).where(eq(enrollments.id, r.value));
    }
    // duplicidade do mesmo aluno na mesma turma (índice único parcial)
    let dupBlocked = false;
    try {
      await db.insert(enrollments).values({ userId: u1.id, cohortId: cohort.id, plan: "integral", totalCents: 1 });
    } catch {
      dupBlocked = true;
    }
    check("índice único bloqueia matrícula duplicada ativa", dupBlocked);

    // 4) Notas: rascunho invisível → publicação visível
    const [act] = await db.insert(activities).values({ cohortId: cohort.id, title: "Prova Teste", type: "prova", subject: "Teste", dueDate: "2026-01-10", maxScoreH: 1000, weightH: 100, status: "publicada" }).returning();
    activityId = act.id;
    await db.insert(grades).values({ activityId: act.id, enrollmentId: e.id, scoreH: 850, kind: "nota", publishedAt: null });
    check("rascunho NÃO aparece para o aluno", (await publishedGrades(e.id)).length === 0);
    await db.update(grades).set({ publishedAt: new Date() }).where(eq(grades.activityId, act.id));
    const pub = await publishedGrades(e.id);
    check("nota publicada aparece com valor correto", pub.length === 1 && pub[0].scoreH === 850);

    // 5) Frequência
    const [session] = await db.insert(classSessions).values({ cohortId: cohort.id, date: "2099-01-01", startTime: "19:00", endTime: "21:00", status: "concluida" }).returning();
    sessionId = session.id;
    await db.insert(attendanceRecords).values({ sessionId: session.id, enrollmentId: e.id, status: "presente" });
    const att = await attendanceForEnrollment(e.id);
    check("frequência calculada (100% com 1 presença)", att.stats.pct === 100);

    // 6) Certificado: elegibilidade + emissão + PDF com QR
    const elig = certificateEligibility({ concluded: true, avgH: 850, minGradeH: 700, attendancePct: 100, minAttendancePct: 75 });
    check("elegibilidade do certificado", elig.eligible);
    const code = randomCode(12);
    await db.insert(certificates).values({ enrollmentId: e.id, code, workloadHours: 60, finalGradeH: 850, attendancePct: 100 });
    const pdf = await certificatePdf({ studentName: u1.name, courseName: "Curso Teste", workloadHours: 60, issuedAt: new Date(), code, verifyUrl: `https://example.com/certificados/verificar/${code}`, institutionName: "Gráfica Lima" });
    check("PDF de certificado gerado (%PDF)", Buffer.from(pdf.slice(0, 4)).toString() === "%PDF");

    // 7) Múltiplos cargos: mesma conta, várias funções
    await db.insert(userRoles).values([
      { userId: u2.id, role: "secretaria" },
      { userId: u2.id, role: "financeiro" },
      { userId: u2.id, role: "professor" },
    ]).onConflictDoNothing();
    const roles2 = await getUserRoles(u2.id);
    check("múltiplos cargos persistidos na mesma conta", roles2.includes("secretaria") && roles2.includes("financeiro") && roles2.includes("professor"));
    const financeIds = await userIdsByRole(["financeiro"]);
    check("notificações por cargo alcançam conta multi-cargo", financeIds.includes(u2.id));
    let dupRoleBlocked = false;
    try {
      await db.insert(userRoles).values({ userId: u2.id, role: "secretaria" });
    } catch {
      dupRoleBlocked = true;
    }
    check("cargo duplicado bloqueado por restrição única", dupRoleBlocked);
  } finally {
    // Limpeza completa dos dados de teste
    if (activityId) await db.delete(activities).where(eq(activities.id, activityId));
    if (sessionId) await db.delete(classSessions).where(eq(classSessions.id, sessionId));
    if (enrollmentId) await db.delete(enrollments).where(eq(enrollments.id, enrollmentId));
    await db.delete(enrollments).where(eq(enrollments.userId, u2.id));
    await db.delete(users).where(eq(users.id, u1.id));
    await db.delete(users).where(eq(users.id, u2.id));
    await db.update(cohorts).set({ capacity: originalCapacity }).where(eq(cohorts.id, cohort.id));
    const leftover = await db.select().from(notifications).where(eq(notifications.userId, u1.id));
    check("limpeza: cascatas removeram dados de teste", leftover.length === 0);
  }

  await pool.end();
  if (failures > 0) {
    console.error(`\n${failures} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log("\nTodos os testes de integração passaram.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});