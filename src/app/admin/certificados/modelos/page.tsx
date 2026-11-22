
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { certificateTemplates } from "@/db/schema";
import { requireRole, ADMIN } from "@/lib/auth/guards";
import { CertificateModelsEditor } from "./certificate-models-editor";

export const dynamic = "force-dynamic";

export default async function CertificateModelsPage() {
  await requireRole(ADMIN, "/admin/certificados/modelos");

  if (!certificateTemplates) {
    throw new Error(
      "A tabela certificateTemplates não foi exportada corretamente em src/db/schema.ts."
    );
  }

  const models = await db
    .select({
      id: certificateTemplates.id,
      name: certificateTemplates.name,
      active: certificateTemplates.active,
      layout: certificateTemplates.layout,
      sponsors: certificateTemplates.sponsors,
      courseId: certificateTemplates.courseId,
    })
    .from(certificateTemplates)
    .orderBy(desc(certificateTemplates.createdAt));

  return <CertificateModelsEditor models={models} />;
}
