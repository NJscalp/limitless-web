# Shield Editor (archived)

`shield-lock-screen.html` wurde am 2026-05-04 von der Website (`public/`) entfernt,
ist aber hier weiterhin gespeichert, falls wir es wieder brauchen.

## Wieder aktivieren

1. Datei zurück nach `limitless-web/public/` verschieben:

   ```sh
   mv "_archive/shield-editor/shield-lock-screen.html" "public/shield-lock-screen.html"
   ```

2. In `index.html` die Redirect-URL wieder auf `/shield-lock-screen.html` setzen
   (war vorher der Default).

3. In `public/face-muscle-scale.html` den Nav-Link wieder einfügen:

   ```html
   <a href="shield-lock-screen.html">Shield editor</a>
   <span class="clipper-nav-sep" aria-hidden="true">|</span>
   ```

4. `npm run build` ausführen.
