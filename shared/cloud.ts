// Verbindung zum ShowCube-Server (Supabase). Panel und Player benutzen beide diese Datei.
//
// Adresse und Schlüssel stehen in shared/backend.json. Beides ist öffentlich (der "Publishable Key"
// darf in den Browser), geschützt wird über Anmeldung und die Zugriffsregeln in supabase/migrations.
// Zum Entwickeln gegen einen lokalen Server: VITE_SUPABASE_URL und VITE_SUPABASE_KEY setzen.
// Sind beide leer, laufen Panel und Player wie bisher ohne Server (Demo und USB-Stick).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import cfg from './backend.json';

const env = (import.meta as any).env || {};
export const SERVER = { url: (env.VITE_SUPABASE_URL || cfg.url || '').replace(/\/$/, ''), key: env.VITE_SUPABASE_KEY || cfg.key || '' };
export const hatServer = !!(SERVER.url && SERVER.key);

export function verbinden(speicherName: string): SupabaseClient {
  return createClient(SERVER.url, SERVER.key, { auth: { storageKey: speicherName, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

// Dateien im Paket: in der USB-Datei data:-URLs, im Kanal Blobs, vom Server ein Verweis "speicher:<betrieb>/<id>".
export const SPEICHER = 'speicher:';
export const BUCKET = 'medien';
export type { SupabaseClient };
