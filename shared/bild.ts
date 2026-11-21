// Bilder vor dem Speichern verkleinern, ohne die Transparenz zu verlieren.
//
// Fotos werden JPEG (klein), Bilder mit durchsichtigen Stellen (freigestellte PNG, WebP, GIF, SVG) bleiben PNG.
// JPEG kennt keine Transparenz: Freigestelltes bekäme sonst einen schwarzen Hintergrund.
// Entschieden wird nach dem Inhalt, nicht nach der Dateiendung: Ein PNG-Foto ohne Transparenz wird trotzdem JPEG.

/** true, wenn das Bild auf der Leinwand irgendwo nicht ganz deckend ist. */
export function hatTransparenz(cv: HTMLCanvasElement): boolean {
  try {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
  } catch (e) { return true; }   // Im Zweifel PNG: lieber etwas größer als ein schwarzer Kasten.
}

/** Liest die Datei, verkleinert sie auf höchstens `max` Pixel Kantenlänge und gibt eine data:-URL zurück.
 *  png = true erzwingt PNG (z. B. fürs Logo). */
export function bildKlein(f: Blob, max: number, png = false, qualitaet = .86): Promise<string> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onerror = () => { URL.revokeObjectURL(i.src); rej(new Error('Bild konnte nicht gelesen werden')); };
    i.onload = () => {
      const s = Math.min(1, max / Math.max(i.naturalWidth || max, i.naturalHeight || max)), cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round((i.naturalWidth || max) * s)); cv.height = Math.max(1, Math.round((i.naturalHeight || max) * s));
      cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); URL.revokeObjectURL(i.src);
      res(png || hatTransparenz(cv) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', qualitaet));
    };
    i.src = URL.createObjectURL(f);
  });
}
