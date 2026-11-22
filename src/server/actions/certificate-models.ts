"use server";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { certificateTemplates } from "@/db/schema";
import { assertRole, ADMIN } from "@/lib/auth/guards";
import {
  DEFAULT_LAYOUT,
  type Layout,
  type Sponsor,
} from "@/lib/certificate-layout";

const MAX_PDF = 8 * 1024 * 1024;
export async function uploadCertificateModel(fd: FormData) {
 await assertRole(ADMIN);
 const file=fd.get("file"); const name=String(fd.get("name")||"").trim();
 if(!(file instanceof File)||!name||file.size>MAX_PDF||file.size<100) throw new Error("Informe nome e PDF valido de ate 8 MB.");
 const bytes=Buffer.from(await file.arrayBuffer());
 if(bytes.subarray(0,5).toString()!=="%PDF-") throw new Error("O arquivo precisa ser PDF.");
 const [row]=await db.insert(certificateTemplates).values({name,pdfBase64:bytes.toString("base64"),layout:DEFAULT_LAYOUT,sponsors:[]}).returning({id:certificateTemplates.id});
 revalidatePath("/admin/certificados/modelos");return row.id;
}
export async function saveCertificateModel(id:string, layout:Layout, sponsors:Sponsor[]) {
 await assertRole(ADMIN);
 if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("ID invalido");
 if(JSON.stringify(layout).length>15000||JSON.stringify(sponsors).length>2_000_000||sponsors.length>12) throw new Error("Limite de configuracao excedido");
 for(const s of sponsors) if(!/^data:image\/(png|jpeg);base64,/.test(s.image)||s.width<1||s.height<1) throw new Error("Patrocinador invalido");
await db.update(certificateTemplates)
  .set({ layout, sponsors })
  .where(eq(certificateTemplates.id, id));
 revalidatePath("/admin/certificados/modelos");
}
export async function publishCertificateModel(id:string) {
 await assertRole(ADMIN);
 const [model]=await db.select({courseId:certificateTemplates.courseId}).from(certificateTemplates).where(eq(certificateTemplates.id,id)).limit(1);
 if(!model) throw new Error("Modelo nao encontrado");
 await db.transaction(async tx=>{
  await tx.update(certificateTemplates).set({active:false}).where(model.courseId?eq(certificateTemplates.courseId,model.courseId):isNull(certificateTemplates.courseId));
  await tx.update(certificateTemplates)
  .set({ active: true })
  .where(eq(certificateTemplates.id, id));
 });
 revalidatePath("/admin/certificados/modelos");
}
