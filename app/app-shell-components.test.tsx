import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Grid2X2, Smartphone } from "lucide-react";
import { AppSidebar, AppTopbar, NotificationQuickPanel, type ShellNavItem } from "./app-shell-components";

const navItems: ShellNavItem[] = [
  { id: "overview", label: "Visão geral", mobileLabel: "Início", icon: Grid2X2 },
  { id: "experience", label: "Experiência", icon: Smartphone },
];

describe("app shell components", () => {
  it("renders the sidebar with version, device and active navigation state", () => {
    const html = renderToStaticMarkup(
      <AppSidebar navItems={navItems} activeView="overview" appVersion="1.8.4" deviceName="Display local" onNavigate={vi.fn()} />,
    );

    expect(html).toContain("LumaBoard");
    expect(html).toContain("v1.8.4");
    expect(html).toContain("Display local");
    expect(html).toContain('aria-current="page"');
  });

  it("renders the topbar with avatar initials and notification count", () => {
    const html = renderToStaticMarkup(
      <AppTopbar
        navItems={navItems}
        activeView="experience"
        appVersion="1.8.4"
        online={false}
        statusText="dados em cache"
        theme="paper"
        notificationCount={3}
        notificationPanelOpen={false}
        avatarInitials="RS"
        onNavigate={vi.fn()}
        onOpenSearch={vi.fn()}
        onToggleTheme={vi.fn()}
        onToggleNotifications={vi.fn()}
      />,
    );

    expect(html).toContain("LumaBoard / Experiência");
    expect(html).toContain("dados em cache");
    expect(html).toContain("RS");
    expect(html).toContain("Notificações: 3 pendente(s)");
  });

  it("renders actionable quick notifications", () => {
    const html = renderToStaticMarkup(
      <NotificationQuickPanel
        notificationCount={2}
        unreadInbox={[{
          id: "n1",
          source: "agenda",
          sourceKey: "agenda:event-1:2026-07-28",
          eventId: "event-1",
          occurrenceDate: "2026-07-28",
          title: "Reunião",
          body: "Começa em breve",
          severity: "info",
          createdAt: new Date().toISOString(),
          readAt: null,
          dismissedAt: null,
          snoozedUntil: null,
        }]}
        overdueCount={1}
        updateAvailable={false}
        publicDataError={false}
        weatherError={false}
        online
        notificationPermission="default"
        unreadCount={1}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onMarkNotificationRead={vi.fn()}
        onMarkAllNotificationsRead={vi.fn()}
        onRequestNotifications={vi.fn()}
      />,
    );

    expect(html).toContain("Reunião");
    expect(html).toContain("1 tarefa(s) atrasada(s)");
    expect(html).toContain("Ativar alertas locais");
    expect(html).toContain("Abrir central completa");
  });
});
