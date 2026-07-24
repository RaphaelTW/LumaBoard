"use client";

import { CalendarDays, CloudOff, Focus, LayoutDashboard, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card">
        <span className="offline-icon"><CloudOff /></span>
        <span className="eyebrow">LUMABOARD OFFLINE</span>
        <h1>Seu painel continua disponível.</h1>
        <p>Layouts, agenda, tarefas, Pomodoro, temas e os últimos dados públicos permanecem neste navegador. Novas informações serão sincronizadas quando a conexão voltar.</p>
        <div className="offline-features">
          <span><LayoutDashboard /> Layouts salvos</span>
          <span><CalendarDays /> Agenda local</span>
          <span><Focus /> Pomodoro</span>
        </div>
        <div className="offline-actions">
          <button className="button primary" onClick={() => window.location.reload()}><RefreshCw /> Tentar novamente</button>
          <a className="button secondary" href="/display">Abrir display em cache</a>
        </div>
      </section>
    </main>
  );
}
