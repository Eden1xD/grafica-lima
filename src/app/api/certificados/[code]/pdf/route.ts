
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  certificates,
  cohorts,
  courses,
  enrollments,
  users,
  studentProfiles,
} from "@/db/schema";

import { certificatePdf, pdfResponse } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";
import { baseUrl } from "@/lib/request";

import {
  getActiveCertificateTemplate,
  renderCustomCertificate,
} from "@/lib/certificate-template";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const [row] = await db
      .select({
        cert: certificates,
        student: users.name,
        cpf: studentProfiles.cpf,
        courseId: courses.id,
        courseName: courses.name,
        syllabus: courses.syllabus,
      })
      .from(certificates)
      .innerJoin(
        enrollments,
        eq(enrollments.id, certificates.enrollmentId)
      )
      .innerJoin(
        users,
        eq(users.id, enrollments.userId)
      )
      .leftJoin(
        studentProfiles,
        eq(studentProfiles.userId, users.id)
      )
      .innerJoin(
        cohorts,
        eq(cohorts.id, enrollments.cohortId)
      )
      .innerJoin(
        courses,
        eq(courses.id, cohorts.courseId)
      )
      .where(eq(certificates.code, code.toUpperCase()))
      .limit(1);

    if (!row) {
      return Response.json(
        { error: "Certificado não encontrado" },
        { status: 404 }
      );
    }

    if (row.cert.revokedAt) {
      return Response.json(
        { error: "Certificado revogado" },
        { status: 410 }
      );
    }

    const verifyUrl =
      `${await baseUrl()}/certificados/verificar/${row.cert.code}`;

    const data = {
      studentName: row.student,
      courseName: row.courseName,
      syllabus: row.syllabus ?? "",
      workloadHours: row.cert.workloadHours,
      issuedAt: row.cert.issuedAt,
      code: row.cert.code,
      verifyUrl,
    };

    let bytes: Uint8Array | undefined;

    // Tenta gerar o certificado com o modelo personalizado.
    try {
      const template = await getActiveCertificateTemplate(
        row.courseId
      );

      if (template) {
        bytes = await renderCustomCertificate(template, {
          ...data,
          cpf: row.cpf,
        });
      }
    } catch (error) {
      console.error(
        "[CERTIFICADOS] Falha no modelo personalizado:",
        error
      );
    }

    // Se o modelo personalizado falhar, utiliza o gerador original.
    if (!bytes) {
      const settings = await getSettings();

      bytes = await certificatePdf({
        ...data,
        institutionName: settings.institution.name,
      });
    }

    return pdfResponse(
      bytes,
      `certificado-${row.cert.code}.pdf`
    );
  } catch (error) {
    console.error(
      "[CERTIFICADOS] Erro ao gerar PDF:",
      error
    );

    return Response.json(
      { error: "Não foi possível gerar o certificado." },
      { status: 500 }
    );
  }
}
