"use client";

import { CalendarDays, Check, ChevronLeft, ChevronRight, Download, Filter, GripVertical, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import {
  agendaCategoryLabel,
  exportAgendaICS,
  importAgendaICS,
  listOccurrences,
  localDateKey,
  priorityLabel,
  recurrenceLabel,
  useLocalWidgets,
  type AgendaCategory,
  type AgendaEvent,
  type AgendaKind,
  type AgendaOccurrence,
  type AgendaPriority,
  type AgendaRecurrence,
} from "./local-widgets";

const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthLabels = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function keyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function download(filename: string, text: string, type = "text/calendar;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type AgendaDraft = Omit<AgendaEvent, "id" | "completedDates">;

function emptyDraft(today: string): AgendaDraft {
  return {
    title: "",
    date: today,
    time: "09:00",
    kind: "task",
    recurrence: "once",
    category: "personal",
    color: "moss",
    endDate: null,
    repeatDays: [],
    reminderMinutes: 10,
    subtasks: [],
    priority: "normal",
    notes: "",
    skippedDates: [],
  };
}

export function AgendaModule({ onToast }: { onToast: (message: string) => void }) {
  const agenda = useLocalWidgets();
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | AgendaKind>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AgendaCategory>("all");
  const [draft, setDraft] = useState<AgendaDraft>(() => emptyDraft(localDateKey()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<AgendaOccurrence | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const range = useMemo(() => {
    if (view === "week") {
      const start = new Date(cursor);
      start.setHours(12, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: keyFromDate(start), end: keyFromDate(end), days: Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return keyFromDate(date); }) };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { start: keyFromDate(start), end: keyFromDate(end), days: Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return keyFromDate(date); }) };
  }, [cursor, view]);

  const filteredEvents = useMemo(() => agenda.events.filter((event) => {
    const search = query.trim().toLowerCase();
    if (search && !`${event.title} ${event.notes ?? ""} ${agendaCategoryLabel(event.category)}`.toLowerCase().includes(search)) return false;
    if (kindFilter !== "all" && event.kind !== kindFilter) return false;
    if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
    return true;
  }), [agenda.events, categoryFilter, kindFilter, query]);

  const occurrences = useMemo(() => listOccurrences(filteredEvents, range.start, range.end, true), [filteredEvents, range.end, range.start]);
  const byDay = useMemo(() => occurrences.reduce<Record<string, AgendaOccurrence[]>>((map, item) => { (map[item.occurrenceDate] ??= []).push(item); return map; }, {}), [occurrences]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const ok = editingId ? agenda.updateEvent(editingId, draft) : agenda.addEvent(draft);
    if (!ok) return onToast("Revise os dados da agenda.");
    onToast(editingId ? "Série atualizada." : "Item adicionado à agenda.");
    setEditingId(null);
    setDraft(emptyDraft(draft.date));
  };

  const editSeries = (event: AgendaEvent) => {
    setEditingId(event.id);
    setDraft({
      title: event.title,
      date: event.date,
      time: event.time,
      kind: event.kind,
      recurrence: event.recurrence,
      category: event.category,
      color: event.color,
      endDate: event.endDate ?? null,
      repeatDays: event.repeatDays ?? [],
      reminderMinutes: event.reminderMinutes ?? 0,
      subtasks: event.subtasks ?? [],
      priority: event.priority ?? "normal",
      notes: event.notes ?? "",
      skippedDates: event.skippedDates ?? [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editOccurrence = (occurrence: AgendaOccurrence) => {
    const title = window.prompt("Título desta ocorrência", occurrence.title)?.trim();
    if (!title) return;
    const time = window.prompt("Horário (HH:MM)", occurrence.time)?.trim() ?? occurrence.time;
    agenda.moveOccurrence(occurrence.id, occurrence.occurrenceDate, occurrence.occurrenceDate, { title, time });
    setSelectedOccurrence(null);
    onToast("Somente esta ocorrência foi separada e editada.");
  };

  const drop = (date: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/json")) as { id: string; occurrenceDate: string };
      if (agenda.moveOccurrence(payload.id, payload.occurrenceDate, date)) onToast(`Ocorrência movida para ${date}.`);
    } catch {
      onToast("Não foi possível mover o item.");
    }
  };

  const importICS = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.size > 2_000_000) return onToast("O arquivo .ics deve ter até 2 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importAgendaICS(String(reader.result));
      const count = agenda.importEvents(imported);
      onToast(`${count} eventos importados.`);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const moveCursor = (direction: -1 | 1) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setCursor(next);
  };

  const title = view === "month" ? `${monthLabels[cursor.getMonth()]} ${cursor.getFullYear()}` : `${range.start.split("-").reverse().join("/")} — ${range.end.split("-").reverse().join("/")}`;

  return (
    <section className="module-view agenda-module-view">
      <header className="module-heading"><div><span className="eyebrow">AGENDA LOCAL AVANÇADA</span><h1>Planeje sem entregar seus dados.</h1><p>Calendário mensal e semanal, recorrência, subtarefas, lembretes antecipados e arquivos .ics.</p></div><div className="module-actions"><button className="button secondary" onClick={() => download("lumaboard-agenda.ics", exportAgendaICS(agenda.events))}><Download /> Exportar .ics</button><button className="button primary" onClick={() => importRef.current?.click()}><Upload /> Importar .ics</button><input ref={importRef} hidden type="file" accept=".ics,text/calendar" onChange={importICS} /></div></header>

      <div className="agenda-advanced-layout">
        <aside className="panel agenda-editor-panel">
          <span className="eyebrow">{editingId ? "EDITAR TODA A SÉRIE" : "NOVO ITEM"}</span>
          <form onSubmit={submit} className="agenda-advanced-form">
            <label>Título<input value={draft.title} maxLength={240} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: pagar internet" /></label>
            <div className="two-columns"><label>Data inicial<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>Horário<input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label></div>
            <div className="two-columns"><label>Tipo<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AgendaKind })}><option value="task">Tarefa</option><option value="reminder">Lembrete</option></select></label><label>Prioridade<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as AgendaPriority })}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label></div>
            <div className="two-columns"><label>Repetição<select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value as AgendaRecurrence })}><option value="once">Uma vez</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label><label>Até<input type="date" min={draft.date} value={draft.endDate ?? ""} onChange={(event) => setDraft({ ...draft, endDate: event.target.value || null })} disabled={draft.recurrence === "once"} /></label></div>
            {draft.recurrence === "weekly" && <fieldset className="weekday-fieldset"><legend>Dias específicos</legend>{weekLabels.map((label, day) => <label key={label}><input type="checkbox" checked={(draft.repeatDays ?? []).includes(day)} onChange={() => setDraft({ ...draft, repeatDays: (draft.repeatDays ?? []).includes(day) ? (draft.repeatDays ?? []).filter((value) => value !== day) : [...(draft.repeatDays ?? []), day].sort() })} />{label.slice(0, 1)}</label>)}</fieldset>}
            <div className="two-columns"><label>Categoria<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as AgendaCategory })}><option value="personal">Pessoal</option><option value="work">Trabalho</option><option value="health">Saúde</option><option value="finance">Finanças</option><option value="study">Estudos</option><option value="other">Outro</option></select></label><label>Lembrar antes<select value={draft.reminderMinutes} onChange={(event) => setDraft({ ...draft, reminderMinutes: Number(event.target.value) })}><option value="0">Na hora</option><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="1440">1 dia</option><option value="10080">1 semana</option></select></label></div>
            <label>Notas<textarea rows={3} maxLength={4000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            <label>Subtarefas<textarea rows={3} value={(draft.subtasks ?? []).map((item) => item.title).join("\n")} onChange={(event) => setDraft({ ...draft, subtasks: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 50).map((line, index) => ({ id: draft.subtasks?.[index]?.id ?? `sub-${Date.now()}-${index}`, title: line, completed: draft.subtasks?.[index]?.completed ?? false })) })} placeholder="Uma por linha" /></label>
            <button className="button primary full" type="submit"><Plus /> {editingId ? "Salvar série" : "Adicionar"}</button>
            {editingId && <button className="button secondary full" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft(localDateKey())); }}>Cancelar edição</button>}
          </form>
        </aside>

        <div className="agenda-calendar-column">
          <article className="panel agenda-toolbar"><div className="agenda-period"><button className="icon-button" onClick={() => moveCursor(-1)}><ChevronLeft /></button><strong>{title}</strong><button className="icon-button" onClick={() => moveCursor(1)}><ChevronRight /></button><button className="button secondary" onClick={() => setCursor(new Date())}>Hoje</button></div><div className="agenda-view-switch"><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Mês</button><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Semana</button></div></article>
          <article className="panel agenda-filter-bar"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título ou notas" /><Filter /><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | AgendaKind)}><option value="all">Todos os tipos</option><option value="task">Tarefas</option><option value="reminder">Lembretes</option></select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | AgendaCategory)}><option value="all">Todas as categorias</option><option value="personal">Pessoal</option><option value="work">Trabalho</option><option value="health">Saúde</option><option value="finance">Finanças</option><option value="study">Estudos</option><option value="other">Outro</option></select></article>
          <div className={`agenda-calendar-grid ${view}`}>
            {weekLabels.map((label) => <strong className="agenda-week-label" key={label}>{label}</strong>)}
            {range.days.map((date) => {
              const day = Number(date.slice(-2));
              const outside = view === "month" && Number(date.slice(5, 7)) !== cursor.getMonth() + 1;
              return <div className={`agenda-day-cell ${outside ? "outside" : ""} ${date === localDateKey() ? "today" : ""}`} key={date} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(date, event)}><header><span>{day}</span><button onClick={() => setDraft({ ...emptyDraft(date), time: "09:00" })}><Plus /></button></header><div>{(byDay[date] ?? []).slice(0, view === "month" ? 4 : 12).map((item) => <button draggable onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, occurrenceDate: item.occurrenceDate }))} onClick={() => setSelectedOccurrence(item)} className={`agenda-occurrence priority-${item.priority ?? "normal"} event-color-${item.color} ${item.completed ? "completed" : ""}`} key={`${item.id}-${item.occurrenceDate}`}><GripVertical /><span><strong>{item.time} · {item.title}</strong><small>{agendaCategoryLabel(item.category)} · {priorityLabel(item.priority)}</small></span></button>)}</div></div>;
            })}
          </div>
        </div>
      </div>

      {selectedOccurrence && <div className="modal-backdrop" onMouseDown={() => setSelectedOccurrence(null)}><section className="modal agenda-occurrence-modal" onMouseDown={(event) => event.stopPropagation()}><header className="modal-header"><div><span className="eyebrow">OCORRÊNCIA</span><h2>{selectedOccurrence.title}</h2></div><button className="icon-button" onClick={() => setSelectedOccurrence(null)}>×</button></header><div className="occurrence-details"><p><CalendarDays /> {selectedOccurrence.occurrenceDate} às {selectedOccurrence.time}</p><p>{selectedOccurrence.kind === "task" ? "Tarefa" : "Lembrete"} · {agendaCategoryLabel(selectedOccurrence.category)} · {recurrenceLabel(selectedOccurrence.recurrence)}</p>{selectedOccurrence.notes && <p>{selectedOccurrence.notes}</p>}{(selectedOccurrence.subtasks ?? []).map((subtask) => <label key={subtask.id}><input type="checkbox" checked={subtask.completed} onChange={() => agenda.toggleSubtask(selectedOccurrence.id, subtask.id)} /> {subtask.title}</label>)}</div><div className="occurrence-actions"><button className="button primary" onClick={() => { agenda.toggleEventCompleted(selectedOccurrence.id, selectedOccurrence.occurrenceDate); setSelectedOccurrence(null); }}><Check /> {selectedOccurrence.completed ? "Reabrir" : "Concluir"}</button><button className="button secondary" onClick={() => editOccurrence(selectedOccurrence)}><Pencil /> Editar ocorrência</button><button className="button secondary" onClick={() => { const source = agenda.events.find((event) => event.id === selectedOccurrence.id); if (source) editSeries(source); setSelectedOccurrence(null); }}><Pencil /> Editar série</button><button className="button secondary danger" onClick={() => { agenda.removeEvent(selectedOccurrence.id); setSelectedOccurrence(null); }}><Trash2 /> Excluir série</button></div></section></div>}
    </section>
  );
}
