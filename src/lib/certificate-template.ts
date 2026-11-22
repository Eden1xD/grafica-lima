import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { certificateTemplates } from "@/db/schema";
import { DEFAULT_LAYOUT, type Layout, type FieldName, type Placement, type Sponsor, type FontFamily } from "@/lib/certificate-layout";
export { DEFAULT_LAYOUT } from "@/lib/certificate-layout";
export type { Layout, FieldName, Placement, Sponsor } from "@/lib/certificate-layout";

export async function getActiveCertificateTemplate(courseId?: string) {
  const [course] = courseId ? await db.select().from(certificateTemplates)
    .where(and(eq(certificateTemplates.active, true), eq(certificateTemplates.courseId, courseId))).limit(1) : [];
  if (course) return course;
  const [global] = await db.select().from(certificateTemplates)
    .where(and(eq(certificateTemplates.active, true), isNull(certificateTemplates.courseId)))
    .orderBy(desc(certificateTemplates.createdAt)).limit(1);
  return global ?? null;
}
function color(value?: string) {
  const hex = /^#[0-9a-f]{6}$/i.test(value ?? "") ? value!.slice(1) : "222222";
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}
// Standard PDF fonts are WinAnsi; unsupported glyphs are converted to printable equivalents.
function safe(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e\n]/g, " ");
}
function fontName(f: Placement): StandardFonts {
  const family: FontFamily = f.font ?? "Helvetica";
  if (family === "TimesRoman") return f.bold ? (f.italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : (f.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman);
  if (family === "Courier") return f.bold ? (f.italic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold) : (f.italic ? StandardFonts.CourierOblique : StandardFonts.Courier);
  return f.bold ? (f.italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold) : (f.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica);
}
function drawText(page: PDFPage, value: string, p: Placement, font: PDFFont) {
  if (p.hidden || !value.trim()) return;
  const size = Math.max(3, p.size || 12);
  const width = Math.max(20, p.maxWidth ?? page.getWidth() - p.x - 20);
  const leading = size * (p.lineHeight ?? 1.35);
  let y = page.getHeight() - p.y - size;
  const maxY = 20;
  for (const paragraph of safe(value).split(/\r?\n/)) {
    let line = "";
    const flush = () => {
      if (y < maxY) return;
      const measured = font.widthOfTextAtSize(line, size);
      const x = p.x + (p.align === "center" ? (width - measured) / 2 : p.align === "right" ? width - measured : 0);
      if (line) page.drawText(line, { x, y, font, size, color: color(p.color), opacity: p.opacity ?? 1, rotate: degrees(p.rotation ?? 0) });
      y -= leading;
    };
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(test, size) > width) { flush(); line = word; }
      else line = test;
    }
    flush();
    if (y < maxY) break;
  }
}
export async function renderCustomCertificate(template: { pdfBase64: string; layout: unknown; sponsors: unknown }, data: {
  studentName: string; cpf?: string | null; courseName: string; workloadHours: number;
  issuedAt: Date; code: string; verifyUrl: string; syllabus: string;
}) {
  const pdf = await PDFDocument.load(Buffer.from(template.pdfBase64, "base64"));
  const pages = pdf.getPages();
  const raw = (template.layout ?? {}) as Layout;
  const layout: Layout = { ...DEFAULT_LAYOUT, ...raw };
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const fields: Record<FieldName, string> = {
    studentName: data.studentName, cpf: `CPF n° ${data.cpf || "não informado"}, concluiu com êxito o curso de`,
    courseName: data.courseName.toUpperCase(), workload: `com carga horária total de ${data.workloadHours} horas.`,
    issuedAt: `Jundiá - AL, ${date.format(data.issuedAt)}.`,
    code: `Código do Certificado: ${data.code} - Verifique em: ${data.verifyUrl}`,
    verifyUrl: data.verifyUrl,
    syllabus: `CONTEÚDO PROGRAMÁTICO\n${data.courseName.toUpperCase()} - ${data.workloadHours} HORAS\n${data.syllabus}`,
  };
  const cache = new Map<StandardFonts, PDFFont>();
  async function getFont(p: Placement) {
    const key = fontName(p);
    if (!cache.has(key)) cache.set(key, await pdf.embedFont(key));
    return cache.get(key)!;
  }
  // Graphics first; text and QR code remain visible above shapes.
  for (const s of layout.shapes ?? []) {
    const page = pages[s.page]; if (!page || s.hidden) continue;
    const y = page.getHeight() - s.y - s.height;
    if (s.type === "line") page.drawLine({ start: { x: s.x, y: page.getHeight() - s.y }, end: { x: s.x + s.width, y: page.getHeight() - s.y - s.height }, thickness: s.borderWidth ?? 1, color: color(s.color), opacity: s.opacity ?? 1 });
    else if (s.type === "ellipse") page.drawEllipse({ x: s.x + s.width / 2, y: y + s.height / 2, xScale: s.width / 2, yScale: s.height / 2, color: color(s.color), opacity: s.opacity ?? 1 });
    else page.drawRectangle({ x: s.x, y, width: s.width, height: s.height, color: color(s.color), opacity: s.opacity ?? 1 });
  }
  for (const key of Object.keys(fields) as FieldName[]) {
    if (key === "verifyUrl") continue;
    const p = layout[key]; if (!p || !pages[p.page]) continue;
    drawText(pages[p.page], fields[key], p, await getFont(p));
  }
  for (const t of layout.texts ?? []) if (pages[t.page]) drawText(pages[t.page], t.text, t, await getFont(t));
  if (layout.qr && !layout.qr.hidden && pages[layout.qr.page]) {
    const q = layout.qr, page = pages[q.page];
    const png = await pdf.embedPng(await QRCode.toBuffer(data.verifyUrl, { width: 350, margin: 1 }));
    page.drawRectangle({ x: q.x - 3, y: page.getHeight() - q.y - q.size - 3, width: q.size + 6, height: q.size + 6, color: rgb(1, 1, 1) });
    page.drawImage(png, { x: q.x, y: page.getHeight() - q.y - q.size, width: q.size, height: q.size });
  }
  for (const s of (Array.isArray(template.sponsors) ? template.sponsors : []) as Sponsor[]) {
    const page = pages[s.page]; if (!page || s.hidden || !/^data:image\/(png|jpeg);base64,/.test(s.image)) continue;
    const bytes = Buffer.from(s.image.split(",")[1], "base64");
    const img = s.image.startsWith("data:image/png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    page.drawImage(img, { x: s.x, y: page.getHeight() - s.y - s.height, width: s.width, height: s.height, opacity: s.opacity ?? 1, rotate: degrees(s.rotation ?? 0) });
  }
  return pdf.save();
}
