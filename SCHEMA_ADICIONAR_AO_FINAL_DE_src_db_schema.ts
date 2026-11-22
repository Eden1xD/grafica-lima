// Adicione ao final de src/db/schema.ts (imports pgTable, uuid, text, jsonb,
// boolean, timestamp ja existem no schema original):
export const certificateTemplates = pgTable("certificate_templates", {
 id: uuid("id").primaryKey().defaultRandom(),
 name: text("name").notNull(),
 pdfBase64: text("pdf_base64").notNull(),
 layout: jsonb("layout").notNull().default({}),
 sponsors: jsonb("sponsors").notNull().default([]),
 active: boolean("active").notNull().default(false),
 courseId: uuid("course_id").references(() => courses.id, { onDelete: "set null" }),
 createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
 updatedAt: timestamp("updated_at", {withTimezone:true}).notNull().defaultNow(),
});
