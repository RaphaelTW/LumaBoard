"use client";

import { Check, Copy, Download, Eye, Heart, Image as ImageIcon, LayoutTemplate, Palette, Plus, RotateCcw, Save, Search, Smartphone, Sparkles, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { readDashboardState, writeDashboardState } from "./dashboard-config";
import { DASHBOARD_TEMPLATES, findTemplates, templateCategories, type DashboardTemplate, type TemplateCategory } from "./dashboard-templates";
import { safeParseJSON, writeStoredValue } from "./storage";
import { readSafeJsonFile } from "./import-security";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, MAX_THEME_IMAGE_BYTES, contrastRatio, createThemeBundle, parseThemeBundle, useThemeSystem, type ThemeDensity, type ThemeFont, type ThemeProfile } from "./theme-system";

const FAVORITES_KEY = "lumaboard-template-favorites-v1";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createCustomTheme(base: ThemeProfile, name = "Meu tema"): ThemeProfile {
  return { ...base, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, mode: "custom" };
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = safeParseJSON(window.localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function TemplatePreview({ template }: { template: DashboardTemplate }) {
  const widgets = template.createLayout().widgets.slice(0, 6);
  return (
    <div className="template-live-preview" style={{ background: `linear-gradient(135deg, ${template.palette[0]}, ${template.palette[2]})`, color: template.themeId === "paper" || template.themeId === "eink" || template.themeId === "lavender" ? "#151713" : "#ffffff" }}>
      <span className="template-preview-brand"><Sparkles /> LumaBoard</span>
      <div className="template-preview-widgets">
        {widgets.map((widget) => <span key={widget.id} style={{ borderColor: template.palette[1] }}>{widget.title}</span>)}
      </div>
    </div>
  );
}

export function AppearanceModule({
  onToast,
  avatarInitials,
  onAvatarInitialsChange,
}: {
  onToast: (message: string) => void;
  avatarInitials: string;
  onAvatarInitialsChange: (value: string) => void;
}) {
  const { state, profile, persist } = useThemeSystem();
  const [section, setSection] = useState<"themes" | "templates">("themes");
  const [profileInitials, setProfileInitials] = useState(avatarInitials);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | TemplateCategory>("all");
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [previewTemplate, setPreviewTemplate] = useState<DashboardTemplate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const selected = profile;
  const dashboard = readDashboardState();
  const templates = useMemo(() => findTemplates(query, category, favorites), [category, favorites, query]);

  const patch = (value: Partial<ThemeProfile>) => {
    const profiles = state.profiles.map((item) => item.id === selected.id ? { ...item, ...value } : item);
    persist({ ...state, profiles, activeThemeId: selected.id });
  };

  const addCustom = () => {
    const custom = createCustomTheme(profile);
    persist({ ...state, profiles: [...state.profiles, custom], activeThemeId: custom.id });
    onToast("Tema personalizado criado.");
  };

  const duplicateTheme = () => {
    const custom = createCustomTheme(selected, `${selected.name} — cópia`);
    persist({ ...state, profiles: [...state.profiles, custom], activeThemeId: custom.id });
    onToast("Tema duplicado.");
  };

  const deleteTheme = () => {
    if (BUILTIN_THEME_IDS.has(selected.id)) {
      onToast("Temas oficiais não podem ser excluídos.");
      return;
    }
    const profiles = state.profiles.filter((theme) => theme.id !== selected.id);
    const layoutThemes = Object.fromEntries(Object.entries(state.layoutThemes).filter(([, themeId]) => themeId !== selected.id));
    persist({ ...state, profiles, layoutThemes, activeThemeId: "paper" });
    onToast("Tema removido.");
  };

  const resetTheme = () => {
    const builtin = BUILTIN_THEMES.find((theme) => theme.id === selected.id);
    if (!builtin) {
      onToast("Use duplicar para preservar uma variação antes de editar.");
      return;
    }
    persist({ ...state, profiles: state.profiles.map((theme) => theme.id === builtin.id ? { ...builtin } : theme) });
    onToast("Tema oficial restaurado.");
  };

  const uploadBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > MAX_THEME_IMAGE_BYTES) {
      event.target.value = "";
      onToast("Use PNG, JPEG ou WebP com até 700 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!/^data:image\/(?:png|jpeg|webp);base64,/.test(result)) {
        onToast("A imagem selecionada não é válida.");
        return;
      }
      patch({ imageData: result, backgroundType: "image" });
    };
    reader.onerror = () => onToast("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const importTheme = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.size > 4_000_000) return;
    void readSafeJsonFile(file, { maxBytes: 4_000_000, maxArrayItems: 128 }).then((payload) => {
      const imported = parseThemeBundle(payload);
      if (imported.length === 0) throw new Error("empty");
      persist({ ...state, profiles: [...state.profiles, ...imported], activeThemeId: imported[0].id });
      onToast(`${imported.length} tema(s) importado(s).`);
    }).catch(() => onToast("Arquivo de tema inválido."));
    event.target.value = "";
  };

  const applyTemplate = (templateId: string) => {
    const template = DASHBOARD_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const current = readDashboardState();
    const layout = template.createLayout();
    writeDashboardState({ ...current, layouts: [...current.layouts, layout], settings: { ...current.settings, defaultLayoutId: layout.id } });
    persist({ ...state, layoutThemes: { ...state.layoutThemes, [layout.id]: template.themeId } });
    setPreviewTemplate(null);
    onToast(`${template.name} adicionado ao Estúdio.`);
  };

  const toggleFavorite = (templateId: string) => {
    const next = favorites.includes(templateId) ? favorites.filter((id) => id !== templateId) : [...favorites, templateId];
    setFavorites(next);
    writeStoredValue(FAVORITES_KEY, next);
  };

  const ratioBackground = contrastRatio(selected.text, selected.background);
  const ratioSurface = contrastRatio(selected.text, selected.surface);

  return (
    <section className="module-view appearance-view">
      <header className="module-heading">
        <div><span className="eyebrow">APARÊNCIA E MODELOS</span><h1>Uma identidade para cada tela.</h1><p>Oito temas oficiais, editor avançado, temas por layout e dezesseis modelos locais prontos.</p></div>
        <div className="module-actions"><button className="button secondary" onClick={() => download("lumaboard-temas.json", JSON.stringify(createThemeBundle(state.profiles), null, 2))}><Download /> Exportar coleção</button><button className="button primary" onClick={addCustom}><Plus /> Novo tema</button></div>
      </header>

      <nav className="appearance-tabs" aria-label="Aparência"><button className={section === "themes" ? "active" : ""} onClick={() => setSection("themes")}><Palette /> Temas</button><button className={section === "templates" ? "active" : ""} onClick={() => setSection("templates")}><LayoutTemplate /> Galeria de modelos</button></nav>

      <section className="panel profile-settings-panel">
        <div>
          <span className="eyebrow">PERFIL LOCAL</span>
          <h2>Avatar do cabeçalho</h2>
          <p>As iniciais ficam salvas apenas neste navegador e entram no backup local.</p>
        </div>
        <label>
          Iniciais
          <input
            maxLength={3}
            value={profileInitials}
            onChange={(event) => setProfileInitials(event.target.value.toUpperCase())}
            onBlur={() => onAvatarInitialsChange(profileInitials)}
          />
        </label>
        <button className="avatar profile-preview-avatar" onClick={() => onAvatarInitialsChange(profileInitials)} aria-label="Salvar iniciais do perfil">
          {profileInitials || "EU"}
        </button>
      </section>

      {section === "themes" ? <>
        <div className="appearance-grid">
          <aside className="panel theme-list-panel">
            <div className="theme-list-heading"><span className="eyebrow">TEMAS</span><small>{state.profiles.length} disponíveis</small></div>
            {state.profiles.map((theme) => <button key={theme.id} className={theme.id === selected.id ? "active" : ""} onClick={() => persist({ ...state, activeThemeId: theme.id })}><span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${theme.background}, ${theme.accent})` }} /><div><strong>{theme.name}</strong><small>{BUILTIN_THEME_IDS.has(theme.id) ? "oficial" : "personalizado"}</small></div>{theme.id === state.activeThemeId && <Check />}</button>)}
            <input ref={importRef} type="file" accept="application/json" hidden onChange={importTheme} />
            <button className="button secondary full" onClick={() => importRef.current?.click()}><Upload /> Importar tema ou coleção</button>
          </aside>

          <article className="panel theme-editor-panel">
            <header><Palette /><div><strong>{selected.name}</strong><span>Fundo {ratioBackground.toFixed(1)}:1 · superfície {ratioSurface.toFixed(1)}:1</span></div><div className="theme-header-actions"><button title="Duplicar" onClick={duplicateTheme}><Copy /></button><button title="Restaurar" onClick={resetTheme}><RotateCcw /></button><button title="Excluir" onClick={deleteTheme}><Trash2 /></button></div></header>
            <div className="theme-stage" style={{ background: selected.backgroundType === "gradient" ? `linear-gradient(145deg, ${selected.background}, ${selected.gradientEnd})` : selected.background, color: selected.text, borderRadius: selected.radius }}>
              <span style={{ background: selected.accent, color: contrastRatio("#ffffff", selected.accent) > 4.5 ? "#ffffff" : "#111111" }}>LumaBoard</span>
              <article style={{ background: selected.surface, borderColor: selected.border, borderRadius: selected.radius, boxShadow: `0 14px 36px rgba(0,0,0,${selected.shadowStrength * 0.18})` }}><small style={{ color: selected.muted }}>PRÉ-VISUALIZAÇÃO</small><strong>Seu tema em tempo real</strong><p style={{ color: selected.muted }}>Cores, densidade, cantos e tipografia são aplicados em todo o painel.</p></article>
            </div>
            <div className="theme-form-grid">
              <label>Nome<input value={selected.name} onChange={(event) => patch({ name: event.target.value })} /></label>
              <label>Fonte<select value={selected.font} onChange={(event) => patch({ font: event.target.value as ThemeFont })}><option value="system">Sistema</option><option value="serif">Serifada</option><option value="mono">Monoespaçada</option></select></label>
              <label>Densidade<select value={selected.density} onChange={(event) => patch({ density: event.target.value as ThemeDensity })}><option value="compact">Compacta</option><option value="comfortable">Confortável</option><option value="spacious">Espaçosa</option></select></label>
              <label>Cor principal<input type="color" value={selected.accent} onChange={(event) => patch({ accent: event.target.value })} /></label>
              <label>Fundo<input type="color" value={selected.background} onChange={(event) => patch({ background: event.target.value })} /></label>
              <label>Superfície<input type="color" value={selected.surface} onChange={(event) => patch({ surface: event.target.value })} /></label>
              <label>Texto<input type="color" value={selected.text} onChange={(event) => patch({ text: event.target.value })} /></label>
              <label>Texto secundário<input type="color" value={selected.muted} onChange={(event) => patch({ muted: event.target.value })} /></label>
              <label>Bordas<input type="color" value={selected.border} onChange={(event) => patch({ border: event.target.value })} /></label>
              <label>Tipo de fundo<select value={selected.backgroundType} onChange={(event) => patch({ backgroundType: event.target.value as ThemeProfile["backgroundType"] })}><option value="solid">Cor</option><option value="gradient">Gradiente</option><option value="image">Imagem local</option></select></label>
              <label>Final do gradiente<input type="color" value={selected.gradientEnd} onChange={(event) => patch({ gradientEnd: event.target.value })} /></label>
              <label>Tamanho da interface <output>{Math.round(selected.fontScale * 100)}%</output><input type="range" min="0.85" max="1.35" step="0.05" value={selected.fontScale} onChange={(event) => patch({ fontScale: Number(event.target.value) })} /></label>
              <label>Arredondamento <output>{selected.radius}px</output><input type="range" min="0" max="24" step="1" value={selected.radius} onChange={(event) => patch({ radius: Number(event.target.value) })} /></label>
              <label>Sombras <output>{Math.round(selected.shadowStrength * 100)}%</output><input type="range" min="0" max="1" step="0.05" value={selected.shadowStrength} onChange={(event) => patch({ shadowStrength: Number(event.target.value) })} /></label>
              <label className="check-row"><input type="checkbox" checked={selected.autoContrast} onChange={(event) => patch({ autoContrast: event.target.checked })} /> Contraste automático</label>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadBackground} />
            <div className="theme-editor-actions"><button className="button secondary" onClick={() => fileRef.current?.click()}><ImageIcon /> Imagem de fundo</button><button className="button secondary" onClick={() => download(`lumaboard-tema-${selected.id}.json`, JSON.stringify(selected, null, 2))}><Download /> Exportar tema</button><button className="button primary" onClick={() => onToast("Tema salvo automaticamente no localStorage.")}><Save /> Salvo automaticamente</button></div>
            <small>Imagens ficam somente neste navegador e são limitadas a 700 KB para proteger o localStorage.</small>
          </article>
        </div>

        <section className="panel layout-theme-panel">
          <header><div><span className="eyebrow">TEMAS POR LAYOUT</span><h2>Cada tela com uma identidade</h2></div><Smartphone /></header>
          <div className="layout-theme-grid">{dashboard.layouts.map((layout) => <label key={layout.id}><span><strong>{layout.name}</strong><small>{layout.widgets.length} widgets</small></span><select value={state.layoutThemes[layout.id] ?? "global"} onChange={(event) => { const next = { ...state.layoutThemes }; if (event.target.value === "global") delete next[layout.id]; else next[layout.id] = event.target.value; persist({ ...state, layoutThemes: next }); }}><option value="global">Usar tema global</option>{state.profiles.map((theme) => <option value={theme.id} key={theme.id}>{theme.name}</option>)}</select></label>)}</div>
        </section>
      </> : <section className="template-gallery-section">
        <header className="section-heading"><div><span className="eyebrow">GALERIA LOCAL</span><h2>Comece com uma composição pronta</h2><p>Todos os modelos ficam no próprio projeto e funcionam sem conta ou internet.</p></div><span className="status-chip"><LayoutTemplate /> {DASHBOARD_TEMPLATES.length} MODELOS</span></header>
        <div className="template-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, uso ou widget" /></label><div><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todos</button>{templateCategories().map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
        <div className="template-gallery-grid template-gallery-v2">
          {templates.map((template) => <article className="panel template-card template-card-v2" key={template.id}><button className={`template-favorite ${favorites.includes(template.id) ? "active" : ""}`} onClick={() => toggleFavorite(template.id)} aria-label="Favoritar modelo"><Heart /></button><TemplatePreview template={template} /><div className="template-meta"><span>{template.audience}</span><span>{template.device}</span>{template.featured && <span>destaque</span>}</div><h3>{template.name}</h3><p>{template.description}</p><div className="template-tags">{template.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="template-actions"><button className="button secondary" onClick={() => setPreviewTemplate(template)}><Eye /> Visualizar</button><button className="button primary" onClick={() => applyTemplate(template.id)}><Plus /> Adicionar</button></div></article>)}
        </div>
        {templates.length === 0 && <div className="panel template-empty"><Search /><strong>Nenhum modelo encontrado</strong><p>Tente outro termo ou categoria.</p></div>}
      </section>}

      {previewTemplate && <div className="template-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewTemplate(null); }}><section className="panel template-modal" role="dialog" aria-modal="true" aria-label={`Visualizar ${previewTemplate.name}`}><header><div><span className="eyebrow">PRÉ-VISUALIZAÇÃO</span><h2>{previewTemplate.name}</h2></div><button onClick={() => setPreviewTemplate(null)} aria-label="Fechar">×</button></header><TemplatePreview template={previewTemplate} /><p>{previewTemplate.description}</p><div className="template-modal-details"><span>{previewTemplate.device}</span><span>{previewTemplate.createLayout().columns} colunas</span><span>{previewTemplate.createLayout().widgets.length} widgets</span><span>Tema {previewTemplate.themeId}</span></div><footer><button className="button secondary" onClick={() => setPreviewTemplate(null)}>Voltar</button><button className="button primary" onClick={() => applyTemplate(previewTemplate.id)}><Plus /> Adicionar ao Estúdio</button></footer></section></div>}
    </section>
  );
}
