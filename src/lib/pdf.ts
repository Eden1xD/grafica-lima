import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

const TEAL = rgb(0.027, 0.345, 0.357);
const BRAND = rgb(0.031, 0.498, 0.502);
const SAGE = rgb(0.675, 0.816, 0.659);
const INK = rgb(0.09, 0.2, 0.19);
const MUTED = rgb(0.39, 0.455, 0.43);

function money(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(ab, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function certificatePdf(input: {
  studentName: string;
  courseName: string;
  workloadHours: number;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
  institutionName: string;
  syllabus: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  const white = rgb(1, 1, 1);
  const navy = rgb(0.08, 0.13, 0.28);
  const blue = rgb(0.16, 0.47, 0.96);
  const purple = rgb(0.39, 0.12, 0.55);
  const lavender = rgb(0.68, 0.59, 0.91);
  const muted = rgb(0.38, 0.41, 0.47);
  const lineColor = rgb(0.84, 0.86, 0.91);
  const pale = rgb(0.97, 0.97, 0.99);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  function fitSize(
    text: string,
    font: typeof regular,
    maxSize: number,
    maxWidth: number,
    minSize = 12,
  ): number {
    let size = maxSize;

    while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 1;
    }

    return size;
  }

  function drawCentered(
    page: ReturnType<typeof doc.addPage>,
    text: string,
    y: number,
    size: number,
    font: typeof regular,
    color: typeof navy,
  ) {
    const width = font.widthOfTextAtSize(text, size);

    page.drawText(text, {
      x: (842 - width) / 2,
      y,
      size,
      font,
      color,
    });
  }

  function drawHeader(page: ReturnType<typeof doc.addPage>) {
    page.drawRectangle({
      x: 0,
      y: 548,
      width: 842,
      height: 47,
      color: purple,
    });

    page.drawLine({
      start: { x: 0, y: 551 },
      end: { x: 275, y: 586 },
      color: blue,
      thickness: 28,
    });

    page.drawLine({
      start: { x: 105, y: 549 },
      end: { x: 390, y: 584 },
      color: navy,
      thickness: 18,
    });

    page.drawLine({
      start: { x: 290, y: 550 },
      end: { x: 510, y: 580 },
      color: lavender,
      thickness: 10,
    });
  }

  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, {
    margin: 1,
    width: 220,
    color: {
      dark: "#172147",
      light: "#FFFFFF",
    },
  });

  const qrImage = await doc.embedPng(qrDataUrl);

  // FRENTE DO CERTIFICADO
  const front = doc.addPage([842, 595]);

  front.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color: white,
  });

  drawHeader(front);

  const institution = input.institutionName.toUpperCase();
  const institutionSize = fitSize(institution, bold, 11, 210, 8);
  const institutionWidth = bold.widthOfTextAtSize(
    institution,
    institutionSize,
  );

  front.drawText(institution, {
    x: 790 - institutionWidth,
    y: 512,
    size: institutionSize,
    font: bold,
    color: navy,
  });

  front.drawLine({
    start: { x: 58, y: 493 },
    end: { x: 784, y: 493 },
    color: lineColor,
    thickness: 1,
  });

  front.drawText("Certificado", {
    x: 58,
    y: 424,
    size: 42,
    font: bold,
    color: navy,
  });

  front.drawText("DE CONCLUSÃO DE CURSO", {
    x: 61,
    y: 400,
    size: 11,
    font: bold,
    color: blue,
  });

  front.drawText("Certificamos que", {
    x: 61,
    y: 355,
    size: 13,
    font: regular,
    color: muted,
  });

  const studentName = input.studentName.trim();
  const studentSize = fitSize(studentName, italic, 31, 710, 14);
  const studentWidth = italic.widthOfTextAtSize(studentName, studentSize);

  front.drawText(studentName, {
    x: (842 - studentWidth) / 2,
    y: 310,
    size: studentSize,
    font: italic,
    color: navy,
  });

  front.drawLine({
    start: { x: 105, y: 296 },
    end: { x: 737, y: 296 },
    color: lavender,
    thickness: 1.5,
  });

  drawCentered(
    front,
    "concluiu com aproveitamento o curso de",
    265,
    13,
    regular,
    muted,
  );

  const courseName = input.courseName.trim();
  const courseSize = fitSize(courseName, bold, 25, 720, 14);

  drawCentered(front, courseName, 228, courseSize, bold, purple);

  const issueDate = input.issuedAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  drawCentered(
    front,
    `com carga horária de ${input.workloadHours} horas, emitido em ${issueDate}.`,
    198,
    12,
    regular,
    muted,
  );

  front.drawLine({
    start: { x: 75, y: 126 },
    end: { x: 350, y: 126 },
    color: navy,
    thickness: 1,
  });

  front.drawText("Assinatura da instituição", {
    x: 75,
    y: 108,
    size: 10,
    font: bold,
    color: navy,
  });

  front.drawText(input.institutionName, {
    x: 75,
    y: 91,
    size: 9,
    font: regular,
    color: muted,
  });

  front.drawText("Valide a autenticidade", {
    x: 665,
    y: 178,
    size: 9,
    font: bold,
    color: navy,
  });

  front.drawImage(qrImage, {
    x: 680,
    y: 78,
    width: 92,
    height: 92,
  });

  front.drawText(`Código: ${input.code}`, {
    x: 58,
    y: 68,
    size: 10,
    font: bold,
    color: navy,
  });

  front.drawText(input.verifyUrl.slice(0, 90), {
    x: 58,
    y: 51,
    size: 8,
    font: regular,
    color: muted,
  });

  front.drawLine({
    start: { x: 58, y: 38 },
    end: { x: 784, y: 38 },
    color: lineColor,
    thickness: 1,
  });

  front.drawText("Documento digital verificável pelo código ou QR Code.", {
    x: 58,
    y: 23,
    size: 8,
    font: regular,
    color: muted,
  });

  // VERSO: CONTEÚDO PROGRAMÁTICO
  const back = doc.addPage([842, 595]);

  back.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color: white,
  });

  drawHeader(back);

  back.drawText("Conteúdo programático", {
    x: 58,
    y: 504,
    size: 23,
    font: bold,
    color: navy,
  });

  const subtitle = `${input.courseName} · ${input.workloadHours} horas`;
  const subtitleSize = fitSize(subtitle, regular, 11, 690, 8);

  back.drawText(subtitle, {
    x: 60,
    y: 482,
    size: subtitleSize,
    font: regular,
    color: muted,
  });

  back.drawLine({
    start: { x: 58, y: 466 },
    end: { x: 784, y: 466 },
    color: lavender,
    thickness: 1.5,
  });

  let bodySize = 8.4;
  let programLines: Array<{ text: string; heading: boolean }> = [];

  const sourceLines = input.syllabus
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const syllabusLines =
    sourceLines.length > 0
      ? sourceLines
      : ["Conteúdo programático não cadastrado para este curso."];

  function buildProgramLines(size: number) {
    const rows: Array<{ text: string; heading: boolean }> = [];
    const textWidth = 350;

    for (const sourceLine of syllabusLines) {
      const heading = /^#{1,6}\s/.test(sourceLine);
      const cleanLine = sourceLine
        .replace(/^#{1,6}\s*/, "")
        .replace(/^[-*]\s*/, "• ");

      const font = heading ? bold : regular;
      const fontSize = heading ? size + 0.6 : size;
      const wrapped = wrapText(cleanLine, font, fontSize, textWidth);

      for (const text of wrapped) {
        rows.push({ text, heading });
      }

      rows.push({ text: "", heading: false });
    }

    return rows.filter((row, index, rows) => {
      return row.text !== "" || rows[index - 1]?.text !== "";
    });
  }

  programLines = buildProgramLines(bodySize);

  while (programLines.length > 78 && bodySize > 6.6) {
    bodySize -= 0.3;
    programLines = buildProgramLines(bodySize);
  }

  if (programLines.length > 82) {
    programLines = programLines.slice(0, 81);
    programLines.push({
      text: "Conteúdo resumido. Consulte a instituição para a ementa completa.",
      heading: false,
    });
  }

  const splitAt = Math.ceil(programLines.length / 2);
  const leftColumn = programLines.slice(0, splitAt);
  const rightColumn = programLines.slice(splitAt);

  function drawColumn(
    rows: Array<{ text: string; heading: boolean }>,
    x: number,
  ) {
    let y = 448;
    const lineHeight = bodySize + 2.1;

    for (const row of rows) {
      if (!row.text) {
        y -= lineHeight * 0.45;
        continue;
      }

      if (y < 76) break;

      const font = row.heading ? bold : regular;
      const size = row.heading ? bodySize + 0.6 : bodySize;

      back.drawText(row.text, {
        x,
        y,
        size,
        font,
        color: row.heading ? navy : muted,
      });

      y -= lineHeight;
    }
  }

  drawColumn(leftColumn, 60);
  drawColumn(rightColumn, 432);

  back.drawLine({
    start: { x: 420, y: 76 },
    end: { x: 420, y: 448 },
    color: lineColor,
    thickness: 1,
  });

  back.drawLine({
    start: { x: 58, y: 58 },
    end: { x: 784, y: 58 },
    color: lineColor,
    thickness: 1,
  });

  back.drawText(`Certificado: ${input.code}`, {
    x: 58,
    y: 40,
    size: 8,
    font: bold,
    color: navy,
  });

  back.drawText("Verifique pelo QR Code ou pelo código de autenticidade.", {
    x: 58,
    y: 25,
    size: 8,
    font: regular,
    color: muted,
  });

  back.drawImage(qrImage, {
    x: 746,
    y: 18,
    width: 38,
    height: 38,
  });

  return doc.save();
}

export async function receiptPdf(input: {
  receiptNumber: number;
  studentName: string;
  courseName: string;
  cohortName: string;
  description: string;
  amountCents: number;
  method: string;
  paidAt: Date;
  institutionName: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 retrato

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: 762,
    width: 595,
    height: 80,
    color: TEAL,
  });

  page.drawText("GRAFICA LIMA", {
    x: 48,
    y: 806,
    size: 18,
    font: bold,
    color: rgb(0.92, 0.95, 0.91),
  });

  page.drawText("Produtos e Informatica", {
    x: 48,
    y: 788,
    size: 10,
    font: helv,
    color: SAGE,
  });

  page.drawText(
    `RECIBO Nº ${String(input.receiptNumber).padStart(5, "0")}`,
    {
      x: 360,
      y: 800,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    },
  );

  page.drawText("Recibo de pagamento", {
    x: 48,
    y: 712,
    size: 20,
    font: bold,
    color: INK,
  });

  page.drawText(
    `Emitido em ${input.paidAt.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    })}`,
    {
      x: 48,
      y: 692,
      size: 10,
      font: helv,
      color: MUTED,
    },
  );

  const rows: Array<[string, string]> = [
    ["Aluno(a)", input.studentName],
    ["Curso", input.courseName],
    ["Turma", input.cohortName],
    ["Referente a", input.description],
    ["Meio de pagamento", input.method],
    ["Valor recebido", money(input.amountCents)],
  ];

  let y = 640;

  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), {
      x: 48,
      y,
      size: 8,
      font: bold,
      color: MUTED,
    });

    page.drawText(value.slice(0, 80), {
      x: 48,
      y: y - 16,
      size: 12,
      font: helv,
      color: INK,
    });

    page.drawLine({
      start: { x: 48, y: y - 26 },
      end: { x: 547, y: y - 26 },
      color: rgb(0.88, 0.92, 0.89),
      thickness: 1,
    });

    y -= 52;
  }

  page.drawRectangle({
    x: 48,
    y: y - 30,
    width: 499,
    height: 44,
    color: rgb(0.918, 0.953, 0.914),
    borderColor: SAGE,
    borderWidth: 1,
  });

  page.drawText(`TOTAL: ${money(input.amountCents)}`, {
    x: 64,
    y: y - 12,
    size: 15,
    font: bold,
    color: TEAL,
  });

  page.drawText(
    "Documento gerado eletronicamente pela plataforma Grafica Lima.",
    {
      x: 48,
      y: 120,
      size: 9,
      font: helv,
      color: MUTED,
    },
  );

  page.drawText(`${input.institutionName} — obrigado pela confianca!`, {
    x: 48,
    y: 104,
    size: 9,
    font: helv,
    color: MUTED,
  });

  return doc.save();
}