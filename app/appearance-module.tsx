"use client";

import { Check, Download, Image as ImageIcon, LayoutTemplate, Moon, Palette, Plus, Save, Sun, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { readDashboardState, writeDashboardState } from "./dashboard-config";
import { DASHBOARD_TEMPLATES } from "./dashboard-templates";
import { MAX_THEME_IMAGE_BYTES, contrastRatio, useThemeSystem, type ThemeFont, type ThemeProfile } from "./theme-system";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createCustomTheme(base: ThemeProfile): ThemeProfile {
  return { ...base, id: `custom-${Date.now()}`, name: "Meu tema", mode: "custom" };
}

export function AppearanceModule({ onToast }: { onToast: (message: string) => void }) {
  const { state, profile, persist } = useThemeSystem();
  const [selectedId, setSelectedId] = useState(profile.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => state.profiles.find((item) => item.id === selectedId) ?? profile, [profile, selectedId, state.profiles]);

  useEffect(() => setSelectedId(profile.id), [profile.id]);

  const patch = (value: Partial<ThemeProfile>) => {
    const profiles = state.profiles.map((item) => item.id === selected.id ? { ...item, ...value } : item);
    persist({ ...state, profiles, activeThemeId: selected.id });
  };

  const addCustom = () => {
    const custom = createCustomTheme(profile);
    persist({ ...state, profiles: [...state.profiles, custom], activeThemeId: custom.id });
    setSelectedId(custom.id);
    onToast("Tema personalizado criado.");
  };

  const uploadBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_THEME_IMAGE_BYTES) {
      onToast("A imagem deve ter até 700 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ imageData: String(reader.result), backgroundType: "image" });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const importTheme = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.size > 1_000_000) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const candidate = JSON.parse(String(reader.result)) as ThemeProfile;
        const imported = createCustomTheme({ ...profile, ...candidate });
        imported.name = candidate.name ? `${candidate.name} importado` : "Tema importado";
        persist({ ...state, profiles: [...state.profiles, imported], activeThemeId: imported.id });
        setSelectedId(imported.id);
        onToast("Tema importado.");
      } catch {
        onToast("Arquivo de tema inválido.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const applyTemplate = (templateId: string) => {
    const template = DASHBOARD_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    const dashboard = readDashboardState();
    const layout = template.createLayout();
    writeDashboardState({ ...dashboard, layouts: [...dashboard.layouts, layout], settings: { ...dashboard.settings, defaultLayoutId: layout.id } });
    persist({ ...state, layoutThemes: { ...state.layoutThemes, [layout.id]: template.themeId } });
    onToast(`${template.name} adicionado ao Estúdio.`);
  };

  const ratio = contrastRatio(selected.text, selected.background);

  return (
    <section className="module-view appearance-view">
      <header className="module-heading">
        <div><span className="eyebrow">APARÊNCIA E MODELOS</span><h1>Personalize sem depender de conta.</h1><p>Temas globais ou por layout, fundo local, contraste automático e dez modelos prontos.</p></div>
        <div className="module-actions"><button className="button secondary" onClick={() => download(`lumaboard-tema-${selected.id}.json`, JSON.stringify(selected, null, 2))}><Download /> Exportar tema</button><button className="button primary" onClick={addCustom}><Plus /> Novo tema</button></div>
      </header>

      <div className="appearance-grid">
        <aside className="panel theme-list-panel">
          <span className="eyebrow">TEMAS</span>
          {state.profiles.map((theme) => <button key={theme.id} className={theme.id === selected.id ? "active" : ""} onClick={() => { setSelectedId(theme.id); persist({ ...state, activeThemeId: theme.id }); }}><span style={{ background: theme.background }} /><div><strong>{theme.name}</strong><small>{theme.mode}</small></div>{theme.id === state.activeThemeId && <Check />}</button>)}
          <input ref={importRef} type="file" accept="application/json" hidden onChange={importTheme} />
          <button className="button secondary full" onClick={() => importRef.current?.click()}><Upload /> Importar tema</button>
        </aside>

        <article className="panel theme-editor-panel">
          <header><Palette /><div><strong>{selected.name}</strong><span>Contraste {ratio.toFixed(1)}:1 · {ratio >= 4.5 ? "AA aprovado" : "ajuste recomendado"}</span></div></header>
          <div className="theme-form-grid">
            <label>Nome<input value={selected.name} onChange={(event) => patch({ name: event.target.value })} /></label>
            <label>Fonte<select value={selected.font} onChange={(event) => patch({ font: event.target.value as ThemeFont })}><option value="system">Sistema</option><option value="serif">Serifada</option><option value="mono">Monoespaçada</option></select></label>
            <label>Cor principal<input type="color" value={selected.accent} onChange={(event) => patch({ accent: event.target.value })} /></label>
            <label>Fundo<input type="color" value={selected.background} onChange={(event) => patch({ background: event.target.value })} /></label>
            <label>Superfície<input type="color" value={selected.surface} onChange={(event) => patch({ surface: event.target.value })} /></label>
            <label>Texto<input type="color" value={selected.text} onChange={(event) => patch({ text: event.target.value })} /></label>
            <label>Texto secundário<input type="color" value={selected.muted} onChange={(event) => patch({ muted: event.target.value })} /></label>
            <label>Bordas<input type="color" value={selected.border} onChange={(event) => patch({ border: event.target.value })} /></label>
            <label>Tipo de fundo<select value={selected.backgroundType} onChange={(event) => patch({ backgroundType: event.target.value as ThemeProfile["backgroundType"] })}><option value="solid">Cor</option><option value="gradient">Gradiente</option><option value="image">Imagem local</option></select></label>
            <label>Final do gradiente<input type="color" value={selected.gradientEnd} onChange={(event) => patch({ gradientEnd: event.target.value })} /></label>
            <label>Tamanho da interface<input type="range" min="0.85" max="1.35" step="0.05" value={selected.fontScale} onChange={(event) => patch({ fontScale: Number(event.target.value) })} /></label>
            <label className="check-row"><input type="checkbox" checked={selected.autoContrast} onChange={(event) => patch({ autoContrast: event.target.checked })} /> Contraste automático</label>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadBackground} />
          <div className="theme-editor-actions"><button className="button secondary" onClick={() => fileRef.current?.click()}><ImageIcon /> Imagem de fundo</button><button className="button primary" onClick={() => onToast("Tema salvo automaticamente no localStorage.")}><Save /> Salvo automaticamente</button></div>
          <small>Imagens ficam somente neste navegador e são limitadas a 700 KB para proteger a cota do localStorage.</small>
        </article>
      </div>

      <section className="template-gallery-section">
        <header className="section-heading"><div><span className="eyebrow">GALERIA LOCAL</span><h2>Comece com um modelo pronto</h2></div><span className="status-chip"><LayoutTemplate /> 10 MODELOS</span></header>
        <div className="template-gallery-grid">
          {DASHBOARD_TEMPLATES.map((template) => <article className="panel template-card" key={template.id}><span className={`template-preview template-${template.themeId}`}>{template.themeId === "night" || template.themeId === "oled" ? <Moon /> : <Sun />}</span><small>{template.audience}</small><h3>{template.name}</h3><p>{template.description}</p><button className="button secondary full" onClick={() => applyTemplate(template.id)}><Plus /> Adicionar ao Estúdio</button></article>)}
        </div>
      </section>
    </section>
  );
}
