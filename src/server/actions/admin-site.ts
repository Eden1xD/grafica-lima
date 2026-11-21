"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { announcements, enrollments, users } from "@/db/schema";
import { assertRole, ADMIN, STAFF } from "@/lib/auth/guards";
import { getSettings, saveSetting } from "@/lib/settings";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { type ActionState, errorToState, fail, ok, str, strOrNull } from "./types";

export async function saveInstitutionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const cfg = await getSettings();
    const value = {
      ...cfg.institution,
      name: str(fd, "name") || cfg.institution.name,
      tagline: str(fd, "tagline"),
      cnpj: str(fd, "cnpj"),
      phone: str(fd, "phone"),
      whatsapp: str(fd, "whatsapp").replace(/\D/g, ""),
      email: str(fd, "email"),
      address: str(fd, "address"),
      city: str(fd, "city"),
      hours: str(fd, "hours"),
      mapsQuery: str(fd, "mapsQuery"),
      instagram: str(fd, "instagram"),
      facebook: str(fd, "facebook"),
    };
    await saveSetting("institution", value);
    await audit(actor.id, "site.instituicao_salva", "settings", "institution");
    revalidatePath("/", "layout");
    return ok("Dados institucionais salvos.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function saveHomeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const cfg = await getSettings();
    await saveSetting("home", {
      ...cfg.home,
      heroBadge: str(fd, "heroBadge"),
      heroTitle: str(fd, "heroTitle") || cfg.home.heroTitle,
      heroSubtitle: str(fd, "heroSubtitle"),
      marquee: str(fd, "marquee"),
      show3d: str(fd, "show3d") === "on",
    });
    await audit(actor.id, "site.home_salva", "settings", "home");
    revalidatePath("/");
    return ok("Página inicial atualizada.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function saveFinanceSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const cfg = await getSettings();
    await saveSetting("finance", {
      ...cfg.finance,
      allowManual: str(fd, "allowManual") === "on",
      allowPix: str(fd, "allowPix") === "on",
      allowCard: str(fd, "allowCard") === "on",
      contractText: str(fd, "contractText") || cfg.finance.contractText,
      cancellationText: str(fd, "cancellationText") || cfg.finance.cancellationText,
    });
    await audit(actor.id, "site.financeiro_salvo", "settings", "finance");
    revalidatePath("/", "layout");
    return ok("Regras financeiras e contratos salvos.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function saveFaqAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    const raw = str(fd, "faqJson");
    const parsed = z.array(z.object({ q: z.string().min(3), a: z.string().min(3) })).max(30).parse(JSON.parse(raw));
    await saveSetting("faq", parsed);
    await audit(actor.id, "site.faq_salvo", "settings", "faq", { count: parsed.length });
    revalidatePath("/faq");
    revalidatePath("/");
    return ok("FAQ atualizado.");
  } catch {
    return fail("JSON inválido. Use o formato [{\"q\":\"Pergunta\",\"a\":\"Resposta\"}].");
  }
}

export async function saveFooterAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(ADMIN);
    await saveSetting("footer", { about: str(fd, "about") });
    await audit(actor.id, "site.rodape_salvo", "settings", "footer");
    revalidatePath("/", "layout");
    return ok("Rodapé atualizado.");
  } catch (err) {
    return errorToState(err);
  }
}

export async function publishAnnouncementAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await assertRole(["admin", "secretaria", "financeiro", "professor"]);
    const title = str(fd, "title");
    const body = str(fd, "body");
    if (title.length < 3 || body.length < 3) return fail("Preencha título e mensagem.");
    const audience = z.enum(["todos", "alunos", "professores", "turma"]).parse(str(fd, "audience") || "todos");
    const cohortId = strOrNull(fd, "cohortId");
    if (audience === "turma" && !cohortId) return fail("Selecione a turma.");
    // Professor sem cargo de gestão: apenas comunicados para as próprias turmas
    const isManager = actor.roles.some((r) => ["admin", "secretaria", "financeiro"].includes(r));
    if (!isManager) {
      if (audience !== "turma" || !cohortId) return fail("Professores publicam comunicados apenas para suas turmas.");
      const { teacherCohortCondition } = await import("@/lib/academic");
      const { teachers, cohorts } = await import("@/db/schema");
      const [t] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.userId, actor.id)).limit(1);
      const [own] = t
        ? await db.select({ id: cohorts.id }).from(cohorts).where(and(eq(cohorts.id, cohortId), teacherCohortCondition(t.id))).limit(1)
        : [];
      if (!own) return fail("Você não está vinculado a esta turma.");
    }
    const [announcement] = await db
      .insert(announcements)
      .values({ title, body, audience, cohortId, important: str(fd, "important") === "on", publishedAt: new Date(), createdBy: actor.id })
      .returning();
    let targets: string[] = [];
    if (audience === "turma" && cohortId) {
      const rows = await db.select({ userId: enrollments.userId }).from(enrollments).where(eq(enrollments.cohortId, cohortId));
      targets = rows.map((r) => r.userId);
    } else {
      const roles = audience === "todos" ? (["admin", "secretaria", "financeiro", "professor", "aluno"] as const) : audience === "alunos" ? (["aluno"] as const) : (["professor"] as const);
      const rows = await db.select({ id: users.id }).from(users).where(inArray(users.role, [...roles]));
      targets = rows.map((r) => r.id);
    }
    await notify(targets, { type: "comunicado", title: `Comunicado: ${title}`, body: body.slice(0, 120), link: "/notificacoes" });
    await audit(actor.id, "comunicacao.comunicado_publicado", "announcement", announcement.id, { audience, targets: targets.length });
    revalidatePath("/admin/comunicados");
    return ok(`Comunicado publicado para ${targets.length} pessoa(s).`);
  } catch (err) {
    return errorToState(err);
  }
}