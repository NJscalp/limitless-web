#!/bin/bash
# SF Symbols für Focus-Flow-Brücke exportieren (macOS, Swift/AppKit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/assets/sf-flow"
mkdir -p "$OUT"
export OUT
swift - <<'SWIFT'
import AppKit

@MainActor
func export(name: String, palette: [NSColor], file: String, pointSize: CGFloat, weight: NSFont.Weight = .semibold) {
    let outDir = ProcessInfo.processInfo.environment["OUT"] ?? ""
    var cfg = NSImage.SymbolConfiguration(pointSize: pointSize, weight: weight)
    cfg = cfg.applying(NSImage.SymbolConfiguration(paletteColors: palette))
    guard var img = NSImage(systemSymbolName: name, accessibilityDescription: nil) else { return }
    img = img.withSymbolConfiguration(cfg) ?? img
    let px = Int(pointSize * 4)
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: pointSize, height: pointSize)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    img.draw(in: NSRect(x: 0, y: 0, width: pointSize, height: pointSize))
    NSGraphicsContext.restoreGraphicsState()
    let path = "\(outDir)/\(file)"
    try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
    print("ok", file)
}

@MainActor
func run() {
    let out = ProcessInfo.processInfo.environment["OUT"]!
    let red = NSColor(red: 1, green: 0.231, blue: 0.188, alpha: 1)
    let orange = NSColor(red: 1, green: 0.584, blue: 0, alpha: 1)
    let blue = NSColor(red: 0, green: 0.478, blue: 1, alpha: 1)
    let green = NSColor(red: 0.204, green: 0.78, blue: 0.349, alpha: 1)
    let gray = NSColor(white: 1, alpha: 0.35)
    export(name: "lock.fill", palette: [red], file: "lock-fill-red.png", pointSize: 16)
    export(name: "figure.run", palette: [orange], file: "figure-run-orange.png", pointSize: 16)
    export(name: "lock.open.fill", palette: [blue], file: "lock-open-fill-blue.png", pointSize: 16)
    export(name: "checkmark.circle.fill", palette: [green], file: "checkmark-circle-fill-green.png", pointSize: 16)
    export(name: "figure.run", palette: [green], file: "figure-run-green.png", pointSize: 16)
    export(name: "lock.open.fill", palette: [green], file: "lock-open-fill-green.png", pointSize: 16)
    export(name: "arrow.right", palette: [gray], file: "arrow-right-gray.png", pointSize: 13, weight: .bold)
    export(name: "bolt.fill", palette: [orange], file: "bolt-fill-orange.png", pointSize: 14, weight: .bold)
}
MainActor.assumeIsolated { run() }
SWIFT
