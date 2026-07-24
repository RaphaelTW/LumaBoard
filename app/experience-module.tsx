"use client";

import { ArchiveRestore, BookOpen, Check, CloudDownload, Download, Gauge, History, RefreshCw, Save, Smartphone, Trash2, Upload, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { readAutomationState } from "./automation";
import { CHANGELOG } from "./changelog-data";
import { useLocalWidgets } from "./local-widgets";
import { APP_VERSION, usePWA } from "./pwa-manager";
import { exportLocalBackup, importLocalBackup, migrateBackup, resetSettingsPreservingPersonalData, safeParseJSON, storageUsage, type BackupPayload } from "./storage";
import type { PublicSummary } from "./public-data";

export type PublicStatus = "idle" | "loading" | "ready" | "stale" | "error";

type DismissedState = { dismissed: string[]; audioErrors: Array<{ id: string; message: string; occurredAt: string }> };

function readDismissed(): DismissedState {
  const parsed = safeParseJSON(typeof window === "undefined" ? null : window.localStorage.getItem("lumaboard-notification-center-v1"));
  if (!parsed || typeof parsed !== "object") return { dismissed: [], audioErrors: [] };
  const value = parsed as Partial<DismissedState>;
  return {
    dismissed: Array.isArray(value.dismissed) ? value.dismissed.filter((item): item is string => typeof item === "string").slice(-500) : [],
    audioErrors: Array.isArray(value.audioErrors) ? value.audioErrors.filter((item): item is { id: string; message: string; occurredAt: string } => Boolean(item && typeof item.id === "string" && typeof item.message === "string" && typeof item.occurredAt === "string")).slice(-20) : [],
  };
}

function saveDismissed(value: DismissedState) {
  window.localStorage.setItem("lumaboard-notification-center-v1", JSON.stringify(value));
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function collectPerformance() {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  return {
    loadedAt: new Date().toISOString(),
    domInteractiveMs: navigation ? Math.round(navigation.domInteractive) : null,
    loadMs: navigation ? Math.round(navigation.loadEventEnd) : null,
    transferKb: navigation ? Math.round(navigation.transferSize / 1024) : null,
    heapMb: memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
    heapLimitMb: memory ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : null,
  };
}

export function ExperienceModule({ summary, publicStatus, weatherStatus, onToast }: { summary: PublicSummary | null; publicStatus: PublicStatus; weatherStatus: string; onToast: (message: string) => void }) {
  const pwa = usePWA();
  const agenda = useLocalWidgets();
  const [dismissed, setDismissed] = useState<DismissedState>({ dismissed: [], audioErrors: [] });
  const [usage, setUsage] = useState({ bytes: 0, items: 0 });
  const [performanceData, setPerformanceData] = useState(() => ({ loadedAt: "", domInteractiveMs: null as number | null, loadMs: null as number | null, transferKb: null as number | null, heapMb: null as number | null, heapLimitMb: null as number | null }));
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setDismissed(readDismissed());
      setUsage(storageUsage());
      const data = collectPerformance();
      setPerformanceData(data);
      window.localStorage.setItem("lumaboard-performance-v1", JSON.stringify(data));
    });
    const audioError = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      setDismissed((current) => {
        const next = { ...current, audioErrors: [...current.audioErrors, event.detail].slice(-20) };
        saveDismissed(next);
        return next;
      });
    };
    window.addEventListener("lumaboard:audio-error", audioError);
    return () => window.removeEventListener("lumaboard:audio-error", audioError);
  }, []);

  const savedNewsCount = useMemo(() => {
    const value = safeParseJSON(typeof window === "undefined" ? null : window.localStorage.getItem("lumaboard-news-state-v1"));
    return value && typeof value === "object" && Array.isArray((value as { savedIds?: unknown }).savedIds) ? ((value as { savedIds: unknown[] }).savedIds.length) : 0;
  }, []);
  const rainHistory = useMemo(() => typeof window === "undefined" ? [] : readAutomationState().history.slice(-5).reverse(), []);
  const storageIssues = useMemo(() => {
    const value = safeParseJSON(typeof window === "undefined" ? null : window.localStorage.getItem("lumaboard-storage-issues-v1"));
    return Array.isArray(value) ? value.filter((item): item is { key: string; reason: string; occurredAt: string } => Boolean(item && typeof item === "object" && typeof (item as { key?: unknown }).key === "string" && typeof (item as { reason?: unknown }).reason === "string" && typeof (item as { occurredAt?: unknown }).occurredAt === "string")).slice(-5).reverse() : [];
  }, []);
  const clientErrors = useMemo(() => {
    const value = safeParseJSON(typeof window === "undefined" ? null : window.localStorage.getItem("lumaboard-client-errors-v1"));
    return Array.isArray(value) ? value.filter((item): item is { message: string; occurredAt: string } => Boolean(item && typeof item === "object" && typeof (item as { message?: unknown }).message === "string" && typeof (item as { occurredAt?: unknown }).occurredAt === "string")).slice(-3).reverse() : [];
  }, []);

  const notices = useMemo(() => {
    const list: Array<{ id: string; type: string; title: string; detail: string; action?: () => void }> = [];
    agenda.overdueTasks.slice(0, 8).forEach((item) => list.push({ id: `overdue-${item.id}-${item.occurrenceDate}`, type: "Tarefa vencida", title: item.title, detail: `${item.occurrenceDate} Â· ${item.time}` }));
    agenda.upcomingEvents.slice(0, 5).forEach((item) => list.push({ id: `upcoming-${item.id}-${item.occurrenceDate}`, type: "PrÃ³ximo compromisso", title: item.title, detail: `${item.occurrenceDate} Â· ${item.time}` }));
    rainHistory.forEach((item) => list.push({ id: `rain-${item.id}`, type: "Alerta de chuva", title: item.message, detail: new Date(item.createdAt).toLocaleString("pt-BR") }));
    summary?.warnings.forEach((warning, index) => list.push({ id: `api-warning-${index}-${warning}`, type: "Falha de API", title: warning, detail: "O Ãºltimo resultado em cache continua disponÃ­vel." }));
    if (publicStatus === "error" || publicStatus === "stale" || weatherStatus === "error" || weatherStatus === "stale") list.push({ id: "api-status", type: "Dados em cache", title: "Uma ou mais fontes estÃ£o indisponÃ­veis", detail: `Tempo: ${weatherStatus} Â· Dados pÃºblicos: ${publicStatus}` });
    if (pwa.updateAvailable) list.push({ id: "pwa-update", type: "AtualizaÃ§Ã£o disponÃ­vel", title: `LumaBoard ${APP_VERSION} pronto para atualizar`, detail: "Uma cÃ³pia de seguranÃ§a serÃ¡ criada antes de recarregar.", action: pwa.applyUpdate });
    dismissed.audioErrors.forEach((item) => list.push({ id: `audio-${item.id}-${item.occurredAt}`, type: "Ãudio interrompido", title: item.message, detail: new Date(item.occurredAt).toLocaleString("pt-BR") }));
    storageIssues.forEach((item) => list.push({ id: `storage-${item.key}-${item.occurredAt}`, type: "Armazenamento local", title: `Falha em ${item.key}`, detail: `${item.reason} Â· ${new Date(item.occurredAt).toLocaleString("pt-BR")}` }));
    clientErrors.forEach((item) => list.push({ id: `client-${item.occurredAt}-${item.message}`, type: "Erro recuperado", title: item.message, detail: new Date(item.occurredAt).toLocaleString("pt-BR") }));
    if (savedNewsCount) list.push({ id: "saved-news", type: "NotÃ­cias salvas", title: `${savedNewsCount} notÃ­cia${savedNewsCount === 1 ? "" : "s"} para ler depois`, detail: "DisponÃ­veis enquanto permanecerem no cache local." });
    return list.filter((item) => !dismissed.dismissed.includes(item.id));
  }, [agenda.overdueTasks, agenda.upcomingEvents, clientErrors, dismissed.audioErrors, dismissed.dismissed, publicStatus, pwa.applyUpdate, pwa.updateAvailable, rainHistory, savedNewsCount, storageIssues, summary?.warnings, weatherStatus]);

  const dismiss = (id: string) => {
    const next = { ...dismissed, dismissed: [...dismissed.dismissed, id].slice(-500) };
    setDismissed(next);
    saveDismissed(next);
  };

  const exportBackup = () => download(`lumaboard-backup-v${APP_VERSION}.json`, JSON.stringify(exportLocalBackup(), null, 2));
  const importBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.size > 4_500_000) return onToast("O backup deve ter atÃ© 4,5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const migrated = migrateBackup(safeParseJSON(String(reader.result)));
      if (!migrated) return onToast("Backup invÃ¡lido ou incompatÃ­vel.");
      const result = importLocalBackup(migrated as BackupPayload);
      onToast(`${result.imported} Ã¡reas restauradas; ${result.skipped} ignoradas.`);
      setUsage(storageUsage());
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const clearCaches = async () => {
    navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_RUNTIME_CACHES" });
    ["lumaboard-weather-v1", "lumaboard-public-data-v1", "lumaboard-public-data-v2", "lumaboard-public-explorer-v1"].forEach((key) => window.localStorage.removeItem(key));
    setUsage(storageUsage());
    onToast("Caches limpos; agenda e configuraÃ§Ãµes foram preservadas.");
  };

  const resetSettings = () => {
    if (!window.confirm("Restaurar configuraÃ§Ãµes e manter agenda, tarefas, Pomodoro e favoritos?")) return;
    resetSettingsPreservingPersonalData();
    onToast("ConfiguraÃ§Ãµes restauradas. Recarregandoâ€¦");
    window.setTimeout(() => window.location.reload(), 500);
  };

  return (
    <section className="module-view experience-view">
      {pwa.updateAvailable && <div className="update-banner"><CloudDownload /><div><strong>Nova versÃ£o pronta</strong><span>O LumaBoard criou uma atualizaÃ§Ã£o. Salve com seguranÃ§a e recarregue quando desejar.</span></div><button className="button primary" onClick={pwa.applyUpdate}>Atualizar agora</button></div>}
      <header className="module-heading"><div><span className="eyebrow">PWA & OFFLINE EXPERIENCE</span><h1>InstalÃ¡vel, resiliente e local.</h1><p>Continue usando o painel sem conexÃ£o e controle quando uma nova versÃ£o deve entrar em funcionamento.</p></div><div className="module-actions">{pwa.installAvailable && <button className="button primary" onClick={() => void pwa.install()}><Download /> Instalar app</button>}<button className="button secondary" onClick={() => void pwa.checkForUpdate()}><RefreshCw /> Procurar atualizaÃ§Ã£o</button></div></header>

      <section className="pwa-status-grid">
        <article className="panel pwa-status-card"><span className={`metric-icon ${pwa.online ? "online" : "offline"}`}>{pwa.online ? <Wifi /> : <WifiOff />}</span><div><strong>{pwa.online ? "Online" : "Offline"}</strong><span>{pwa.statusText}</span><small>Ao reconectar, clima e dados pÃºblicos sÃ£o atualizados automaticamente.</small></div><button className="button secondary" onClick={pwa.syncNow}>Sincronizar</button></article>
        <article className="panel pwa-status-card"><span className="metric-icon"><Smartphone /></span><div><strong>{pwa.installed ? "App instalado" : "Pronto para instalar"}</strong><span>Android, Windows, macOS e iPhone</span><small>No iPhone: Compartilhar â†’ Adicionar Ã  Tela de InÃ­cio.</small></div><label className="check-row"><input type="checkbox" checked={pwa.settings.startInDisplay} onChange={(event) => pwa.setStartInDisplay(event.target.checked)} /> Iniciar direto no display</label></article>
        <article className="panel pwa-status-card"><span className="metric-icon"><Save /></span><div><strong>{formatBytes(usage.bytes)}</strong><span>{usage.items} Ã¡reas locais</span><small>Agenda, temas, layouts e caches ficam somente neste navegador.</small></div><button className="button secondary" onClick={() => { pwa.createSafetySnapshot(); onToast("CÃ³pia de seguranÃ§a temporÃ¡ria criada."); }}>Proteger agora</button></article>
      </section>

      <section className="notification-center-section">
        <header className="section-heading"><div><span className="eyebrow">CENTRAL DE NOTIFICAÃ‡Ã•ES</span><h2>{notices.length} itens que pedem atenÃ§Ã£o</h2><small>{dismissed.dismissed.length} lembretes dispensados permanecem somente neste navegador.</small></div><div className="section-heading-actions">{dismissed.dismissed.length > 0 && <button className="text-button" onClick={() => { const next = { ...dismissed, dismissed: [] }; setDismissed(next); saveDismissed(next); }}>Restaurar dispensados</button>}{notices.length > 0 && <button className="text-button" onClick={() => { const next = { ...dismissed, dismissed: [...dismissed.dismissed, ...notices.map((item) => item.id)].slice(-500) }; setDismissed(next); saveDismissed(next); }}>Dispensar todos</button>}</div></header>
        <div className="notification-center-list">
          {notices.length === 0 && <article className="panel empty-notifications"><Check /><div><strong>Tudo em ordem</strong><span>Nenhuma tarefa vencida, falha ou atualizaÃ§Ã£o pendente.</span></div></article>}
          {notices.map((notice) => <article className="panel notification-center-item" key={notice.id}><span className="notification-type">{notice.type}</span><div><strong>{notice.title}</strong><span>{notice.detail}</span></div>{notice.action && <button className="button primary" onClick={notice.action}>Resolver</button>}<button className="icon-button compact" aria-label="Dispensar" onClick={() => dismiss(notice.id)}>Ã—</button></article>)}
        </div>
      </section>

      <section className="experience-tools-grid">
        <article className="panel experience-tool-card"><ArchiveRestore /><div><strong>Backup validado</strong><span>{pwa.hasUpdateBackup ? "HÃ¡ uma cÃ³pia temporÃ¡ria criada antes da atualizaÃ§Ã£o." : "Limite de 4,5 MB, migraÃ§Ã£o automÃ¡tica e somente chaves reconhecidas."}</span></div><div><button className="button secondary" onClick={exportBackup}><Download /> Exportar</button><button className="button secondary" onClick={() => importRef.current?.click()}><Upload /> Importar</button>{pwa.hasUpdateBackup && <button className="button primary" onClick={() => { if (pwa.restoreUpdateBackup()) { onToast("CÃ³pia anterior restaurada. Recarregandoâ€¦"); window.setTimeout(() => window.location.reload(), 400); } else onToast("NÃ£o foi possÃ­vel restaurar a cÃ³pia temporÃ¡ria."); }}>Recuperar atualizaÃ§Ã£o</button>}<input ref={importRef} hidden type="file" accept="application/json" onChange={importBackup} /></div></article>
        <article className="panel experience-tool-card"><Trash2 /><div><strong>Limpeza seletiva</strong><span>Apague respostas antigas sem remover agenda, layouts, temas ou favoritos.</span></div><button className="button secondary" onClick={() => void clearCaches()}>Limpar caches</button></article>
        <article className="panel experience-tool-card"><History /><div><strong>Restaurar configuraÃ§Ãµes</strong><span>Mantenha agenda, tarefas, Pomodoro, notÃ­cias e mÃºsicas favoritas.</span></div><button className="button secondary" onClick={resetSettings}>Restaurar</button></article>
        <article className="panel experience-tool-card"><Gauge /><div><strong>Desempenho local</strong><span>DOM {performanceData.domInteractiveMs ?? "â€”"} ms Â· carga {performanceData.loadMs ?? "â€”"} ms Â· heap {performanceData.heapMb ?? "â€”"} MB</span></div><button className="button secondary" onClick={() => { const data = collectPerformance(); setPerformanceData(data); window.localStorage.setItem("lumaboard-performance-v1", JSON.stringify(data)); }}>Medir novamente</button></article>
      </section>

      <section className="install-guides panel"><header><Smartphone /><div><strong>Como instalar</strong><span>NÃ£o Ã© necessÃ¡rio baixar uma loja de aplicativos.</span></div></header><div><article><strong>Android</strong><p>Chrome â†’ menu â‹® â†’ Instalar app ou Adicionar Ã  tela inicial.</p></article><article><strong>Windows</strong><p>Edge ou Chrome â†’ Ã­cone de instalaÃ§Ã£o na barra de endereÃ§o.</p></article><article><strong>macOS</strong><p>Safari â†’ Arquivo â†’ Adicionar ao Dock; no Chrome, use Instalar.</p></article><article><strong>iPhone/iPad</strong><p>Safari â†’ Compartilhar â†’ Adicionar Ã  Tela de InÃ­cio.</p></article></div></section>

      <section className="changelog-section">
        <header className="section-heading"><div><span className="eyebrow">CHANGELOG</span><h2>O que mudou em cada versÃ£o</h2></div><span className="status-chip"><BookOpen /> V{APP_VERSION}</span></header>
        <div className="changelog-list">{CHANGELOG.map((entry, index) => <article className={`panel changelog-entry ${index === 0 ? "current" : ""}`} key={entry.version}><header><span>v{entry.version}</span><div><strong>{entry.title}</strong><small>{entry.date}</small></div>{index === 0 && <i>NOVA</i>}</header><ul>{entry.highlights.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
      </section>
    </section>
  );
}
