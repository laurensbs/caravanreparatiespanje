/**
 * Changelog voor het feedback-dashboard (eenvoudige taal / lekentaal).
 *
 * Wanneer iets merkbaars verandert voor gebruikers:
 * - Voeg bovenaan een nieuw object toe (nieuwste eerst in deze array).
 * - Gebruik `date` als YYYY-MM-DD (dag van release of van merge).
 * - Schrijf `title` kort en duidelijk.
 * - Gebruik `bullets`: korte zinnen, geen jargon. Schrijf wat mensen nu kunnen of wat er anders is.
 *
 * Dit bestand is de enige bron voor de tijdlijn "Wat is er nieuw" op /feedback.
 */

export type ProductUpdate = {
  id: string;
  /** Sortering en label; formaat YYYY-MM-DD */
  date: string;
  /** Korte titel in gewone taal */
  title: string;
  /** Korte punten: wat je merkt in het systeem */
  bullets: string[];
};

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "changelog-in-feedback",
    date: "2026-04-17",
    title: "Nieuws over het systeem staat nu bij Feedback",
    bullets: [
      "Onderaan deze pagina vind je een lijst met verbeteringen in gewone taal.",
      "Je kunt in die lijst naar beneden scrollen om oudere aanpassingen terug te lezen.",
      "Vanaf nu hoort elke duidelijke verbetering in het systeem hier te worden bijgehouden, zodat iedereen begrijpt wat er kan.",
    ],
  },
  {
    id: "mobiel-menu-dashboard-2026-04",
    date: "2026-04-17",
    title: "Beter werken op je telefoon of tablet",
    bullets: [
      "Linksboven zit een menu-knop (streepjes). Daarmee klapt het hele menu open, inclusief Feedback. Voor beheerders staan daar ook Audit en Instellingen.",
      "Je hoeft je scherm niet meer op de breedste stand te zetten om alles te kunnen kiezen.",
      "Op het dashboard kun je de gekleurde tellers (bijv. Te doen, Lopend) horizontaal vegen als ze niet allemaal op één regel passen.",
      "Het blok met de pipeline (werkstroom) en de lijst met recente werkorders sluit beter aan op een smal scherm.",
    ],
  },
  {
    id: "facturen-onderdelen-mobiel",
    date: "2026-04-12",
    title: "Facturen, onderdelen en overzicht op klein scherm",
    bullets: [
      "Schermen voor onderdelen en facturen (offertes en achterstallig) zijn beter leesbaar op de telefoon en tablet.",
      "Grotere tikvlakken en duidelijkere kaarten maken het makkelijker om iets aan te tikken zonder per ongeluk de verkeerde knop te raken.",
      "Bij facturen zijn de koppelingen met Holded en reparaties duidelijker, ook op een smal scherm.",
    ],
  },
  {
    id: "klant-geen-antwoord-verwacht",
    date: "2026-04-10",
    title: "Nieuwe keuze bij klantcontact: geen antwoord nodig",
    bullets: [
      "Bij de status van het klantcontact kun je nu aangeven: geen antwoord verwacht.",
      "Handig als je wacht op de klant maar in de praktijk geen reactie meer nodig hebt.",
      "Die gevallen vallen niet meer in de lijsten voor opvolging of 'geen reactie'.",
    ],
  },
  {
    id: "feedback-puntje-header",
    date: "2026-04-08",
    title: "Zichtbaar wanneer er op je feedback is gereageerd",
    bullets: [
      "Als een manager op jouw feedback heeft geantwoord, zie je een stipje bij het Feedback-icoon in de balk bovenin (op een groot scherm).",
      "Open je de Feedback-pagina, dan verdwijnt dat stipje weer.",
    ],
  },
];

/** Totaal aantal korte punten (voor het tellertje op de pagina). */
export function countProductUpdateBullets(updates: ProductUpdate[]): number {
  return updates.reduce((n, u) => n + u.bullets.length, 0);
}
