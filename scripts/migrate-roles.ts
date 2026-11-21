/**
 * Migração segura para múltiplos cargos — idempotente, não destrutiva.
 * Executar APÓS `npx drizzle-kit push`:
 *   npm exec tsx -- scripts/migrate-roles.ts
 *
 * 1) Copia users.role → user_roles (sem apagar a coluna legada, que segue sincronizada).
 * 2) Garante cadastro de professor para quem tem o cargo professor.
 * 3) Copia cohorts.teacher_id → cohort_teachers (is_primary = true).
 * 4) Verifica invariantes e reporta.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { cohorts, cohortTeachers, teachers, userRoles, users } from "../src/db/schema";

async function main() {
  console.log("→ Migração de cargos e vínculos de professores");

  const allUsers = await db.select({ id: users.id, role: users.role, name: users.name }).from(users);
  if (allUsers.length > 0) {
    await db.insert(userRoles).values(allUsers.map((u) => ({ userId: u.id, role: u.role }))).onConflictDoNothing();
  }
  console.log(`  ✔ user_roles: ${allUsers.length} usuário(s) verificados/migrados`);

  const profUsers = allUsers.filter((u) => u.role === "professor");
  for (const u of profUsers) {
    await db.insert(teachers).values({ userId: u.id }).onConflictDoNothing();
  }
  // Quem tem cargo professor em user_roles também precisa de cadastro vinculável
  const profRoleRows = await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "professor"));
  for (const r of profRoleRows) {
    await db.insert(teachers).values({ userId: r.userId }).onConflictDoNothing();
  }
  console.log(`  ✔ teachers: cadastros garantidos para o cargo professor`);

  const allCohorts = await db.select({ id: cohorts.id, teacherId: cohorts.teacherId, name: cohorts.name }).from(cohorts);
  const withTeacher = allCohorts.filter((c) => c.teacherId);
  if (withTeacher.length > 0) {
    await db
      .insert(cohortTeachers)
      .values(withTeacher.map((c) => ({ cohortId: c.id, teacherId: c.teacherId as string, isPrimary: true })))
      .onConflictDoNothing();
  }
  console.log(`  ✔ cohort_teachers: ${withTeacher.length} vínculo(s) principal(is) migrado(s)`);

  // Verificações
  const roleCount = await db.select().from(userRoles);
  const usersWithoutRole = allUsers.filter((u) => !roleCount.some((r) => r.userId === u.id));
  if (usersWithoutRole.length > 0) throw new Error(`Invariante violada: usuários sem cargo: ${usersWithoutRole.map((u) => u.name).join(", ")}`);
  const links = await db.select().from(cohortTeachers);
  const primaryPerCohort = new Map<string, number>();
  for (const l of links) if (l.isPrimary) primaryPerCohort.set(l.cohortId, (primaryPerCohort.get(l.cohortId) ?? 0) + 1);
  for (const [cid, n] of primaryPerCohort) if (n > 1) throw new Error(`Turma ${cid} com ${n} professores principais.`);
  console.log(`  ✔ Invariantes OK: todos com cargo; no máximo 1 principal por turma`);
  console.log("→ Migração concluída. A coluna users.role permanece como espelho sincronizado (descontinuada).");
  await pool.end();
}

main().catch(async (e) => {
  console.error("Migração falhou:", e);
  await pool.end();
  process.exit(1);
});