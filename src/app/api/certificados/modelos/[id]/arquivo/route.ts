import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificateTemplates } from "@/db/schema";
import { assertRole, ADMIN } from "@/lib/auth/guards";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await assertRole(ADMIN);
 const {id}=await params;
 const [model]=await db.select({pdfBase64:certificateTemplates.pdfBase64}).from(certificateTemplates).where(eq(certificateTemplates.id,id)).limit(1);
 if(!model)return new Response("Nao encontrado",{status:404});
 return new Response(new Uint8Array(Buffer.from(model.pdfBase64,"base64")),{headers:{"Content-Type":"application/pdf","Cache-Control":"private, no-store"}});
}
