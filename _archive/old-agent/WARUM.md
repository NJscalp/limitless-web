# Das alte Agent-Gehirn (stillgelegt am 03.09.2026)

Ersetzt durch `api/_shared/director-*.mjs`. Hier liegt es nur, weil diese
Dateien nie in git waren — ein Löschen wäre unwiderruflich gewesen.

## Warum es weg musste

1. **Es lief gar nicht auf Claude.** `/health` meldete `agentProvider: "fal"`
   und `agentModel: "claude-sonnet-4-20250514"` — ein Modell, das laut dem
   Kommentar in `agent-core.mjs` selbst am 15.06.2026 abgeschaltet wurde und
   seither 404 lieferte. Jede Anfrage MIT Foto ging an Gemini 2.5 Flash über
   fal, mit JSON-im-Text statt Werkzeugaufrufen.
2. **Ohne Foto antwortete überhaupt kein Modell.** Der fal-Pfad steigt bei
   `images.length === 0` aus, der Anthropic-Pfad lief ins 404 — übrig blieb
   `fallbackAgent`, eine handgeschriebene Stichwortliste mit vorformulierten
   Sätzen.
3. **Das Wissen gehörte zu einem anderen Produkt.** ~400 Zeilen über
   Luxus-Flex, Supercars, Ketten und Feed-Retakes. Clavic ist ein Photo
   Director für Kamera-Looks.
4. **Der Prompt widersprach sich selbst.** Mehrere Abschnitte erklärten
   frühere Abschnitte ausdrücklich für ungültig — Spuren dreier
   zusammengelegter Personas.

Zum Vergleich: der alte Systemprompt war ~17.700 Tokens, der neue ~2.000.
