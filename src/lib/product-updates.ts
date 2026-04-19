/**
 * Changelog for the Feedback page (plain English).
 * Add a new object at the top when you ship something users will notice.
 * `date`: YYYY-MM-DD
 *
 * Tone: write like you would tell a colleague at the coffee machine.
 * Skip jargon. One bullet = one thing the user will actually feel.
 */

export type ProductUpdate = {
  id: string;
  date: string;
  title: string;
  bullets: string[];
};

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "mobile-pwa-2026-04-19",
    date: "2026-04-19",
    title: "Werkt nu écht als app op iPhone en iPad",
    bullets: [
      "Op de iPhone is de bovenste balk niet meer dat propje kleine icoontjes — alles is nu netjes raakbaar (44 px tap-target) en de minder-gebruikte knoppen zitten achter één duidelijk ⋯-menu.",
      "Wanneer je de admin-app op je beginscherm zet, verschijnt er nu een echt iconnetje in plaats van een wit vlak (geen 404 meer in de console).",
      "De garage-tablet heeft een eigen ‘app’ met amberkleurig icoon, zodat de werkers hem niet meer verwarren met de admin-app op een gedeeld toestel. Wanneer je hem vanaf /garage opslaat, opent ’ie ook direct in de garage-shell.",
    ],
  },
  {
    id: "garage-presence-thread-2026-04-19",
    date: "2026-04-19",
    title: "Live gesprek met de garage per reparatie",
    bullets: [
      "De ‘Conversation with garage’ ververst nu automatisch elke 8 seconden (en pauzeert wanneer je tab op de achtergrond staat). Een nieuw bericht van de werkplaats geeft direct een toast en knipperende stip.",
      "Boven het gesprek staat live wie er nu fysiek aan de auto bezig is, gebaseerd op de actieve timer — bijvoorbeeld ‘Jake is in de garage · 23m’.",
      "De aparte ‘Pin a banner message’-blok is verdwenen: het laatste bericht uit het gesprek is automatisch de banner. Eén plek, geen dubbele kanalen.",
    ],
  },
  {
    id: "first-login-password-2026-04-19",
    date: "2026-04-19",
    title: "Eerste keer inloggen: zelf wachtwoord kiezen",
    bullets: [
      "Admins (Jake, Johan, Noah) kiezen bij hun eerste login zelf een nieuw wachtwoord, zonder dat ze het oude hoeven te kennen. Same look-and-feel als de reguliere login.",
      "Garagewerkers loggen gewoon in met hun PIN — die hoeven niets opnieuw in te stellen.",
    ],
  },
  {
    id: "work-orders-overview-2026-04-19",
    date: "2026-04-19",
    title: "Work Orders: één duidelijke focusbalk bovenaan",
    bullets: [
      "De twee aparte rijtjes filterchips (data + status) zijn samengevoegd tot één balk: ‘Wanneer | Mijn werk | Wachten op’.",
      "Elke chip toont nu hoeveel jobs er in dat hokje zitten — Today, This week, Overdue, In Garage, Waiting for Parts, etc.",
      "‘In Progress’ heet nu ‘In Garage’, omdat dat letterlijk is wat het betekent: de auto staat in de werkplaats.",
      "Kleuren van de chips zijn gelijkgetrokken met de status-pillen in de tabel zelf — geen verwarring meer over wat amber of oranje betekent.",
    ],
  },
  {
    id: "repair-client-vs-profile-2026-04-17",
    date: "2026-04-17",
    title: "Reparaties: één job vs de hele klantkaart",
    bullets: [
      "Wat er misging in gewone taal: het kleine potlood onder ‘Customer’ wijzigt de gedeelde klantkaart in je adresboek. Elke reparatie die naar die klant verwijst, kreeg dus de nieuwe naam of telefoon — niet alleen die ene job.",
      "Daarom leek het of ‘Carlos’ veranderen in ‘Naomi’ overal doorsijpelde: je paste één klantrecord aan dat meerdere reparaties deelden.",
      "Nu staat er op de reparatie-pagina een duidelijke knop: ‘Use a different client for this repair only’. Het potlood is duidelijk gelabeld als ‘edits the shared card’.",
    ],
  },
  {
    id: "holded-customer-resolve-2026-04-17",
    date: "2026-04-17",
    title: "Holded-facturen en offertes koppelen vaker correct",
    bullets: [
      "Klanten zonder Holded-contact-ID werden eerder overgeslagen door de automatische factuurzoeker.",
      "De sync zoekt nu ook op e-mail of naam en vult het ID achteraf in wanneer er één eenduidige match is.",
      "De zoektekst gebruikt nu ook de Holded-contactnaam, dus matchen via titel of omschrijving lukt vaker.",
    ],
  },
  {
    id: "feedback-header-nav-2026-04-17",
    date: "2026-04-17",
    title: "Feedback in de header, Audit onder Settings",
    bullets: [
      "Feedback blijft één tap verwijderd vanuit de bovenbalk; de audit log staat onder Settings → Audit log (admins).",
      "Oude /audit-links sturen automatisch door naar de nieuwe locatie.",
    ],
  },
  {
    id: "mobile-nav-dashboard-2026-04-17",
    date: "2026-04-17",
    title: "Beter overzicht op telefoon en tablet",
    bullets: [
      "De menuknop opent het volledige navigatiepaneel; content gebruikt op kleine schermen de hele breedte.",
      "Status-chips op het dashboard scrollen horizontaal als ze niet passen; recente activiteit stapelt netter op smalle schermen.",
    ],
  },
  {
    id: "per-page-declutter-2026-04-18",
    date: "2026-04-18",
    title: "Pagina’s opgeruimd: Work Orders, Planning, Contacten, Onderdelen",
    bullets: [
      "Filtermenu’s en modals die je nooit gebruikte zijn verwijderd. Klik in lijsten gaat nu meteen naar de detailpagina.",
      "Op de reparatie-detail is de sticky right rail vervangen door een rustiger samenvatting bovenaan.",
      "Dashboard heeft een ‘vandaag’-briefing-kaart bovenaan en de sidebar telt live mee per categorie.",
    ],
  },
  {
    id: "smart-assistant-2026-04-18",
    date: "2026-04-18",
    title: "Smart Assistant en zoekfunctie verbeterd",
    bullets: [
      "De assistent toont topics nu progressief — geen wall-of-grid meer.",
      "Inbox + assistent zitten achter één pictogram in de header (met badge voor urgent + neutraal totaal).",
      "Command-palette (⌘K) onthoudt recent gebruikte items zodat je sneller doorklikt.",
    ],
  },
  {
    id: "design-system-2026-04-18",
    date: "2026-04-18",
    title: "Nieuwe huisstijl en typografie",
    bullets: [
      "Geist Sans/Mono als standaard font — strakker en moderner dan voorheen.",
      "Warme monochrome stenenkleuren (geen koud cyaan/blauw meer) voor een rustiger, premium gevoel.",
      "Page-transities, spring-physics op buttons en subtiele sound-opt-in voor optimistic UI.",
    ],
  },
  {
    id: "garage-shell-2026-04-18",
    date: "2026-04-18",
    title: "Garage-shell aangescherpt voor de iPad",
    bullets: [
      "PIN-scherm staat altijd verticaal gestapeld — voelt als een echte app.",
      "De /garage-routes zijn afgeschermd: zelfs als een werker per ongeluk een admin-link tikt, blijft hij in zijn eigen omgeving.",
      "Donkere achtergrond door de hele garage-flow voor minder afleiding op een gedeeld scherm.",
    ],
  },
  {
    id: "login-redesign-2026-04-18",
    date: "2026-04-18",
    title: "Nieuw inlogscherm",
    bullets: [
      "Klikbare account-tegels: kies wie je bent, type je wachtwoord, klaar.",
      "Rolnamen weggehaald (geen ‘admin/manager/staff’ etiketten op het login-scherm), zachte cross-fade tussen stappen, lichte shake bij verkeerd wachtwoord.",
      "Idle timeout naar 30 minuten zodat je niet steeds opnieuw hoeft in te loggen.",
    ],
  },
  {
    id: "customer-reply-not-required-2026-04-10",
    date: "2026-04-10",
    title: "Klantreactie: ‘Geen antwoord verwacht’",
    bullets: [
      "Te gebruiken wanneer je wacht op de klant maar voor déze job geen reactie nodig hebt.",
      "Die jobs blijven uit follow-up- en ‘no response’-lijsten.",
    ],
  },
  {
    id: "feedback-unread-dot-2026-04-08",
    date: "2026-04-08",
    title: "Stipje voor ongelezen reactie",
    bullets: [
      "Wanneer een manager op je feedback antwoordt, verschijnt er een rood stipje op het Feedback-icoon in de header tot je de pagina opent.",
    ],
  },
];

export function countProductUpdateBullets(updates: ProductUpdate[]): number {
  return updates.reduce((n, u) => n + u.bullets.length, 0);
}
