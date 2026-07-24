"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      const history = JSON.parse(window.localStorage.getItem("lumaboard-client-errors-v1") ?? "[]") as unknown;
      const list = Array.isArray(history) ? history.slice(-19) : [];
      window.localStorage.setItem("lumaboard-client-errors-v1", JSON.stringify([...list, { message: error.message, stack: error.stack?.slice(0, 2000), componentStack: info.componentStack?.slice(0, 2000), occurredAt: new Date().toISOString() }]));
    } catch {
      // Error reporting must never create a second failure.
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error-page">
        <section className="panel fatal-error-card">
          <AlertTriangle />
          <span className="eyebrow">RECUPERAÇÃO LOCAL</span>
          <h1>O LumaBoard encontrou um erro.</h1>
          <p>Seus dados continuam no localStorage. Recarregue a aplicação; se o problema persistir, exporte o backup pela tela de experiência.</p>
          <code>{this.state.error.message}</code>
          <button className="button primary" onClick={() => window.location.reload()}><RefreshCw /> Recarregar</button>
        </section>
      </main>
    );
  }
}
