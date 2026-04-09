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
  searching: "Zoeken…",
  customer: "Klant",
  location: "Locatie",
  priority: "Prioriteit",
  status: "Status",
  assignedTo: "Toegewezen aan",
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
