import type { ReactNode } from "react";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireRole, STAFF } from "@/lib/auth/guards";
import { getActiveRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(STAFF, "/admin");
  let unread = 0;
  try {
    const [r] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), isNull(notifications.archivedAt)));
    unread = Number(r?.n ?? 0);
  } catch {}
  const activeRole = await getActiveRole(user);
  return (
    <AdminShell user={{ name: user.name, role: activeRole, roles: user.roles }} unread={unread}>
      {children}
    </AdminShell>
  );
}