# Limitless Web — Deployment Schritt für Schritt (GitHub + Vercel)

Diese Datei erklärt **genau**, was **du** tun musst. Die KI in Cursor kann **keinen** GitHub- oder Vercel-Login für dich ausführen — sie legt nur den **Code** im Ordner `limitless-web/` an. Du verbindest Repository und Hosting.

---

## Wichtig zu verstehen

| Wer | Was |
|-----|-----|
| **Cursor / KI** | Dateien im Projektordner erstellen und ändern (`limitless-web/`). |
| **Du** | `npm install`, Git-Befehle, GitHub-Website, Vercel-Dashboard (einmalig einloggen). |
| **GitHub** | Speichert den Code in der Cloud. |
| **Vercel** | Baut die Website bei jedem Push neu und stellt sie unter einer URL bereit. |

---

## Schritt 1 — Lokal testen (auf deinem Mac)

1. Terminal öffnen (oder Terminal in Cursor: **Terminal → New Terminal**).
2. Befehle nacheinander ausführen:

```bash
cd "/Users/normannjungbauer/Desktop/Day One/limitless-web"
npm install
npm run dev
```

3. Im Browser öffnen: die Adresse, die Vite anzeigt (meist `http://localhost:5173`).
4. Wenn die Seite „Limitless / Face scan demo“ zeigt: **lokal passt es.** Mit `Ctrl+C` im Terminal den Dev-Server beenden.

Optional prüfen, ob der **Production-Build** funktioniert:

```bash
npm run build
```

Es sollte ein Ordner `dist/` entstehen ohne Fehler.

---

## Schritt 2 — Neues Repository auf GitHub anlegen

1. Auf **https://github.com** einloggen.
2. Oben rechts **+** → **New repository**.
3. **Repository name:** z. B. `limitless-web`.
4. **Public** oder **Private** wählen (beides geht mit Vercel).
5. **Wichtig:** **KEIN** Häkchen bei „Add a README“ (Repository leer lassen), wenn du gleich den lokalen Ordner pushen willst — sonst gibt es beim ersten Push einen Konflikt.
6. **Create repository** klicken.
7. GitHub zeigt dir eine URL — **HTTPS** notieren, z. B.  
   `https://github.com/DEINUSERNAME/limitless-web.git`

---

## Schritt 3 — Lokaler Ordner mit GitHub verbinden (erster Push)

Im Terminal (im Ordner `limitless-web`):

```bash
cd "/Users/normannjungbauer/Desktop/Day One/limitless-web"
git init
git add .
git commit -m "Initial: Vite React site for Vercel"
git branch -M main
git remote add origin https://github.com/DEINUSERNAME/limitless-web.git
git push -u origin main
```

- `DEINUSERNAME` durch deinen GitHub-Benutzernamen ersetzen.
- Beim ersten Push fragt macOS oder Git nach **Login** (Browser oder Personal Access Token). Anweisungen von GitHub folgen.

**Alternative — Cursor:** Links **Source Control** → **Initialize Repository** → Commit → **Publish Branch** (wenn mit GitHub verbunden). Dann musst du nicht jeden Befehl selbst tippen.

---

## Schritt 4 — Vercel mit GitHub verbinden

1. Auf **https://vercel.com** einloggen (am einfachsten **„Continue with GitHub“**).
2. **Add New…** → **Project**.
3. Das Repository **`limitless-web`** auswählen (Import).
4. Einstellungen prüfen:
   - **Framework Preset:** sollte **Vite** erkannt werden.
   - **Root Directory:** leer lassen (Repo enthält nur dieses Projekt im Root).
   - **Build Command:** `npm run build` (Standard).
   - **Output Directory:** `dist` (Standard bei Vite).
5. **Deploy** klicken.

Nach einigen Sekunden zeigt Vercel eine **Production URL** (z. B. `https://limitless-web-xxx.vercel.app`). **Das ist eure öffentliche Website.**

---

## Schritt 5 — Spätere Änderungen (automatisch)

1. Du oder die KI ändern Dateien in `limitless-web/`.
2. Commit + Push nach `main`:

```bash
cd "/Users/normannjungbauer/Desktop/Day One/limitless-web"
git add .
git commit -m "Beschreibung der Änderung"
git push
```

3. Vercel startet **automatisch** ein neues Deployment. Die URL bleibt gleich (außer ihr ändert die Domain).

---

## Häufige Probleme

| Problem | Lösung |
|--------|--------|
| `git push` verweigert | GitHub-Login / Token prüfen; HTTPS-URL des Repos prüfen. |
| Vercel: Build failed | Im Vercel-Deployment auf **Logs** klicken; lokal `npm run build` ausführen und Fehler beheben. |
| Falsches Projekt | In Vercel **Root Directory** setzen, falls das Web-Projekt in einem Unterordner eines Monorepos liegt. |

---

## Was als Nächstes im Code kommt

- Scan-Animation, Kamera-Placeholder, Score-Karten (Jawline, …) wie in der iOS-App — kann schrittweise in `src/` ergänzt werden.
