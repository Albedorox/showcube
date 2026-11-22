// Partner-Slots: „Dein Bildschirm verdient mit“.
//
// Der Laden vermietet Sendezeit an Geschäfte aus der Nachbarschaft. Ein Partner ist eine Folie mit Regeln:
// wie oft (jede N. Folie), wann (Tageszeit, von, bis, Wochentage). Player und Panel mischen die Partner-Folien
// mit derselben Funktion in die normale Schleife, damit Vorschau, Zählung und Box übereinstimmen.
// Geld fließt nicht über ShowCube: der Laden rechnet selbst mit seinen Partnern ab.
import type { Baustein, Zeitraum } from './bausteine';
import { activeOn } from './bausteine';
import type { When } from './paket';

// So reist ein Partner im Paket zur Box. Name, Kontakt und Abmachung bleiben im Panel.
export interface WerbeSlot extends Zeitraum { id: string; name: string; alle: number; when: When; folie: Baustein; }
// Im Paket (config.werbung): laufende Partner und die Folie „Werbeplatz frei“, die läuft, solange weniger als `plaetze` Partner aktiv sind.
export interface WerbungCfg { plaetze: number; partner: WerbeSlot[]; frei: WerbeSlot | null; }

export const TAKTE = [3, 4, 5, 6, 8, 10, 12];
export const FREI_ID = 'frei';

// Welche Partner laufen jetzt (Tageszeit 'day' oder 'eve', Datum), und läuft der freie Platz?
export function werbeSlots(w: WerbungCfg | null | undefined, p: string, now = new Date()): WerbeSlot[] {
  if (!w) return [];
  const fits = (x: WerbeSlot) => (x.when === 'always' || x.when === p) && activeOn(x, now) && x.folie;
  const aktiv = (w.partner || []).filter(fits);
  if (w.frei && fits(w.frei) && aktiv.length < Math.max(1, w.plaetze || 1)) aktiv.push(w.frei);
  return aktiv;
}

const ggt = (a: number, b: number): number => b ? ggt(b, a % b) : a;
// Mischt Partner-Folien in die Schleife. „Jede 5. Folie“ heißt: nach je 4 normalen Folien kommt der Partner.
// Mehrere Partner werden versetzt, damit sie nicht direkt hintereinander laufen.
// Die Schleife ist so lang, dass jede Folie und jeder Partner gleichmäßig dran sind (höchstens etwa 240 Folien).
export function mischen<T>(list: T[], slots: { item: T; alle: number }[], max = 240): T[] {
  if (!slots.length) return list;
  if (!list.length) return slots.map(s => s.item);
  const steps = slots.map(s => Math.max(1, Math.round(s.alle) - 1));
  let n = list.length; for (const st of steps) { const l = n / ggt(n, st) * st; n = l > max ? n : l; }
  const out: T[] = [];
  for (let g = 1; g <= n; g++) {
    out.push(list[(g - 1) % list.length]);
    slots.forEach((s, k) => { const st = steps[k], off = Math.floor(k * st / slots.length); if ((g + off) % st === 0) out.push(s.item); });
  }
  return out;
}

// Wie oft läuft ein Platz mit „jede N. Folie“ an einem Tag mit `minuten` Sendezeit und `dur` Sekunden pro Folie?
export const proTag = (minuten: number, dur: number, alle: number) => Math.round(minuten * 60 / Math.max(3, dur) / Math.max(2, alle));
export const rund = (n: number) => n >= 100 ? Math.round(n / 10) * 10 : n;

// ---------- Bericht für den Partner ----------
// Der Link zum Bericht trägt die Zahlen selbst (im Teil nach #). Kein Login, kein Server nötig.
export interface Bericht {
  v: 1;
  partner: string; betrieb: string;
  von?: string; bis?: string; takt: number; sek: number;
  stand: string;                    // ISO-Zeit, zu der der Link erstellt wurde
  echt: boolean;                    // true: von den Boxen gezählt, false: Beispielwerte (Demo) oder hochgerechnet
  tage: [string, number][];         // JJJJ-MM-TT, Einblendungen
  bildschirme: [string, string, number][]; // Name, Standort, Einblendungen
  bild?: string;                    // kleines Vorschaubild der Folie (JPEG als data:-URL)
}
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export const berichtKodieren = (b: Bericht) => b64(JSON.stringify(b));
// Der Link kann von jedem stammen. Darum wird jedes Feld auf seinen Typ gebracht: Texte bleiben Texte,
// Zahlen werden Zahlen, Datumsangaben müssen JJJJ-MM-TT sein und das Bild ein echtes JPEG/PNG/WebP als data:-URL.
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const BILD = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const text = (x: unknown) => typeof x === 'string' ? x.slice(0, 200) : '';
const zahl = (x: unknown, min = 0) => { const n = Number(x); return Number.isFinite(n) ? Math.max(min, Math.min(n, 1e9)) : min; };
const tag = (x: unknown) => typeof x === 'string' && TAG.test(x) ? x : undefined;
export function berichtLesen(s: string): Bericht | null {
  try {
    const b = JSON.parse(unb64(s));
    if (!b || b.v !== 1 || !Array.isArray(b.tage)) return null;
    const stand = new Date(typeof b.stand === 'string' ? b.stand : NaN);
    return {
      v: 1, partner: text(b.partner), betrieb: text(b.betrieb), von: tag(b.von), bis: tag(b.bis),
      takt: Math.round(zahl(b.takt, 1)), sek: zahl(b.sek, 1),
      stand: isNaN(+stand) ? new Date(0).toISOString() : stand.toISOString(), echt: b.echt === true,
      tage: b.tage.filter((t: unknown) => Array.isArray(t) && tag(t[0])).slice(0, 400).map((t: unknown[]) => [t[0] as string, zahl(t[1])]),
      bildschirme: (Array.isArray(b.bildschirme) ? b.bildschirme : []).filter(Array.isArray).slice(0, 200)
        .map((x: unknown[]) => [text(x[0]), text(x[1]), zahl(x[2])]),
      bild: typeof b.bild === 'string' && BILD.test(b.bild) ? b.bild : undefined,
    };
  } catch (e) { return null; }
}
