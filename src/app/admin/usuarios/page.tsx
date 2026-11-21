import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, cohortTeachers, cohorts, courses, teachers, userPermissions, userRoles, users, type Role } from "@/db/schema";
import { requireRole, ADMIN } from "@/lib/auth/guards";
import { getUserRoles } from "@/lib/auth/session";
import { toggleUserStatusAction } from "@/server/actions/admin-people";
import { ROLE_LABEL } from "@/lib/permissions";
import { DataTable } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { RoleModal } from "@/components/role-modal";
import { Alert, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usuários, cargos e permissões" };

export default async function AdminUsuariosPage() {
  const actor = await requireRole(ADMIN, "/admin/usuarios");
  const rows = await db.select().from(users).orderBy(asc(users.name)).limit(500);
  const roleRows = await db.select().from(userRoles);
  const permRows = await db.select().from(userPermissions);
  const historyRows = await db
    .select({ log: auditLogs, actor: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.resource, "user"))
    .orderBy(desc(auditLogs.createdAt))
    .limit(600);
  const teacherLinks = await db
    .select({ userId: teachers.userId, cohort: cohorts.name, course: courses.name })
    .from(cohortTeachers)
    .innerJoin(teachers, eq(teachers.id, cohortTeachers.teacherId))
    .innerJoin(cohorts, eq(cohorts.id, cohortTeachers.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId));
  const legacyLinks = await db
    .select({ userId: teachers.userId, cohort: cohorts.name, course: courses.name })
    .from(cohorts)
    .innerJoin(teachers, eq(teachers.id, cohorts.teacherId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId));

  const rolesByUser = new Map<string, Role[]>();
  for (const r of roleRows) {
    const list = rolesByUser.get(r.userId) ?? [];
    if (!list.includes(r.role)) list.push(r.role);
    rolesByUser.set(r.userId, list);
  }
  const permsByUser = new Map<string, Array<{ permission: string; effect: "grant" | "deny" }>>();
  for (const p of permRows) {
    const list = permsByUser.get(p.userId) ?? [];
    list.push({ permission: p.permission, effect: p.effect });
    permsByUser.set(p.userId, list);
  }
  const historyByUser = new Map<string, Array<{ id: string; action: string; actor: string; details: string; createdAt: string }>>();
  for (const { log, actor: actorName } of historyRows) {
    if (!log.resourceId) continue;
    const list = historyByUser.get(log.resourceId) ?? [];
    if (list.length < 8) {
      list.push({ id: log.id, action: log.action, actor: actorName ?? "sistema", details: log.details ? JSON.stringify(log.details).slice(0, 140) : "—", createdAt: log.createdAt.toISOString() });
      historyByUser.set(log.resourceId, list);
    }
  }
  const cohortsByUser = new Map<string, Set<string>>();
  for (const l of [...teacherLinks, ...legacyLinks]) {
    const set = cohortsByUser.get(l.userId) ?? new Set<string>();
    set.add(`${l.course} · ${l.cohort}`);
    cohortsByUser.set(l.userId, set);
  }

  const enriched = await Promise.all(
    rows.map(async (u) => ({
      u,
      roles: rolesByUser.get(u.id) ?? (await getUserRoles(u.id, u.role)),
    })),
  );

  return (
    <div>
      <PageTitle title="Usuários, cargos e permissões" description="Uma pessoa, vários cargos. Alterações auditadas, aplicadas imediatamente e sem duplicar contas." />
      <Alert variant="warn" className="mb-5 text-xs">
        Somente administradores alteram cargos. O último administrador ativo não pode perder o acesso. Você não pode alterar os próprios privilégios. Permissões críticas exigem cargo Administrador.
      </Alert>
      <DataTable
        exportName="usuarios"
        filterKey="roleFilter"
        filterIncludes
        pageSize={12}
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "rolesLabel", label: "Cargos" },
          { key: "permsCount", label: "Permissões extras" },
          { key: "verified", label: "E-mail verificado", type: "bool" },
          { key: "status", label: "Status", type: "status" },
          { key: "createdAt", label: "Criado", type: "date" },
        ]}
        rows={enriched.map(({ u, roles }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          rolesLabel: roles.map((r) => ROLE_LABEL[r]).join(" · "),
          roleFilter: roles.join("|"),
          permsCount: permsByUser.get(u.id)?.length ?? 0,
          verified: !!u.emailVerifiedAt,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          _actions: u.id === actor.id ? (
            <span className="text-xs text-muted">Você</span>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <RoleModal
                user={{ id: u.id, name: u.name, email: u.email, status: u.status }}
                roles={roles}
                overrides={permsByUser.get(u.id) ?? []}
                history={historyByUser.get(u.id) ?? []}
                cohorts={[...(cohortsByUser.get(u.id) ?? [])]}
              />
              <ActionForm
                action={toggleUserStatusAction}
                hidden={{ userId: u.id }}
                submitLabel={u.status === "ativo" ? "Bloquear" : "Reativar"}
                submitSize="sm"
                submitVariant={u.status === "ativo" ? "ghost" : "soft"}
                confirm={u.status === "ativo" ? "Bloquear usuário e revogar sessões?" : undefined}
              />
            </div>
          ),
        }))}
      />
    </div>
  );
}