"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { safeParseJSON, writeStoredValue } from "./storage";

function sanitizeDiagnostic(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, maximumLength)
    : "";
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      const history = safeParseJSON(window.localStorage.getItem("lumaboard-client-errors-v1"));
      const list = Array.isArray(history) ? history.slice(-19) : [];
      writeStoredValue("lumaboard-client-errors-v1", [...list, { message: sanitizeDiagnostic(error.message, 500), stack: sanitizeDiagnostic(error.stack, 2000), componentStack: sanitizeDiagnostic(info.componentStack, 2000), occurredAt: new Date().toISOString() }]);
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
          <code>{sanitizeDiagnostic(this.state.error.message, 500) || "Erro inesperado"}</code>
          <button className="button primary" onClick={() => window.location.reload()}><RefreshCw /> Recarregar</button>
        </section>
      </main>
    );
  }
}
