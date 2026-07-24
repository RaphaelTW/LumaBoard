"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Filter,
  GripVertical,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
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
const reminderOptions = [
  { value: 0, label: "Na hora" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 1440, label: "1 dia" },
  { value: 10080, label: "1 semana" },
];

type AgendaView = "month" | "week" | "day" | "list";
type AgendaStatusFilter = "all" | "open" | "completed" | "overdue";
type AgendaDraft = Omit<AgendaEvent, "id" | "completedDates">;

function keyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "short" }) {
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(`${dateKey}T12:00:00`));
}

function formatReminder(minutes: number) {
  if (minutes === 0) return "na hora";
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} dia(s) antes`;
  if (minutes >= 60) return `${Math.round(minutes / 60)} hora(s) antes`;
  return `${minutes} min antes`;
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
    reminderMinutesList: [10],
    durationMinutes: 30,
    location: "",
    subtasks: [],
    priority: "normal",
    notes: "",
    skippedDates: [],
  };
}

function occurrenceKey(item: AgendaOccurrence) {
  return `${item.id}-${item.occurrenceDate}`;
}

function isOccurrenceOverdue(item: AgendaOccurrence, now = new Date()) {
  return item.kind === "task" && !item.completed && new Date(`${item.occurrenceDate}T${item.time}:00`).getTime() < now.getTime();
}

export function AgendaModule({ onToast }: { onToast: (message: string) => void }) {
  const agenda = useLocalWidgets();
  const [view, setView] = useState<AgendaView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | AgendaKind>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AgendaCategory>("all");
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>("all");
  const [draft, setDraft] = useState<AgendaDraft>(() => emptyDraft(localDateKey()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<AgendaOccurrence | null>(null);
  const [moveDate, setMoveDate] = useState(localDateKey());
  const importRef = useRef<HTMLInputElement>(null);

  const range = useMemo(() => {
    if (view === "day") {
      const day = keyFromDate(cursor);
      return { start: day, end: day, days: [day] };
    }
    if (view === "list") {
      const start = keyFromDate(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + 89);
      return { start, end: keyFromDate(end), days: [] as string[] };
    }
    if (view === "week") {
      const start = new Date(cursor);
      start.setHours(12, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        start: keyFromDate(start),
        end: keyFromDate(end),
        days: Array.from({ length: 7 }, (_, index) => {
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          return keyFromDate(date);
        }),
      };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return {
      start: keyFromDate(start),
      end: keyFromDate(end),
      days: Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return keyFromDate(date);
      }),
    };
  }, [cursor, view]);

  const filteredEvents = useMemo(() => agenda.events.filter((event) => {
    const search = query.trim().toLowerCase();
    if (search && !`${event.title} ${event.notes ?? ""} ${event.location ?? ""} ${agendaCategoryLabel(event.category)}`.toLowerCase().includes(search)) return false;
    if (kindFilter !== "all" && event.kind !== kindFilter) return false;
    if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
    return true;
  }), [agenda.events, categoryFilter, kindFilter, query]);

  const occurrences = useMemo(() => {
    const now = new Date();
    return listOccurrences(filteredEvents, range.start, range.end, true).filter((item) => {
      if (statusFilter === "open") return !item.completed;
      if (statusFilter === "completed") return item.completed;
      if (statusFilter === "overdue") return isOccurrenceOverdue(item, now);
      return true;
    });
  }, [filteredEvents, range.end, range.start, statusFilter]);

  const byDay = useMemo(() => occurrences.reduce<Record<string, AgendaOccurrence[]>>((map, item) => {
    (map[item.occurrenceDate] ??= []).push(item);
    return map;
  }, {}), [occurrences]);

  const groupedList = useMemo(() => Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)), [byDay]);
  const todayOpen = agenda.todayEvents.filter((item) => !item.completed).length;
  const highPriority = agenda.upcomingEvents.filter((item) => item.priority === "high").slice(0, 30).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const reminders = draft.reminderMinutesList?.length ? draft.reminderMinutesList : [draft.reminderMinutes ?? 0];
    const payload = { ...draft, reminderMinutesList: reminders, reminderMinutes: reminders.at(-1) ?? 0 };
    const ok = editingId ? agenda.updateEvent(editingId, payload) : agenda.addEvent(payload);
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
      reminderMinutesList: event.reminderMinutesList ?? [event.reminderMinutes ?? 0],
      durationMinutes: event.durationMinutes ?? 30,
      location: event.location ?? "",
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

  const editFollowing = (occurrence: AgendaOccurrence) => {
    const title = window.prompt("Título desta e das próximas ocorrências", occurrence.title)?.trim();
    if (!title) return;
    const time = window.prompt("Novo horário (HH:MM)", occurrence.time)?.trim() ?? occurrence.time;
    if (agenda.updateFollowingOccurrences(occurrence.id, occurrence.occurrenceDate, { title, time })) {
      setSelectedOccurrence(null);
      onToast("Esta ocorrência e as próximas foram atualizadas.");
    }
  };

  const drop = (date: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/json")) as { id: string; occurrenceDate: string };
      if (agenda.moveOccurrence(payload.id, payload.occurrenceDate, date)) onToast(`Ocorrência movida para ${formatDate(date)}.`);
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
      onToast(`${count} eventos importados com duração, local e alertas compatíveis.`);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const moveCursor = (direction: -1 | 1) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + direction);
    else if (view === "week") next.setDate(next.getDate() + direction * 7);
    else if (view === "day") next.setDate(next.getDate() + direction);
    else next.setDate(next.getDate() + direction * 90);
    setCursor(next);
  };

  const title = view === "month"
    ? `${monthLabels[cursor.getMonth()]} ${cursor.getFullYear()}`
    : view === "week"
      ? `${formatDate(range.start)} — ${formatDate(range.end)}`
      : view === "day"
        ? formatDate(range.start, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
        : `Próximos 90 dias a partir de ${formatDate(range.start)}`;

  const selectOccurrence = (item: AgendaOccurrence) => {
    setSelectedOccurrence(item);
    setMoveDate(item.occurrenceDate);
    agenda.markOccurrenceNotificationsRead(item.id, item.occurrenceDate);
  };

  const renderOccurrence = (item: AgendaOccurrence, compact = true) => (
    <button
      draggable
      onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, occurrenceDate: item.occurrenceDate }))}
      onClick={() => selectOccurrence(item)}
      className={`agenda-occurrence priority-${item.priority ?? "normal"} event-color-${item.color} ${item.completed ? "completed" : ""} ${isOccurrenceOverdue(item) ? "overdue" : ""}`}
      key={occurrenceKey(item)}
    >
      <GripVertical />
      <span>
        <strong>{item.time} · {item.title}</strong>
        <small>{compact ? `${agendaCategoryLabel(item.category)} · ${priorityLabel(item.priority)}` : `${item.kind === "task" ? "Tarefa" : "Lembrete"} · ${agendaCategoryLabel(item.category)} · ${item.durationMinutes ?? 30} min`}</small>
      </span>
    </button>
  );

  return (
    <section className="module-view agenda-module-view">
      <header className="module-heading">
        <div>
          <span className="eyebrow">CALENDAR & NOTIFICATIONS</span>
          <h1>Seu tempo, organizado localmente.</h1>
          <p>Quatro visualizações, séries editáveis, múltiplos alertas, adiamento, histórico e arquivos .ics mais completos.</p>
        </div>
        <div className="module-actions">
          <button className="button secondary" onClick={() => download("lumaboard-agenda.ics", exportAgendaICS(agenda.events))}><Download /> Exportar .ics</button>
          <button className="button primary" onClick={() => importRef.current?.click()}><Upload /> Importar .ics</button>
          <input ref={importRef} hidden type="file" accept=".ics,text/calendar" onChange={importICS} />
        </div>
      </header>

      <section className="agenda-summary-grid" aria-label="Resumo da agenda">
        <article className="panel"><CalendarDays /><div><strong>{todayOpen}</strong><span>itens abertos hoje</span></div></article>
        <article className="panel warning"><Bell /><div><strong>{agenda.overdueTasks.length}</strong><span>tarefas atrasadas</span></div></article>
        <article className="panel"><Check /><div><strong>{agenda.completedThisWeek}</strong><span>concluídos em 7 dias</span></div></article>
        <article className="panel"><Clock /><div><strong>{highPriority}</strong><span>prioridades altas próximas</span></div></article>
      </section>

      <div className="agenda-advanced-layout">
        <aside className="panel agenda-editor-panel">
          <span className="eyebrow">{editingId ? "EDITAR TODA A SÉRIE" : "NOVO ITEM"}</span>
          <form onSubmit={submit} className="agenda-advanced-form">
            <label>Título<input value={draft.title} maxLength={240} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: pagar internet" /></label>
            <div className="two-columns"><label>Data inicial<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>Horário<input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label></div>
            <div className="two-columns"><label>Tipo<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AgendaKind })}><option value="task">Tarefa</option><option value="reminder">Lembrete</option></select></label><label>Prioridade<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as AgendaPriority })}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label></div>
            <div className="two-columns"><label>Repetição<select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value as AgendaRecurrence })}><option value="once">Uma vez</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label><label>Até<input type="date" min={draft.date} value={draft.endDate ?? ""} onChange={(event) => setDraft({ ...draft, endDate: event.target.value || null })} disabled={draft.recurrence === "once"} /></label></div>
            {draft.recurrence === "weekly" && <fieldset className="weekday-fieldset"><legend>Dias específicos</legend>{weekLabels.map((label, day) => <label key={label}><input type="checkbox" checked={(draft.repeatDays ?? []).includes(day)} onChange={() => setDraft({ ...draft, repeatDays: (draft.repeatDays ?? []).includes(day) ? (draft.repeatDays ?? []).filter((value) => value !== day) : [...(draft.repeatDays ?? []), day].sort() })} />{label.slice(0, 1)}</label>)}</fieldset>}
            <div className="two-columns"><label>Categoria<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as AgendaCategory })}><option value="personal">Pessoal</option><option value="work">Trabalho</option><option value="health">Saúde</option><option value="finance">Finanças</option><option value="study">Estudos</option><option value="other">Outro</option></select></label><label>Cor<select value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value as AgendaEvent["color"] })}><option value="moss">Verde</option><option value="amber">Âmbar</option><option value="cyan">Azul</option><option value="rose">Rosa</option><option value="slate">Cinza</option></select></label></div>
            <div className="two-columns"><label>Duração<select value={draft.durationMinutes ?? 30} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })}><option value="0">Sem duração</option><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option><option value="1440">Dia inteiro</option></select></label><label>Local<input value={draft.location ?? ""} maxLength={300} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Casa, escola, sala…" /></label></div>
            <fieldset className="reminder-fieldset"><legend>Múltiplos alertas</legend>{reminderOptions.map((option) => <label key={option.value}><input type="checkbox" checked={(draft.reminderMinutesList ?? []).includes(option.value)} onChange={() => { const current = draft.reminderMinutesList ?? []; const next = current.includes(option.value) ? current.filter((value) => value !== option.value) : [...current, option.value].sort((a, b) => b - a).slice(0, 5); setDraft({ ...draft, reminderMinutesList: next, reminderMinutes: next.at(-1) ?? 0 }); }} />{option.label}</label>)}</fieldset>
            <label>Notas<textarea rows={3} maxLength={4000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            <label>Subtarefas<textarea rows={3} value={(draft.subtasks ?? []).map((item) => item.title).join("\n")} onChange={(event) => setDraft({ ...draft, subtasks: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 50).map((line, index) => ({ id: draft.subtasks?.[index]?.id ?? `sub-${Date.now()}-${index}`, title: line, completed: draft.subtasks?.[index]?.completed ?? false })) })} placeholder="Uma por linha" /></label>
            <button className="button primary full" type="submit"><Plus /> {editingId ? "Salvar série" : "Adicionar"}</button>
            {editingId && <button className="button secondary full" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft(localDateKey())); }}>Cancelar edição</button>}
          </form>
        </aside>

        <div className="agenda-calendar-column">
          <article className="panel agenda-toolbar">
            <div className="agenda-period"><button className="icon-button" onClick={() => moveCursor(-1)}><ChevronLeft /></button><strong>{title}</strong><button className="icon-button" onClick={() => moveCursor(1)}><ChevronRight /></button><button className="button secondary" onClick={() => setCursor(new Date())}>Hoje</button></div>
            <div className="agenda-view-switch"><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Mês</button><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Semana</button><button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>Dia</button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List /> Lista</button></div>
          </article>
          <article className="panel agenda-filter-bar"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar título, notas ou local" /><Filter /><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | AgendaKind)}><option value="all">Todos os tipos</option><option value="task">Tarefas</option><option value="reminder">Lembretes</option></select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | AgendaCategory)}><option value="all">Todas as categorias</option><option value="personal">Pessoal</option><option value="work">Trabalho</option><option value="health">Saúde</option><option value="finance">Finanças</option><option value="study">Estudos</option><option value="other">Outro</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AgendaStatusFilter)}><option value="all">Todos os estados</option><option value="open">Abertos</option><option value="completed">Concluídos</option><option value="overdue">Atrasados</option></select></article>

          {(view === "month" || view === "week") && <div className={`agenda-calendar-grid ${view}`}>
            {weekLabels.map((label) => <strong className="agenda-week-label" key={label}>{label}</strong>)}
            {range.days.map((date) => {
              const day = Number(date.slice(-2));
              const outside = view === "month" && Number(date.slice(5, 7)) !== cursor.getMonth() + 1;
              return <div className={`agenda-day-cell ${outside ? "outside" : ""} ${date === localDateKey() ? "today" : ""}`} key={date} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(date, event)}><header><span>{day}</span><button onClick={() => setDraft({ ...emptyDraft(date), time: "09:00" })}><Plus /></button></header><div>{(byDay[date] ?? []).slice(0, view === "month" ? 4 : 20).map((item) => renderOccurrence(item))}</div></div>;
            })}
          </div>}

          {view === "day" && <section className="panel agenda-day-timeline"><header><div><span className="eyebrow">AGENDA DO DIA</span><strong>{formatDate(range.start, { weekday: "long", day: "2-digit", month: "long" })}</strong></div><button className="button primary" onClick={() => setDraft(emptyDraft(range.start))}><Plus /> Novo item</button></header><div>{(byDay[range.start] ?? []).length === 0 && <p className="agenda-empty-state">Nenhum item para este dia.</p>}{(byDay[range.start] ?? []).map((item) => <article className={`agenda-timeline-item event-color-${item.color}`} key={occurrenceKey(item)}><time>{item.time}</time><div><strong>{item.title}</strong><span>{item.durationMinutes ?? 30} min · {agendaCategoryLabel(item.category)}{item.location ? ` · ${item.location}` : ""}</span></div>{renderOccurrence(item, false)}</article>)}</div></section>}

          {view === "list" && <section className="agenda-list-view">{groupedList.length === 0 && <article className="panel agenda-empty-state">Nenhum item encontrado nos próximos 90 dias.</article>}{groupedList.map(([date, items]) => <article className="panel agenda-list-day" key={date}><header><strong>{formatDate(date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</strong><span>{items.length} item(ns)</span></header><div>{items.map((item) => renderOccurrence(item, false))}</div></article>)}</section>}
        </div>
      </div>

      {selectedOccurrence && <div className="modal-backdrop" onMouseDown={() => setSelectedOccurrence(null)}><section className="modal agenda-occurrence-modal" onMouseDown={(event) => event.stopPropagation()}><header className="modal-header"><div><span className="eyebrow">OCORRÊNCIA</span><h2>{selectedOccurrence.title}</h2></div><button className="icon-button" onClick={() => setSelectedOccurrence(null)}>×</button></header><div className="occurrence-details"><p><CalendarDays /> {formatDate(selectedOccurrence.occurrenceDate, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} às {selectedOccurrence.time}</p><p><Clock /> {selectedOccurrence.durationMinutes ?? 30} minutos · {selectedOccurrence.kind === "task" ? "Tarefa" : "Lembrete"} · {agendaCategoryLabel(selectedOccurrence.category)} · {recurrenceLabel(selectedOccurrence.recurrence)}</p>{selectedOccurrence.location && <p><MapPin /> {selectedOccurrence.location}</p>}<p><Bell /> {(selectedOccurrence.reminderMinutesList ?? [selectedOccurrence.reminderMinutes ?? 0]).map(formatReminder).join(" · ")}</p>{selectedOccurrence.notes && <p>{selectedOccurrence.notes}</p>}{(selectedOccurrence.subtasks ?? []).map((subtask) => <label key={subtask.id}><input type="checkbox" checked={subtask.completed} onChange={() => agenda.toggleSubtask(selectedOccurrence.id, subtask.id)} /> {subtask.title}</label>)}</div><div className="occurrence-reschedule"><label>Mover para<input type="date" value={moveDate} onChange={(event) => setMoveDate(event.target.value)} /></label><button className="button secondary" onClick={() => { if (agenda.moveOccurrence(selectedOccurrence.id, selectedOccurrence.occurrenceDate, moveDate)) { onToast("Ocorrência reagendada."); setSelectedOccurrence(null); } }}>Reagendar</button></div><div className="occurrence-actions"><button className="button primary" onClick={() => { agenda.toggleEventCompleted(selectedOccurrence.id, selectedOccurrence.occurrenceDate); setSelectedOccurrence(null); }}><Check /> {selectedOccurrence.completed ? "Reabrir" : "Concluir"}</button><button className="button secondary" onClick={() => { agenda.snoozeOccurrence(selectedOccurrence.id, selectedOccurrence.occurrenceDate, agenda.notificationSettings.defaultSnoozeMinutes); onToast(`Lembrete adiado por ${agenda.notificationSettings.defaultSnoozeMinutes} minutos.`); setSelectedOccurrence(null); }}><Bell /> Adiar</button><button className="button secondary" onClick={() => editOccurrence(selectedOccurrence)}><Pencil /> Só esta</button>{selectedOccurrence.recurrence !== "once" && <button className="button secondary" onClick={() => editFollowing(selectedOccurrence)}><Pencil /> Esta e próximas</button>}<button className="button secondary" onClick={() => { const source = agenda.events.find((event) => event.id === selectedOccurrence.id); if (source) editSeries(source); setSelectedOccurrence(null); }}><Pencil /> Toda a série</button><button className="button secondary" onClick={() => { agenda.duplicateEvent(selectedOccurrence.id, selectedOccurrence.occurrenceDate); onToast("Item duplicado."); setSelectedOccurrence(null); }}><Copy /> Duplicar</button><button className="button secondary danger" onClick={() => { agenda.skipOccurrence(selectedOccurrence.id, selectedOccurrence.occurrenceDate); setSelectedOccurrence(null); onToast(selectedOccurrence.recurrence === "once" ? "Item excluído." : "Somente esta ocorrência foi excluída."); }}><Trash2 /> Excluir ocorrência</button><button className="button secondary danger" onClick={() => { if (window.confirm("Excluir toda a série?")) { agenda.removeEvent(selectedOccurrence.id); setSelectedOccurrence(null); } }}><Trash2 /> Excluir série</button></div></section></div>}
    </section>
  );
}
