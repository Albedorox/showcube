// Edge Function „vorlage-aus-bild“ (Pro): aus einem Bild eine Vorlage mit Ebenen machen.
//
// Der Vorlagen-Designer schickt ein Bild (Plakat, Flyer, alte Folie, Screenshot) als base64. Diese Funktion
// 1. prüft die Anmeldung (Konto aus dem Panel, keine Box),
// 2. bucht eine Analyse über ki_analyse_buchen() (nur Pro, Kontingent pro Monat, siehe Migration 20261121160000),
// 3. fragt Claude (Bildverständnis) und bekommt per Structured Output garantiert JSON im Schema unten zurück:
//    Hintergrund, Farben und alle Elemente (Text, Fläche, Kreis, Bild, Logo, QR-Code) mit Lage in Prozent,
// 4. trägt Modell und Tokens ein. Klappt etwas nicht, wird die Buchung zurückgenommen.
//
// Der Designer macht daraus die eigentliche Vorlage (designer/aus-bild.ts): Farben auf die Marke abbilden,
// Bildbereiche ausschneiden, Animationen vorschlagen. Der KI-Schlüssel liegt nur hier als Secret
// ANTHROPIC_API_KEY, nie im Browser. Einrichten: docs/vorlage-aus-bild.md.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  Pflicht. Schlüssel aus console.anthropic.com
//   KI_MODELL          optional, Standard claude-opus-5-5 (günstiger: claude-sonnet-5-5)
//   KI_AUFWAND         optional, low | medium | high, Standard medium
import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODELL = Deno.env.get('KI_MODELL') || 'claude-opus-5-5';
const AUFWAND = (Deno.env.get('KI_AUFWAND') || 'medium') as 'low' | 'medium' | 'high';
const MAX_BILD = 7_000_000;   // Zeichen base64, etwa 5 MB. Der Designer schickt höchstens 1568 px, also weit darunter.
const ARTEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fehler = (status: number, code: string, text: string) => antwort(status, { fehler: code, text });

// Neue Schlüssel (sb_publishable/sb_secret) mit Rückfall auf die alten anon/service_role.
function schluessel(neu: string, alt: string) {
  try { const k = JSON.parse(Deno.env.get(neu) || '{}').default; if (k) return k as string; } catch (_) { /* alt nehmen */ }
  return Deno.env.get(alt) || '';
}

// ---------- Was die KI zurückgibt ----------
// Strukturiertes Ausgabeformat: Die API garantiert JSON genau in diesem Schema.
// Alle Felder sind Pflicht (leer = null), so muss der Designer nichts raten.
const str = { type: 'string' }, num = { type: 'number' }, nul = { type: 'null' };
const oderNull = (s: object) => ({ anyOf: [s, nul] });
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'hintergrund', 'verlauf', 'farben', 'elemente'],
  properties: {
    name: { ...str, description: 'Kurzer deutscher Name für die Vorlage, z. B. „Mittagsangebot“' },
    hintergrund: { ...str, description: 'Hintergrundfarbe als #rrggbb' },
    verlauf: oderNull({ ...str, description: 'Zweite Farbe als #rrggbb, wenn der Hintergrund ein Verlauf von oben links nach unten rechts ist' }),
    farben: {
      type: 'object', additionalProperties: false, required: ['primaer', 'zweit', 'dunkel', 'hell'],
      properties: { primaer: str, zweit: str, dunkel: str, hell: str },
      description: 'Die Hausfarben, die das Bild prägen, als #rrggbb: Hauptfarbe, Zweitfarbe (Akzent), Dunkel, Hell',
    },
    elemente: {
      type: 'array',
      description: 'Alle sichtbaren Elemente, von hinten nach vorn (das erste liegt ganz unten)',
      items: {
        type: 'object', additionalProperties: false,
        required: ['art', 'x', 'y', 'w', 'h', 'text', 'zeilenhoehe', 'gewicht', 'schrift', 'ausrichtung', 'vertikal', 'grossbuchstaben', 'farbe', 'fuellung', 'hinterlegt', 'ecken', 'deckkraft', 'feld', 'beschreibung'],
        properties: {
          art: { type: 'string', enum: ['text', 'flaeche', 'kreis', 'bild', 'logo', 'qr'] },
          x: { ...num, description: 'Linke Kante in Prozent der Bildbreite (0 bis 100)' },
          y: { ...num, description: 'Obere Kante in Prozent der Bildhöhe (0 bis 100)' },
          w: { ...num, description: 'Breite in Prozent der Bildbreite' },
          h: { ...num, description: 'Höhe in Prozent der Bildhöhe' },
          text: oderNull({ ...str, description: 'Text genau wie im Bild, Zeilenumbrüche als \\n. Bei QR-Code der Link, falls lesbar' }),
          zeilenhoehe: oderNull({ ...num, description: 'Text: Höhe einer Zeile (Oberkante Großbuchstabe bis Unterlänge) in Prozent der Bildhöhe' }),
          gewicht: oderNull({ type: 'integer', description: 'Text: Schriftstärke 300 bis 900 (400 normal, 700 fett)' }),
          schrift: oderNull({ type: 'string', enum: ['titel', 'text'], description: 'titel = auffällige Überschrift- oder Preisschrift, text = Fließtext' }),
          ausrichtung: oderNull({ type: 'string', enum: ['left', 'center', 'right'] }),
          vertikal: oderNull({ type: 'string', enum: ['oben', 'mitte', 'unten'], description: 'Text: wo er in seinem Kasten sitzt, mitte z. B. bei Text in einem Kreis' }),
          grossbuchstaben: { type: 'boolean', description: 'Text: ganz in Großbuchstaben gesetzt' },
          farbe: oderNull({ ...str, description: 'Text: Schriftfarbe. QR-Code: Farbe der Punkte. #rrggbb' }),
          fuellung: oderNull({ ...str, description: 'Fläche, Kreis: Füllfarbe. QR-Code: Hintergrund. #rrggbb' }),
          hinterlegt: oderNull({ ...str, description: 'Text: Farbe einer Fläche direkt hinter jeder Zeile (wie Textmarker), sonst null' }),
          ecken: oderNull({ ...num, description: 'Fläche, Bild: Eckenradius in Prozent der kürzeren Seite (0 bis 50)' }),
          deckkraft: oderNull({ ...num, description: '0 bis 1, null = ganz deckend' }),
          feld: oderNull({ ...str, description: 'Kurze Beschriftung, wenn der Betrieb diesen Inhalt regelmäßig selbst ändern wird (z. B. „Preis“, „Gericht“, „Foto“), sonst null' }),
          beschreibung: oderNull({ ...str, description: 'Bild, Logo: was zu sehen ist, in wenigen Wörtern' }),
        },
      },
    },
  },
};

const SYSTEM = `Du zerlegst Werbebilder für Bildschirme in kleinen Betrieben (Café, Laden, Praxis, Makler) in bearbeitbare Ebenen.
Aus deiner Antwort entsteht eine Vorlage im ShowCube-Vorlagen-Designer. Der Nutzer korrigiert danach nur noch Kleinigkeiten.

So gehst du vor:
- Erfasse jedes sichtbare Element genau einmal, von hinten nach vorn: farbige Flächen und Balken, Kreise und Störer,
  Fotos und Grafiken, Logos, QR-Codes und jeden Textblock.
- Lage und Größe sind Prozent des ganzen Bildes: x und w von der Bildbreite, y und h von der Bildhöhe. Miss sorgfältig,
  der Kasten soll das Element knapp umschließen.
- Text: Jeder Block mit gleicher Schrift, Größe und Farbe ist ein Element. Übernimm den Wortlaut exakt (Umlaute, Preise,
  Satzzeichen). Mehrzeilige Blöcke mit \\n. Eine Überschrift, die in Zeilen umbricht, bleibt ein Element.
- Fotos, Illustrationen und Muster, die sich nicht aus Flächen und Text bauen lassen, sind art "bild". Ein Foto über
  das ganze Bild ist ein "bild" mit 0, 0, 100, 100. Text, der auf dem Foto liegt, ist trotzdem ein eigenes Text-Element.
- Das Firmenlogo ist art "logo". Ein QR-Code ist art "qr".
- Ist der Hintergrund eine einfarbige Fläche oder ein Verlauf, gib ihn als hintergrund/verlauf an und nicht als Fläche.
- Farben als #rrggbb, so wie sie im Bild wirken.
- feld: Markiere, was der Betrieb typischerweise selbst ändert (Preise, Tagesgericht, Angebot, Datum, Foto).
  Logo, Deko und feste Slogans bekommen null.
- Felder, die für eine Elementart keinen Sinn haben, sind null (grossbuchstaben dann false).`;

type Erkennung = { name: string; hintergrund: string; verlauf: string | null; farben: Record<string, string>; elemente: Record<string, unknown>[] };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fehler(405, 'KI_METHODE', 'Nur POST.');

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return fehler(401, 'KI_NICHT_ANGEMELDET', 'Bitte zuerst anmelden.');
  const url = Deno.env.get('SUPABASE_URL')!;
  const nutzer = createClient(url, schluessel('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: wer, error: werFehler } = await nutzer.auth.getUser(auth.slice(7));
  if (werFehler || !wer?.user || wer.user.is_anonymous) return fehler(401, 'KI_NICHT_ANGEMELDET', 'Bitte mit deinem ShowCube-Konto anmelden.');

  let body: { bild?: string; medientyp?: string; breite?: number; hoehe?: number };
  try { body = await req.json(); } catch (_) { return fehler(400, 'KI_ANFRAGE', 'Die Anfrage ist kein JSON.'); }
  const bild = (body.bild || '').replace(/^data:[^,]+,/, '');
  const typ = (ARTEN as readonly string[]).includes(body.medientyp || '') ? body.medientyp as typeof ARTEN[number] : null;
  if (!bild || !typ) return fehler(400, 'KI_ANFRAGE', 'Bild fehlt oder hat ein unbekanntes Format (JPEG, PNG, WebP, GIF).');
  if (bild.length > MAX_BILD) return fehler(413, 'KI_ZU_GROSS', 'Das Bild ist zu groß.');

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return fehler(503, 'KI_NICHT_EINGERICHTET', 'Die KI ist noch nicht eingerichtet (Schlüssel fehlt).');

  // Pro und Kontingent prüfen, Analyse buchen.
  const { data: buchung, error: bFehler } = await nutzer.rpc('ki_analyse_buchen');
  if (bFehler) {
    const code = (bFehler.message.match(/KI_[A-Z_]+/) || ['KI_FEHLER'])[0];
    const status = code === 'KI_KONTINGENT' ? 429 : code === 'KI_NICHT_ANGEMELDET' ? 401 : 403;
    return fehler(status, code, bFehler.message);
  }
  const admin = createClient(url, schluessel('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const zuruecknehmen = () => admin.from('ki_analysen').delete().eq('id', buchung.id);

  try {
    const claude = new Anthropic({ apiKey: key });
    // Rückfall auf ein anderes Modell, falls das erste ablehnt (nur bei Modellen, die das kennen).
    const rueckfall = /^claude-(opus-5|sonnet-5-5|fable-5)/.test(MODELL) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {};
    const msg = await claude.beta.messages.stream({
      model: MODELL,
      max_tokens: 32000,
      ...rueckfall,
      thinking: { type: 'adaptive' },
      output_config: { effort: AUFWAND, format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: typ, data: bild } },
          { type: 'text', text: `Das Bild ist ${Math.round(body.breite || 0)} × ${Math.round(body.hoehe || 0)} Pixel groß. Zerlege es in Ebenen.` },
        ],
      }],
    }).finalMessage();

    if (msg.stop_reason === 'refusal') { await zuruecknehmen(); return fehler(422, 'KI_ABGELEHNT', 'Die KI hat dieses Bild nicht bearbeitet.'); }
    if (msg.stop_reason === 'max_tokens') { await zuruecknehmen(); return fehler(422, 'KI_ZU_VIEL', 'Das Bild hat zu viele Elemente.'); }
    const text = msg.content.map(b => b.type === 'text' ? b.text : '').join('');
    const erkennung = JSON.parse(text) as Erkennung;
    if (!Array.isArray(erkennung.elemente)) throw new Error('Antwort ohne Elemente');

    await admin.from('ki_analysen').update({ ok: true, modell: msg.model, tokens_ein: msg.usage.input_tokens, tokens_aus: msg.usage.output_tokens }).eq('id', buchung.id);
    return antwort(200, { erkennung, rest: buchung.rest, modell: msg.model });
  } catch (e) {
    await zuruecknehmen();
    console.error('vorlage-aus-bild', e);
    const status = e instanceof Anthropic.RateLimitError ? 503 : 502;
    return fehler(status, 'KI_FEHLER', 'Die KI ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.');
  }
});
