"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PWASetup() {
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    try {
      setDismissed(localStorage.getItem("gl_install_dismissed") === "1");
    } catch {}
    function onPrompt(e: Event) {
      e.preventDefault();
      setInstallEvt(e as InstallEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!installEvt || dismissed) return null;
  return (
    <div className="fixed bottom-4 left-4 z-[90] flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg animate-fade-up">
      <Download className="h-5 w-5 text-brand" />
      <div className="text-sm">
        <p className="font-semibold text-ink">Instalar aplicativo</p>
        <p className="text-xs text-muted">Acesse a plataforma direto da tela inicial.</p>
      </div>
      <button
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
        onClick={async () => {
          await installEvt.prompt();
          setInstallEvt(null);
        }}
      >
        Instalar
      </button>
      <button
        aria-label="Dispensar"
        className="text-muted hover:text-ink"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem("gl_install_dismissed", "1");
          } catch {}
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}