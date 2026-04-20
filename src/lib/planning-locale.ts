// Lightweight i18n for the Planning calendar — EN / NL / ES only

export type PlanningLang = "en" | "nl" | "es";

export interface PlanningStrings {
  // Navigation
  planning: string;
  thisWeek: string;
  today: string;
  week: string;
  day: string;
  print: string;
  language: string;
  filter: string;
  allStaff: string;

  // Days (Mon–Sun)
  days: [string, string, string, string, string, string, string];
  daysShort: [string, string, string, string, string, string, string];

  // Months
  months: [string, string, string, string, string, string, string, string, string, string, string, string];

  // Time
  hours: string; // e.g. "h", "u", "h"

  // Actions
  addRepair: string;
  searchRepairs: string;
  noResults: string;
  schedule: string;
  unschedule: string;
  dragToMove: string;

  // Info
  noRepairsScheduled: string;
  unscheduled: string;
  scheduled: string;
  searching: string;
  customer: string;
  location: string;
  priority: string;
  status: string;
  assignedTo: string;

  /** Short page purpose (shown under title) */
  pageSubtitle: string;
  /** Per-day empty body (below title row) */
  emptyDayHint: string;
  /** Week strip when count > 0; use {n} for number */
  weekRepairsSome: string;
  /** Week strip when nothing scheduled */
  weekRepairsNone: string;
  /** Hint under toolbar on md+ */
  dragHint: string;
  /** Link to work orders list */
  browseWorkOrders: string;
  /** Toast when scheduling is blocked because the work order has no tasks */
  scheduleNeedsTasks: string;
}

const en: PlanningStrings = {
  planning: "Planning",
  thisWeek: "This Week",
  today: "Today",
  week: "Week",
  day: "Day",
  print: "Print",
  language: "Language",
  filter: "Filter",
  allStaff: "All Staff",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  daysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hours: "h",
  addRepair: "Add repair",
  searchRepairs: "Search repairs…",
  noResults: "No repairs found",
  schedule: "Schedule",
  unschedule: "Remove from planning",
  dragToMove: "Drag to move",
  noRepairsScheduled: "No repairs scheduled",
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  searching: "Searching…",
  customer: "Customer",
  location: "Location",
  priority: "Priority",
  status: "Status",
  assignedTo: "Assigned to",
  pageSubtitle:
    "Repairs with a due date in this week. Drag a row to another day to reschedule, or add from your backlog.",
  emptyDayHint: "Nothing due — tap Add to place a repair on this day.",
  weekRepairsSome: "{n} repairs with a due date this week",
  weekRepairsNone: "No repairs with a due date this week",
  dragHint: "Tip: drag a repair to another day to change its due date.",
  browseWorkOrders: "All work orders",
  scheduleNeedsTasks:
    "Add at least one task on this work order before you can schedule it — open the work order and add tasks under Tasks.",
};

const nl: PlanningStrings = {
  planning: "Planning",
  thisWeek: "Deze week",
  today: "Vandaag",
  week: "Week",
  day: "Dag",
  print: "Printen",
  language: "Taal",
  filter: "Filter",
  allStaff: "Iedereen",
  days: ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"],
  daysShort: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
  months: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
  hours: "u",
  addRepair: "Reparatie toevoegen",
  searchRepairs: "Zoek reparaties…",
  noResults: "Geen reparaties gevonden",
  schedule: "Inplannen",
  unschedule: "Verwijderen uit planning",
  dragToMove: "Sleep om te verplaatsen",
  noRepairsScheduled: "Geen reparaties ingepland",
  unscheduled: "Niet ingepland",
  scheduled: "Ingepland",
  searching: "Searchen…",
  customer: "Klant",
  location: "Locatie",
  priority: "Prioriteit",
  status: "Status",
  assignedTo: "Toegewezen aan",
  pageSubtitle:
    "Reparaties met een streefdatum in deze week. Sleep een regel naar een andere dag om te verplaatsen, of voeg toe vanuit je wachtrij.",
  emptyDayHint: "Niets ingepland — tik op Toevoegen om hier een reparatie te zetten.",
  weekRepairsSome: "{n} reparaties met streefdatum deze week",
  weekRepairsNone: "Geen reparaties met streefdatum deze week",
  dragHint: "Tip: sleep een reparatie naar een andere dag om de streefdatum aan te passen.",
  browseWorkOrders: "Alle werkorders",
  scheduleNeedsTasks:
    "Voeg minstens één taak toe aan deze reparatie voordat je hem kunt inplannen — open de werkorder en voeg taken toe onder Taken.",
};

const es: PlanningStrings = {
  planning: "Planificación",
  thisWeek: "Esta semana",
  today: "Hoy",
  week: "Semana",
  day: "Día",
  print: "Imprimir",
  language: "Idioma",
  filter: "Filtrar",
  allStaff: "Todos",
  days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
  daysShort: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  hours: "h",
  addRepair: "Añadir reparación",
  searchRepairs: "Buscar reparaciones…",
  noResults: "No se encontraron reparaciones",
  schedule: "Programar",
  unschedule: "Quitar de la planificación",
  dragToMove: "Arrastra para mover",
  noRepairsScheduled: "No hay reparaciones programadas",
  unscheduled: "Sin programar",
  scheduled: "Programado",
  searching: "Buscando…",
  customer: "Cliente",
  location: "Ubicación",
  priority: "Prioridad",
  status: "Estado",
  assignedTo: "Asignado a",
  pageSubtitle:
    "Reparaciones con fecha prevista en esta semana. Arrastra una fila a otro día para reprogramar, o añade desde el backlog.",
  emptyDayHint: "Nada programado — pulsa Añadir para colocar una reparación en este día.",
  weekRepairsSome: "{n} reparaciones con fecha prevista esta semana",
  weekRepairsNone: "No hay reparaciones con fecha prevista esta semana",
  dragHint: "Consejo: arrastra una reparación a otro día para cambiar la fecha prevista.",
  browseWorkOrders: "Todas las órdenes",
  scheduleNeedsTasks:
    "Añade al menos una tarea a esta reparación antes de programarla — abre la orden y añade tareas en Tareas.",
};

const locales: Record<PlanningLang, PlanningStrings> = { en, nl, es };

export function getLocaleStrings(lang: PlanningLang): PlanningStrings {
  return locales[lang];
}

export function formatDateLocale(date: Date, lang: PlanningLang): string {
  const strings = locales[lang];
  const day = date.getDate();
  const month = strings.months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatWeekRange(start: Date, end: Date, lang: PlanningLang): string {
  const strings = locales[lang];
  const s = start.getDate();
  const e = end.getDate();
  const sMonth = strings.months[start.getMonth()];
  const eMonth = strings.months[end.getMonth()];
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${s} – ${e} ${sMonth} ${year}`;
  }
  return `${s} ${sMonth} – ${e} ${eMonth} ${year}`;
}
