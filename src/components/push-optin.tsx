"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Smartphone } from "lucide-react";
import { btnCls, Card, Spinner } from "@/components/ui";
import { toast } from "@/components/action-form";
import { disablePushAction } from "@/server/actions/notifications";
import { IDLE } from "@/lib/action-state";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushOptIn() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      setIosNeedsInstall(isIOS && !standalone);
      return;
    }
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast("error", "Permissão não concedida. Você pode ativá-la nas configurações do navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push");
      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const json = sub.toJSON();
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Falha ao registrar inscrição.");
      setSubscribed(true);
      toast("ok", "Notificações push ativadas neste dispositivo!");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Não foi possível ativar o push.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await disablePushAction(IDLE, new FormData());
      setSubscribed(false);
      toast("ok", "Push desativado. A central de notificações continua funcionando.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {subscribed ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Notificações no celular e navegador</p>
        <p className="text-xs text-muted">
          {subscribed
            ? "Ativas neste dispositivo. Avisos de notas, aulas, pagamentos e comunicados."
            : iosNeedsInstall
              ? "No iPhone/iPad: instale o app na Tela de Início (Compartilhar → Adicionar à Tela de Início, iOS 16.4+) e ative por aqui."
              : supported
                ? "Receba avisos mesmo com o site fechado. Você pode desativar quando quiser."
                : "Este navegador não suporta push. A central de notificações do portal funciona normalmente."}
        </p>
        {permission === "denied" && !subscribed ? (
          <p className="mt-1 text-xs text-warn">Permissão bloqueada no navegador — libere nas configurações do site para ativar.</p>
        ) : null}
      </div>
      {supported ? (
        subscribed ? (
          <button onClick={disable} disabled={busy} className={btnCls("secondary", "sm")}>{busy ? <Spinner /> : <BellOff className="h-4 w-4" />} Desativar</button>
        ) : (
          <button onClick={enable} disabled={busy || permission === "denied"} className={btnCls("primary", "sm")}>{busy ? <Spinner /> : <Smartphone className="h-4 w-4" />} Ativar push</button>
        )
      ) : null}
    </Card>
  );
}