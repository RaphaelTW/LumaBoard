"use client";

import { Check, Database, RefreshCw, Server, Trash2, Wifi, WifiOff, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicSummary } from "./public-data";

const CACHE_KEYS = [
  "lumaboard-weather-v1",
  "lumaboard-public-data-v1",
  "lumaboard-public-data-v2",
  "lumaboard-public-explorer-v1",
  "lumaboard-music-v1",
  "lumaboard-agenda-notifications",
];

export function DiagnosticsModule({
  weatherStatus,
  publicStatus,
  summary,
  onRefresh,
  onToast,
}: {
  weatherStatus: string;
  publicStatus: string;
  summary: PublicSummary;
  onRefresh: () => Promise<void> | void;
  onToast: (message: string) => void;
}) {
  const [online, setOnline] = useState(true);
  const [storageBytes, setStorageBytes] = useState(0);
  const [testing, setTesting] = useState(false);

  const calculateStorage = () => {
    let total = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("lumaboard-")) continue;
      total += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
    setStorageBytes(total * 2);
  };

  useEffect(() => {
    queueMicrotask(() => {
      setOnline(navigator.onLine);
      calculateStorage();
    });
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("storage", calculateStorage);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("storage", calculateStorage);
    };
  }, []);

  const providers = useMemo(() => {
    const failed = new Set(summary.warnings.map((warning) => warning.toLocaleLowerCase("pt-BR")));
    return summary.sources.map((source) => ({ source, ok: ![...failed].some((warning) => warning.includes(source.toLocaleLowerCase("pt-BR"))) }));
  }, [summary.sources, summary.warnings]);

  const clearCache = () => {
    CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    calculateStorage();
    onToast("Caches removidos. Agenda, layouts, playlists e preferências foram preservados.");
  };

  const test = async () => {
    setTesting(true);
    try {
      await onRefresh();
      onToast("Teste concluído. Consulte os cartões de diagnóstico.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="module-view diagnostics-view">
      <header className="module-heading"><div><span className="eyebrow">DIAGNÓSTICO LOCAL</span><h1>Veja o que está funcionando.</h1><p>Teste conexão, clima, Functions, provedores e armazenamento sem apagar sua configuração.</p></div><div className="module-actions"><button className="button secondary" onClick={clearCache}><Trash2 /> Limpar apenas cache</button><button className="button primary" onClick={() => void test()} disabled={testing}><RefreshCw className={testing ? "spin" : ""} /> Testar agora</button></div></header>
      <div className="diagnostics-summary-grid">
        <article className="panel"><span>{online ? <Wifi /> : <WifiOff />}</span><div><strong>{online ? "Internet disponível" : "Sem conexão"}</strong><small>{online ? "As APIs podem ser atualizadas." : "O painel continua com o último cache local."}</small></div></article>
        <article className="panel"><span><Server /></span><div><strong>Function: {publicStatus}</strong><small>{summary.warnings.length ? `${summary.warnings.length} fonte(s) com aviso.` : "Resumo público sem avisos."}</small></div></article>
        <article className="panel"><span><RefreshCw /></span><div><strong>Clima: {weatherStatus}</strong><small>Open-Meteo com fallback no navegador.</small></div></article>
        <article className="panel"><span><Database /></span><div><strong>{new Intl.NumberFormat("pt-BR", { style: "unit", unit: "kilobyte", maximumFractionDigits: 1 }).format(storageBytes / 1024)}</strong><small>Estimativa dos dados LumaBoard no localStorage.</small></div></article>
      </div>
      <article className="panel provider-diagnostics-panel">
        <header><div><span className="eyebrow">PROVEDORES DO ÚLTIMO RESUMO</span><h2>{providers.length} fontes identificadas</h2></div><span className="status-chip">{summary.updatedAt ? new Date(summary.updatedAt).toLocaleString("pt-BR") : "sem atualização"}</span></header>
        <div className="provider-diagnostics-list">
          {providers.map((provider) => <div key={provider.source}><span className={provider.ok ? "ok" : "warning"}>{provider.ok ? <Check /> : <XCircle />}</span><strong>{provider.source}</strong><small>{provider.ok ? "respondeu ou possui dado em cache" : "verifique o aviso do resumo"}</small></div>)}
          {providers.length === 0 && <p>Nenhum resumo carregado ainda.</p>}
        </div>
      </article>
      <article className="panel cache-safety-panel"><Database /><div><strong>O botão de limpeza preserva seus dados pessoais</strong><span>Não remove agenda, Pomodoro, layouts, playlists, regras, fontes ativas, tema ou perfis de display.</span></div></article>
    </section>
  );
}
