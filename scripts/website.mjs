// Stellt die Website für Hostinger zusammen: genau die Dateien, die online gehören, im Ordner website/.
// Aufruf: node scripts/website.mjs stage|prod [zielordner]
// - Mit dabei: index.html, sitemap.xml, assets/, release/ (fertige Apps aus `npm run build`), pwa/icon.svg (Favicon).
// - Nicht dabei: Quellcode, tests/, hardware/ (Gehäuse-CAD), docs/, supabase/, node_modules/.
// - Dazu .htaccess (www-Umleitung, Zwischenspeicher, Dateitypen), robots.txt und version.txt mit dem Git-Stand.
// - Stage wird für Suchmaschinen gesperrt und zeigt unten links ein kleines „Stage“-Schild.
// Veröffentlicht wird der Ordner von .github/workflows/stage.yml und live.yml über die Branches website-stage
// und website-prod, die Hostinger abholt. Anleitung: docs/deployment.md
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export const ADRESSEN = { stage: 'https://stage.showcube.de/', prod: 'https://showcube.de/' };
export const DATEIEN = ['index.html', 'sitemap.xml', 'assets', 'release', 'pwa/icon.svg'];

export async function website(umgebung, ziel) {
  if (!(umgebung in ADRESSEN)) throw new Error(`Umgebung „${umgebung}“ gibt es nicht. Erlaubt: stage, prod`);
  const root = resolve(import.meta.dirname, '..');
  const stage = umgebung === 'stage';
  await rm(ziel, { recursive: true, force: true });
  await mkdir(ziel, { recursive: true });
  for (const f of DATEIEN) await mkdir(resolve(ziel, f, '..'), { recursive: true });
  for (const f of DATEIEN) await cp(resolve(root, f), resolve(ziel, f), { recursive: true });

  if (stage) {
    const datei = resolve(ziel, 'index.html');
    const schild = '<div id="stage-schild" style="position:fixed;left:12px;bottom:12px;z-index:9999;padding:6px 12px;border-radius:999px;'
      + 'background:#e8590c;color:#fff;font:600 13px/1.2 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none">'
      + 'Stage: Testumgebung</div>';
    const html = (await readFile(datei, 'utf8'))
      .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">')
      .replace('</body>', schild + '\n</body>');
    await writeFile(datei, html);
  }

  await writeFile(resolve(ziel, 'robots.txt'), stage
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${ADRESSEN.prod}sitemap.xml\n`);

  await writeFile(resolve(ziel, '.htaccess'), [
    '# Von scripts/website.mjs erzeugt, nicht von Hand ändern.',
    'Options -Indexes',
    'RewriteEngine On',
    // HTTP → HTTPS leitet Hostinger selbst um (hPanel, „HTTPS erzwingen“). Hier nicht noch einmal:
    // hinter dem Hostinger-CDN sieht der Server oft nur HTTP, das gäbe eine Endlosschleife.
    ...(stage ? [] : [
      '# www.showcube.de → showcube.de',
      'RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]',
      'RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]',
      '# Der Ordner der Stage-Subdomain liegt bei Hostinger in diesem Ordner: unter showcube.de/stage/ nicht zeigen.',
      'RewriteCond %{HTTP_HOST} ^(www\\.)?showcube\\.de$ [NC]',
      'RewriteRule ^stage(/|$) - [R=404,L]',
    ]),
    'AddType application/manifest+json .webmanifest',
    'AddType text/plain .sh',
    'AddDefaultCharset utf-8',
    '<IfModule mod_headers.c>',
    '  # Seiten, Skripte und Versionsdatei immer beim Server nachfragen (auch über das Hostinger-CDN),',
    '  # damit ein neuer Stand sofort ankommt. Die Dateinamen tragen keine Versionsnummer.',
    '  <FilesMatch "\\.(html|js|css|webmanifest|txt|xml|sh)$">',
    '    Header set Cache-Control "no-cache"',
    '  </FilesMatch>',
    '  <FilesMatch "\\.(png|jpg|webp|svg|woff2)$">',
    '    Header set Cache-Control "public, max-age=604800"',
    '  </FilesMatch>',
    '  Header always set X-Content-Type-Options "nosniff"',
    '  Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    ...(stage ? ['  Header always set X-Robots-Tag "noindex, nofollow"'] : []),
    '</IfModule>',
    '',
  ].join('\n'));

  let stand = process.env.GITHUB_SHA;
  if (!stand) { try { stand = execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { stand = 'unbekannt'; } }
  await writeFile(resolve(ziel, 'version.txt'), stand + '\n');
  return stand;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const umgebung = process.argv[2];
  const ziel = resolve(process.argv[3] || resolve(import.meta.dirname, '..', 'website'));
  const stand = await website(umgebung, ziel);
  console.log(`Fertig: ${ziel} für ${ADRESSEN[umgebung]} (Stand ${stand.slice(0, 7)})`);
}
