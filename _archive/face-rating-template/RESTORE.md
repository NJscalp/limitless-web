# Face Rating Template — wieder einfügen (1:1)

Dieser Ordner ist ein **Snapshot** vom Stand, als die Seite noch unter `/face-muscle-scale.html` live war.

## Dateien zurück nach `public/`

```bash
cd "/Users/normannjungbauer/Desktop/Day One/limitless-web"
cp _archive/face-rating-template/face-muscle-scale.html public/
cp _archive/face-rating-template/face-muscle-scale.js public/
```

## Website wieder wie damals

1. **`index.html`** (Projektroot, Vite-Entry): Redirect und Titel wieder auf das Rating-Template setzen:
   - `url=/face-muscle-scale.html` in `<meta http-equiv="refresh" …>`
   - `window.location.replace('/face-muscle-scale.html')`
   - Titel z. B. `Limitless — Face Rating Template`

2. **`public/face-video-tab.html`**: Oben wieder die **Zwei-Tab-Navigation** einfügen (wie in der archivierten `face-muscle-scale.html` Zeilen mit `clipper-site-nav`):
   - Tab 1: `<a class="clipper-tab active" href="/face-muscle-scale.html">Face Rating Template</a>`
   - Tab 2: `<a class="clipper-tab" href="/face-video-tab.html">Promo video</a>`
   - Auf der Video-Seite entsprechend Tab 2 `active`, Tab 1 ohne `active`.

3. **`npm run build`** und deployen.

Optional: In der zurückkopierten `face-muscle-scale.html` ist die Nav schon korrekt (Rating aktiv + Link zu Video) — nur `face-video-tab.html` muss die Nav **spiegeln**, sobald das Rating wieder existiert.
