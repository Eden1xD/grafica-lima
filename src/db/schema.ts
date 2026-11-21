import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  serial,
} from "drizzle-orm/pg-core";

/* ============================== Enums ============================== */
export const roleEnum = pgEnum("role", ["admin", "secretaria", "financeiro", "professor", "aluno"]);
export const userStatusEnum = pgEnum("user_status", ["ativo", "bloqueado"]);
export const tokenTypeEnum = pgEnum("token_type", ["verificar_email", "recuperar_senha"]);
export const courseStatusEnum = pgEnum("course_status", ["rascunho", "publicado", "arquivado"]);
export const cohortStatusEnum = pgEnum("cohort_status", ["aberta", "em_andamento", "encerrada", "cancelada"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "pendente_pagamento",
  "ativa",
  "trancada",
  "cancelada",
  "concluida",
]);
export const planEnum = pgEnum("plan_type", ["integral", "mensal"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pendente", "aprovado", "recusado", "reembolsado", "cancelado"]);
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "cartao", "dinheiro", "transferencia", "outro"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["manual", "mercadopago"]);
export const paymentKindEnum = pgEnum("payment_kind", ["matricula", "mensalidade", "integral"]);
export const installmentStatusEnum = pgEnum("installment_status", ["pendente", "paga", "cancelada"]);
export const sessionStatusEnum = pgEnum("session_status", ["agendada", "concluida", "cancelada"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["presente", "ausente", "justificado"]);
export const activityTypeEnum = pgEnum("activity_type", ["prova", "trabalho", "projeto", "pratica", "atividade", "recuperacao"]);
export const activityStatusEnum = pgEnum("activity_status", ["rascunho", "publicada"]);
export const gradeKindEnum = pgEnum("grade_kind", ["nota", "ausente", "nao_entregue"]);
export const couponTypeEnum = pgEnum("coupon_type", ["percentual", "fixo"]);
export const leadStatusEnum = pgEnum("lead_status", ["novo", "em_contato", "proposta", "convertido", "perdido"]);
export const privacyStatusEnum = pgEnum("privacy_status", ["aberta", "em_analise", "concluida"]);
export const audienceEnum = pgEnum("announcement_audience", ["todos", "alunos", "professores", "turma"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const now = () => ts("created_at").notNull().defaultNow();

/* ============================== Autenticação ============================== */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull().default("aluno"),
  status: userStatusEnum("status").notNull().default("ativo"),
  emailVerifiedAt: ts("email_verified_at"),
  avatarUrl: text("avatar_url"),
  createdAt: now(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: now(),
  },
  (t) => [uniqueIndex("accounts_provider_account_uq").on(t.provider, t.providerAccountId), index("accounts_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 do token opaco
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: now(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: tokenTypeEnum("type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: now(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId)],
);

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  cpf: text("cpf"),
  birthDate: date("birth_date", { mode: "string" }),
  phone: text("phone"),
  cep: text("cep"),
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  district: text("district"),
  city: text("city"),
  state: text("state"),
  guardianName: text("guardian_name"),
  guardianCpf: text("guardian_cpf"),
  guardianPhone: text("guardian_phone"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ============================== Acadêmico ============================== */
export const courseCategories = pgTable("course_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: now(),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => courseCategories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortDescription: text("short_description").notNull().default(""),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  workloadHours: integer("workload_hours").notNull().default(40),
  durationMonths: integer("duration_months").notNull().default(3),
  priceCents: integer("price_cents").notNull().default(0),
  entryCents: integer("entry_cents").notNull().default(0),
  maxInstallments: integer("max_installments").notNull().default(4),
  minAttendancePct: integer("min_attendance_pct").notNull().default(75),
  minGradeH: integer("min_grade_h").notNull().default(700),
  prerequisites: text("prerequisites").notNull().default(""),
  syllabus: text("syllabus").notNull().default(""),
  materials: text("materials").notNull().default(""),
  certificateEnabled: boolean("certificate_enabled").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  status: courseStatusEnum("status").notNull().default("rascunho"),
  createdAt: now(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const classrooms = pgTable("classrooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  capacity: integer("capacity").notNull().default(20),
  notes: text("notes"),
});

export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  bio: text("bio").notNull().default(""),
  specialties: text("specialties").notNull().default(""),
  publicVisible: boolean("public_visible").notNull().default(true),
  createdAt: now(),
});

export const cohorts = pgTable(
  "cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "restrict" }),
    teacherId: uuid("teacher_id").references(() => teachers.id, { onDelete: "set null" }),
    roomId: uuid("room_id").references(() => classrooms.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    daysOfWeek: integer("days_of_week").array().notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    capacity: integer("capacity").notNull().default(15),
    status: cohortStatusEnum("status").notNull().default("aberta"),
    createdAt: now(),
  },
  (t) => [index("cohorts_course_idx").on(t.courseId), index("cohorts_teacher_idx").on(t.teacherId)],
);

export const classSessions = pgTable(
  "class_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    topic: text("topic"),
    status: sessionStatusEnum("status").notNull().default("agendada"),
    createdAt: now(),
  },
  (t) => [uniqueIndex("class_sessions_uq").on(t.cohortId, t.date, t.startTime), index("class_sessions_date_idx").on(t.date)],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: activityTypeEnum("type").notNull().default("atividade"),
    subject: text("subject").notNull().default("Geral"),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    maxScoreH: integer("max_score_h").notNull().default(1000),
    weightH: integer("weight_h").notNull().default(100),
    status: activityStatusEnum("status").notNull().default("rascunho"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [index("activities_cohort_idx").on(t.cohortId)],
);

/* ============================== Matrículas ============================== */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "restrict" }),
    status: enrollmentStatusEnum("status").notNull().default("pendente_pagamento"),
    plan: planEnum("plan").notNull().default("integral"),
    totalCents: integer("total_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    contractAcceptedAt: ts("contract_accepted_at"),
    contractVersion: text("contract_version"),
    pendingExpiresAt: ts("pending_expires_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    concludedAt: ts("concluded_at"),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("enrollments_user_cohort_active_uq").on(t.userId, t.cohortId).where(sql`status <> 'cancelada'`),
    index("enrollments_cohort_idx").on(t.cohortId),
    index("enrollments_user_idx").on(t.userId),
    index("enrollments_status_idx").on(t.status),
  ],
);

export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    scoreH: integer("score_h"),
    kind: gradeKindEnum("kind").notNull().default("nota"),
    publishedAt: ts("published_at"),
    note: text("note"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("grades_activity_enrollment_uq").on(t.activityId, t.enrollmentId)],
);

export const gradeHistory = pgTable("grade_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  gradeId: uuid("grade_id").notNull().references(() => grades.id, { onDelete: "cascade" }),
  oldScoreH: integer("old_score_h"),
  newScoreH: integer("new_score_h"),
  reason: text("reason").notNull(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: now(),
});

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => classSessions.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull(),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("attendance_session_enrollment_uq").on(t.sessionId, t.enrollmentId)],
);

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id").notNull().unique().references(() => enrollments.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  workloadHours: integer("workload_hours").notNull(),
  finalGradeH: integer("final_grade_h"),
  attendancePct: integer("attendance_pct"),
  issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
  issuedAt: ts("issued_at").notNull().defaultNow(),
  revokedAt: ts("revoked_at"),
  revokeReason: text("revoke_reason"),
});

/* ============================== Financeiro ============================== */
export const installments = pgTable(
  "installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: installmentStatusEnum("status").notNull().default("pendente"),
    paidAt: ts("paid_at"),
    createdAt: now(),
  },
  (t) => [uniqueIndex("installments_enrollment_number_uq").on(t.enrollmentId, t.number), index("installments_due_idx").on(t.dueDate)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptSeq: serial("receipt_seq"),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installments.id, { onDelete: "set null" }),
    kind: paymentKindEnum("kind").notNull(),
    method: paymentMethodEnum("method").notNull(),
    provider: paymentProviderEnum("provider").notNull().default("manual"),
    amountCents: integer("amount_cents").notNull(),
    status: paymentStatusEnum("status").notNull().default("pendente"),
    providerPaymentId: text("provider_payment_id"),
    providerPreferenceId: text("provider_preference_id"),
    pixQrCode: text("pix_qr_code"),
    pixQrBase64: text("pix_qr_base64"),
    pixExpiresAt: ts("pix_expires_at"),
    paidAt: ts("paid_at"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("payments_enrollment_idx").on(t.enrollmentId),
    index("payments_status_idx").on(t.status),
    uniqueIndex("payments_provider_id_uq").on(t.provider, t.providerPaymentId),
  ],
);

export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  type: couponTypeEnum("type").notNull().default("percentual"),
  value: integer("value").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validUntil: date("valid_until", { mode: "string" }),
  minTotalCents: integer("min_total_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: now(),
});

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [uniqueIndex("coupon_redemptions_uq").on(t.couponId, t.enrollmentId)],
);

/* ============================== Comunicação ============================== */
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: audienceEnum("audience").notNull().default("todos"),
  cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "set null" }),
  important: boolean("important").notNull().default(false),
  publishedAt: ts("published_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: now(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: ts("read_at"),
    archivedAt: ts("archived_at"),
    createdAt: now(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: now(),
  lastUsedAt: ts("last_used_at"),
});

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id").references(() => notifications.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: now(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  status: text("status").notNull().default("pendente"),
  error: text("error"),
  createdAt: now(),
  sentAt: ts("sent_at"),
});

/* ============================== Comercial / LGPD ============================== */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull().default(""),
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
  status: leadStatusEnum("status").notNull().default("novo"),
  notes: text("notes"),
  createdAt: now(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const privacyRequests = pgTable("privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull().default(""),
  status: privacyStatusEnum("status").notNull().default("aberta"),
  response: text("response"),
  createdAt: now(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ============================== Administração ============================== */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    resourceId: text("resource_id"),
    details: jsonb("details"),
    ip: text("ip"),
    createdAt: now(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_user_idx").on(t.userId)],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    payload: jsonb("payload"),
    processedAt: ts("processed_at"),
    error: text("error"),
    createdAt: now(),
  },
  (t) => [uniqueIndex("webhook_events_uq").on(t.provider, t.eventKey)],
);

/* ============================== Múltiplos cargos e permissões ============================== */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [uniqueIndex("user_roles_user_role_uq").on(t.userId, t.role), index("user_roles_role_idx").on(t.role)],
);

export const permissionEffectEnum = pgEnum("permission_effect", ["grant", "deny"]);

export const userPermissions = pgTable(
  "user_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    effect: permissionEffectEnum("effect").notNull().default("grant"),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [uniqueIndex("user_permissions_uq").on(t.userId, t.permission)],
);

export const cohortTeachers = pgTable(
  "cohort_teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("cohort_teachers_uq").on(t.cohortId, t.teacherId),
    uniqueIndex("cohort_teachers_primary_uq").on(t.cohortId).where(sql`is_primary`),
    index("cohort_teachers_teacher_idx").on(t.teacherId),
  ],
);

/* ============================== Tipos ============================== */
export type User = typeof users.$inferSelect;
export type StudentProfile = typeof studentProfiles.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Cohort = typeof cohorts.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Installment = typeof installments.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Grade = typeof grades.$inferSelect;
export type ClassSession = typeof classSessions.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Teacher = typeof teachers.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];