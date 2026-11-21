"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { btnCls } from "@/components/ui";

export function VerifyForm() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <form
      className="mt-6 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = code.trim().toUpperCase();
        if (clean) router.push(`/certificados/verificar/${encodeURIComponent(clean)}`);
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Código do certificado (ex.: ABC123XYZ456)"
        aria-label="Código do certificado"
        className="h-12 flex-1 rounded-xl border border-line bg-surface px-4 font-mono text-sm tracking-widest focus:border-brand focus:outline-none"
      />
      <button type="submit" className={btnCls("primary", "lg")}>
        <ShieldCheck className="h-4 w-4" /> Verificar
      </button>
    </form>
  );
}