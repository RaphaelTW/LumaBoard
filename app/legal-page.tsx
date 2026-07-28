import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <main className="legal-page">
    <div className="legal-shell">
      <Link className="legal-back" href="/">← Voltar ao LumaBoard</Link>
      <span className="eyebrow">LumaBoard v1.8.4</span>
      <h1>{title}</h1>
      <p className="legal-updated">Última atualização: {updated}</p>
      <div className="legal-content">{children}</div>
      <nav className="legal-nav"><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link><Link href="/cookies">Cookies e armazenamento</Link></nav>
      <p className="legal-note">Este texto é informativo e deve ser revisado por profissional jurídico antes de monetização, coleta de dados pessoais ou expansão internacional.</p>
    </div>
  </main>;
}
