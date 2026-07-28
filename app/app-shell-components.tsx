"use client";

import {
  Bell,
  CalendarDays,
  Check,
  CloudDownload,
  Command,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  Wifi,
  WifiOff,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { View } from "./modules";
import type { LocalNotificationRecord } from "./notification-system";

export type ShellNavItem = {
  id: View;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
};

export function Logo() {
  return (
    <div className="brand" aria-label="LumaBoard">
      <span className="brand-mark" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={index} style={{ transform: `rotate(${index * 30}deg)` }} />
        ))}
      </span>
      <span>LumaBoard</span>
    </div>
  );
}

export function AppSidebar({
  navItems,
  activeView,
  appVersion,
  deviceName,
  onNavigate,
}: {
  navItems: ShellNavItem[];
  activeView: View;
  appVersion: string;
  deviceName: string;
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="sidebar">
      <Logo />
      <nav aria-label="Principal">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeView === id ? "active" : ""}`}
            onClick={() => onNavigate(id)}
            aria-current={activeView === id ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-version" aria-label={`Versão ${appVersion}`}>v{appVersion}</div>
      <div className="sidebar-device">
        <div className="device-dot" />
        <div>
          <strong>{deviceName}</strong>
          <span>dados locais · sem conta</span>
        </div>
        <Monitor aria-hidden="true" />
      </div>
    </aside>
  );
}

export function AppTopbar({
  navItems,
  activeView,
  appVersion,
  online,
  statusText,
  theme,
  notificationCount,
  notificationPanelOpen,
  avatarInitials,
  onNavigate,
  onOpenSearch,
  onToggleTheme,
  onToggleNotifications,
}: {
  navItems: ShellNavItem[];
  activeView: View;
  appVersion: string;
  online: boolean;
  statusText: string;
  theme: "paper" | "night";
  notificationCount: number;
  notificationPanelOpen: boolean;
  avatarInitials: string;
  onNavigate: (view: View) => void;
  onOpenSearch: () => void;
  onToggleTheme: () => void;
  onToggleNotifications: () => void;
}) {
  return (
    <header className="topbar">
      <div className="mobile-brand">
        <Logo />
        <span
          className={`mobile-connection-dot ${online ? "" : "offline"}`}
          title={statusText}
          role="status"
          aria-label={statusText}
        />
      </div>
      <div className="crumb">
        <span className={`status-dot ${online ? "" : "offline"}`} />
        LumaBoard / {navItems.find((item) => item.id === activeView)?.label}
        <small className="data-freshness">{online ? <Wifi /> : <WifiOff />} {statusText}</small>
      </div>
      <div className="topbar-actions">
        <button className="version-pill" onClick={() => onNavigate("experience")} aria-label={`Abrir novidades da versão ${appVersion}`}>v{appVersion}</button>
        <button className="global-search-trigger" onClick={onOpenSearch} aria-label="Abrir busca global">
          <Search /><span>Buscar no LumaBoard</span><kbd><Command /> K</kbd>
        </button>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Ativar tema ${theme === "paper" ? "noturno" : "claro"}`}
        >
          {theme === "paper" ? <Moon /> : <Sun />}
          <span>{theme === "paper" ? "Modo noturno" : "Modo papel"}</span>
        </button>
        <button
          className="icon-button"
          aria-label={`Notificações${notificationCount > 0 ? `: ${notificationCount} pendente(s)` : ""}`}
          aria-expanded={notificationPanelOpen}
          aria-controls="notification-quick-panel"
          onClick={onToggleNotifications}
        >
          <Bell />
          {notificationCount > 0 && <i className="notification-dot" />}
        </button>
        <button className="icon-button" aria-label="Configurações" onClick={() => onNavigate("appearance")}>
          <Settings />
        </button>
        <button className="avatar" aria-label={`Perfil local: ${avatarInitials}`} onClick={() => onNavigate("appearance")}>
          {avatarInitials}
        </button>
      </div>
    </header>
  );
}

export function NotificationQuickPanel({
  notificationCount,
  unreadInbox,
  overdueCount,
  updateAvailable,
  publicDataError,
  weatherError,
  online,
  notificationPermission,
  unreadCount,
  onClose,
  onNavigate,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onRequestNotifications,
}: {
  notificationCount: number;
  unreadInbox: LocalNotificationRecord[];
  overdueCount: number;
  updateAvailable: boolean;
  publicDataError: boolean;
  weatherError: boolean;
  online: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  unreadCount: number;
  onClose: () => void;
  onNavigate: (view: View) => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onRequestNotifications: () => void;
}) {
  const navigateAndClose = (view: View) => {
    onNavigate(view);
    onClose();
  };

  return (
    <div className="notification-quick-backdrop" role="presentation" onClick={onClose}>
      <section
        id="notification-quick-panel"
        className="notification-quick-panel panel"
        role="dialog"
        aria-modal="true"
        aria-label="Notificações rápidas"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div><span className="eyebrow">NOTIFICAÇÕES</span><strong>{notificationCount > 0 ? `${notificationCount} item(ns) pedem atenção` : "Tudo em ordem"}</strong></div>
          <button className="icon-button compact" onClick={onClose} aria-label="Fechar notificações"><X /></button>
        </header>
        <div className="notification-quick-list">
          {notificationCount === 0 && <p><Check /> Nenhuma tarefa vencida, falha ou atualização pendente.</p>}
          {unreadInbox.slice(0, 4).map((item) => <button key={item.id} onClick={() => { onMarkNotificationRead(item.id); navigateAndClose("agenda"); }}><Bell /><span><strong>{item.title}</strong><small>{item.body}</small></span></button>)}
          {overdueCount > 0 && <button onClick={() => navigateAndClose("agenda")}><CalendarDays /><span><strong>{overdueCount} tarefa(s) atrasada(s)</strong><small>Abrir agenda e concluir ou reagendar.</small></span></button>}
          {updateAvailable && <button onClick={() => navigateAndClose("experience")}><CloudDownload /><span><strong>Atualização disponível</strong><small>Abra Experiência para proteger os dados e atualizar.</small></span></button>}
          {(publicDataError || weatherError) && <button onClick={() => navigateAndClose("diagnostics")}><Wrench /><span><strong>Uma fonte pública falhou</strong><small>Abrir diagnóstico das APIs.</small></span></button>}
          {!online && <button onClick={() => navigateAndClose("experience")}><WifiOff /><span><strong>Você está offline</strong><small>O LumaBoard está usando os últimos dados em cache.</small></span></button>}
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && <button onClick={onRequestNotifications}><Bell /><span><strong>Ativar alertas locais</strong><small>Funcionam enquanto o LumaBoard estiver aberto.</small></span></button>}
        </div>
        <footer><div className="notification-quick-footer-actions">{unreadCount > 0 && <button className="button secondary" onClick={onMarkAllNotificationsRead}>Marcar lidas</button>}<button className="button primary" onClick={() => navigateAndClose("experience")}>Abrir central completa</button></div></footer>
      </section>
    </div>
  );
}
