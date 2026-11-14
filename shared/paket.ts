// Das "Paket" ist die gemeinsame Sprache zwischen Cloud-Panel und Player.
// Es beschreibt genau eine Slideshow mit Zeitplan und den Dateien, die sie braucht.
//
// - Cloud: Das Panel schickt das Paket an die Box, die Box speichert es und spielt offline weiter.
// - Light: Dasselbe Paket als Datei auf dem USB-Stick (showcube-paket.json).
//
// Demo: die "Cloud" läuft über einen BroadcastChannel zwischen zwei Browser-Tabs.
// Mit Konto: das Panel legt das Paket auf dem Server ab (Tabelle `pakete`), die Box holt es mit box_stand().
// Dateien sind dann Verweise "speicher:<betrieb>/<datei>" (siehe shared/cloud.ts und docs/backend.md).

export const PAKET_FORMAT = 'showcube-paket';
export const PAKET_VERSION = 1;
export const CHANNEL = 'showcube-cloud';

import type { Baustein, Leiste, Zeitraum } from './bausteine';

export type When = 'always' | 'day' | 'eve';
// Zeitraum (von, bis, Wochentage) ist freiwillig. Ohne Zeitraum läuft das Medium immer.
export interface MediaRef extends Zeitraum { id: string; type: 'image' | 'video'; name: string; when: When; }

// Felder heißen bewusst wie die Einstellungen im Player, damit er sie direkt übernehmen kann.
export interface ShowConfig {
  tpl: string | null;      // Schlüssel aus TEMPLATES oder null = keine Vorlagen-Folien
  name: string;            // Name des Betriebs auf den Folien
  items: string;           // Einträge, eine Zeile pro Eintrag, Spalten mit |
  accent: string;
  dur: number;             // Sekunden pro Folie
  fit: 'cover' | 'contain';
  dayStart: string; eveStart: string;
  offOn: boolean; offFrom: string; offTo: string;
  offDays?: number[];      // Ruhetage: 0 = Sonntag … 6 = Samstag, Bildschirm bleibt schwarz
  notice?: Notice | null;  // Sofort-Hinweis, siehe unten
  media: MediaRef[];
  extras?: Baustein[];     // Zusatzfolien: QR-Code, Bewertungen, Countdown. Laufen nach den Vorlagen-Folien.
  leiste?: Leiste | null;  // Infoleiste unten: Laufband, Uhr, Wetter
}

// Sofort-Hinweis: Band über allen Folien, bis zum Zeitpunkt `until` (ms seit 1970, 0 = bis er entfernt wird).
export interface Notice { text: string; until: number; }

export interface Paket {
  format: typeof PAKET_FORMAT;
  version: number;
  show: { id: string; name: string; revision: number; published: string };
  screen?: { id: string; name: string };
  config: ShowConfig;
  // Im Kanal: Blobs. In der USB-Datei: data:-URLs. Vom Server: "speicher:<pfad>". Der Schlüssel `logo` ist das Logo des Betriebs.
  files: Record<string, Blob | string>;
}

// Nachrichten im Kanal. Player -> Panel: hello, beat, shot. Panel -> Player: paket, notice, cmd.
export type Msg =
  | { t: 'hello'; screen: string }
  | { t: 'beat'; screen: string; period: string; slide: number; of: number; revision: number; power: boolean; w: number; h: number; uptime: number; plays?: Record<string, number>; wx?: boolean }
  | { t: 'shot'; screen: string; url: string }
  | { t: 'paket'; screen: string; paket: Paket }
  | { t: 'notice'; screen: string; notice: Notice | null }
  | { t: 'cmd'; screen: string; cmd: 'restart' | 'power' | 'identify' | 'shot'; on?: boolean; label?: string };

const blobToDataURL = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });

export async function paketToFile(p: Paket): Promise<Blob> {
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.files)) files[k] = typeof v === 'string' ? v : await blobToDataURL(v);
  return new Blob([JSON.stringify({ ...p, files }, null, 1)], { type: 'application/json' });
}

export async function paketFromFile(text: string): Promise<Paket> {
  const p = JSON.parse(text);
  if (!p || p.format !== PAKET_FORMAT) throw new Error('Das ist kein ShowCube-Paket.');
  if (p.version > PAKET_VERSION) throw new Error('Das Paket ist neuer als dieser Player.');
  const files: Record<string, Blob> = {};
  for (const [k, v] of Object.entries(p.files || {})) files[k] = typeof v === 'string' ? await (await fetch(v as string)).blob() : v as Blob;
  return { ...p, files };
}
