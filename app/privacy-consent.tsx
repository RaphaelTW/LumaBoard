"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { writeStoredValue } from "./storage";

export const CONSENT_KEY = "lumaboard-consent-v1";
export const LEGAL_ACCEPTANCE_KEY = "lumaboard-legal-acceptance-v1";
export const PRIVACY_VERSION = "1.0";

export type ConsentPreferences = {
  version: string;
  necessary: true;
  preferences: boolean;
  externalContent: boolean;
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
};

const defaults: ConsentPreferences = {
  version: PRIVACY_VERSION,
  necessary: true,
  preferences: true,
  externalContent: true,
  analytics: false,
  advertising: false,
  updatedAt: "",
};

function readConsent(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null") as Partial<ConsentPreferences> | null;
    if (!value || value.version !== PRIVACY_VERSION) return null;
    return { ...defaults, ...value, necessary: true } as ConsentPreferences;
  } catch {
    return null;
  }
}

function saveConsent(value: ConsentPreferences) {
  writeStoredValue(CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent("lumaboard:consent", { detail: value }));
}

export function PrivacyConsent() {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [preferences, setPreferences] = useState(defaults);

  useEffect(() => {
    const current = readConsent();
    queueMicrotask(() => {
      if (current) setPreferences(current);
      else setOpen(true);
    });
    const reopen = () => { setCustomize(true); setOpen(true); };
    window.addEventListener("lumaboard:open-privacy", reopen);
    return () => window.removeEventListener("lumaboard:open-privacy", reopen);
  }, []);

  const persist = (next: ConsentPreferences) => {
    const saved = { ...next, necessary: true as const, version: PRIVACY_VERSION, updatedAt: new Date().toISOString() };
    saveConsent(saved);
    setPreferences(saved);
    setOpen(false);
    setCustomize(false);
  };

  return (
    <>
      <button className="privacy-fab" type="button" onClick={() => { setCustomize(true); setOpen(true); }} aria-label="Abrir preferências de privacidade">
        Privacidade
      </button>
      {open && <div className="privacy-backdrop" role="presentation">
        <section className="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
          <header>
            <div>
              <span className="eyebrow">Privacidade local-first</span>
              <h2 id="privacy-title">Cookies e armazenamento local</h2>
            </div>
          </header>
          <p>O LumaBoard usa armazenamento necessário no seu navegador para salvar agenda, layouts, temas e preferências. Atualmente não exibimos anúncios nem usamos cookies publicitários. Caso publicidade seja ativada no futuro, você receberá um novo aviso antes de qualquer carregamento opcional.</p>
          {customize && <div className="privacy-options">
            <label><span><strong>Necessários</strong><small>Funcionamento, PWA, segurança e dados locais.</small></span><input type="checkbox" checked disabled /></label>
            <label><span><strong>Preferências</strong><small>Tema, layout, filtros e personalizações.</small></span><input type="checkbox" checked={preferences.preferences} onChange={(e) => setPreferences({ ...preferences, preferences: e.target.checked })} /></label>
            <label><span><strong>Conteúdo externo</strong><small>Clima, notícias, música e outras APIs públicas.</small></span><input type="checkbox" checked={preferences.externalContent} onChange={(e) => setPreferences({ ...preferences, externalContent: e.target.checked })} /></label>
            <label><span><strong>Estatísticas</strong><small>Desativadas. Nenhum serviço analítico externo está instalado.</small></span><input type="checkbox" checked={false} disabled /></label>
            <label><span><strong>Publicidade</strong><small>Desativada. Uma nova escolha será solicitada antes de futuros anúncios.</small></span><input type="checkbox" checked={false} disabled /></label>
          </div>}
          <nav className="privacy-links" aria-label="Documentos legais">
            <Link href="/termos">Termos de Uso</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/cookies">Cookies e armazenamento</Link>
          </nav>
          <div className="privacy-actions">
            <button className="button secondary" type="button" onClick={() => setCustomize(!customize)}>{customize ? "Voltar" : "Personalizar"}</button>
            <button className="button secondary" type="button" onClick={() => persist({ ...defaults, preferences: false, externalContent: false })}>Usar somente necessários</button>
            <button className="button primary" type="button" onClick={() => persist(preferences)}>Salvar escolhas</button>
          </div>
        </section>
      </div>}
    </>
  );
}
