import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { VerifyForm } from "@/components/verify-form";

export const metadata: Metadata = { title: "Verificar certificado" };

export default function VerificarIndexPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand"><ShieldCheck className="h-8 w-8" /></span>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">Verificação de autenticidade</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">Digite o código impresso no certificado para confirmar sua autenticidade junto à Gráfica Lima.</p>
      <VerifyForm />
    </div>
  );
}