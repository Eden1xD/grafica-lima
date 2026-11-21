"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IDLE } from "@/lib/action-state";
import { checkPaymentStatusAction } from "@/server/actions/finance";

/** Consulta o status real do pagamento no provedor enquanto a página está aberta. */
export function PaymentPoller({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const ticks = useRef(0);
  useEffect(() => {
    const iv = setInterval(async () => {
      ticks.current += 1;
      if (ticks.current > 80) {
        clearInterval(iv);
        return;
      }
      try {
        const fd = new FormData();
        fd.set("paymentId", paymentId);
        const res = await checkPaymentStatusAction(IDLE, fd);
        if (res.data?.status === "aprovado" || res.data?.status === "recusado") {
          clearInterval(iv);
          router.refresh();
        }
      } catch {}
    }, 6000);
    return () => clearInterval(iv);
  }, [paymentId, router]);
  return null;
}