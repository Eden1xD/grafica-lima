export type FieldName = "studentName" | "cpf" | "courseName" | "workload" | "issuedAt" | "code" | "verifyUrl" | "syllabus";
export type FontFamily = "Helvetica" | "TimesRoman" | "Courier";
export type TextAlign = "left" | "center" | "right";
export type Placement = {
  page: number; x: number; y: number; size: number; maxWidth?: number; color?: string;
  font?: FontFamily; bold?: boolean; italic?: boolean; align?: TextAlign;
  lineHeight?: number; opacity?: number; rotation?: number; hidden?: boolean;
};
export type QrPlacement = { page: number; x: number; y: number; size: number; hidden?: boolean };
export type TextElement = Placement & { id: string; text: string; name?: string };
export type ShapeElement = {
  id: string; name?: string; type: "rectangle" | "line" | "ellipse";
  page: number; x: number; y: number; width: number; height: number;
  color?: string; opacity?: number; borderWidth?: number; hidden?: boolean;
};
export type Layout = Partial<Record<FieldName, Placement>> & {
  qr?: QrPlacement;
  texts?: TextElement[];
  shapes?: ShapeElement[];
};
export type Sponsor = {
  id: string; name: string; image: string; page: number; x: number; y: number;
  width: number; height: number; opacity?: number; rotation?: number; hidden?: boolean;
};
export const DEFAULT_LAYOUT: Layout = {
  studentName: { page: 0, x: 43, y: 199, size: 24, maxWidth: 490, bold: true },
  cpf: { page: 0, x: 43, y: 257, size: 12, maxWidth: 460 },
  courseName: { page: 0, x: 43, y: 288, size: 17, maxWidth: 460, bold: true },
  workload: { page: 0, x: 43, y: 324, size: 12, maxWidth: 460 },
  issuedAt: { page: 0, x: 43, y: 357, size: 12, maxWidth: 460 },
  code: { page: 0, x: 43, y: 551, size: 8, maxWidth: 650 },
  syllabus: { page: 1, x: 43, y: 108, size: 11, maxWidth: 730, lineHeight: 1.35 },
  qr: { page: 0, x: 737, y: 505, size: 58 },
  texts: [], shapes: [],
};
