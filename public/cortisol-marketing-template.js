/**
 * Cortisol marketing template — Gauge wie Referenz-Video, Nadel per Slider, PNG-Export.
 */

const SEGMENTS = [
  { color: '#2438c8' },
  { color: '#5a4fd4' },
  { color: '#c44a9a' },
  { color: '#f07830' },
  { color: '#f02818' }
];

const state = {
  level: 12
};

const HEAD_MESH_PATH =
  'M32 18c-9 0-17 6-18 15-1 12 7 22 18 22s19-10 18-22c-1-9-9-15-18-15z' +
  'M18 38c5 4 10 6 14 6s9-2 14-6M22 50c4 5 8 7 12 7s8-2 12-7M26 60c3 4 6 5 8 5s5-1 8-5';

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Winkel in Grad: 180 = links (niedrig), 0 = rechts (hoch) — Bogen oben. */
function polar(cx, cy, r, deg) {
  const rad = degToRad(deg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad)
  };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg < startDeg ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function buildGaugeSvg(level) {
  const cx = 180;
  const cy = 168;
  const outerR = 118;
  const innerR = 72;
  const segSpan = 180 / SEGMENTS.length;

  let arcs = '';
  SEGMENTS.forEach((seg, i) => {
    const start = 180 - i * segSpan;
    const end = 180 - (i + 1) * segSpan;
    const oStart = polar(cx, cy, outerR, start);
    const oEnd = polar(cx, cy, outerR, end);
    const iEnd = polar(cx, cy, innerR, end);
    const iStart = polar(cx, cy, innerR, start);
    arcs += `<path d="M ${oStart.x.toFixed(1)} ${oStart.y.toFixed(1)} A ${outerR} ${outerR} 0 0 1 ${oEnd.x.toFixed(1)} ${oEnd.y.toFixed(1)} L ${iEnd.x.toFixed(1)} ${iEnd.y.toFixed(1)} A ${innerR} ${innerR} 0 0 0 ${iStart.x.toFixed(1)} ${iStart.y.toFixed(1)} Z" fill="${seg.color}"/>`;
  });

  const needleDeg = 180 - (level / 100) * 180;
  const tip = polar(cx, cy, outerR - 6, needleDeg);
  const baseL = polar(cx, cy, 14, needleDeg + 92);
  const baseR = polar(cx, cy, 14, needleDeg - 92);

  return `
<svg viewBox="0 0 360 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cortisol gauge ${level}%">
  <defs>
    <linearGradient id="cortisolTitleGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#ff9500"/>
      <stop offset="55%" stop-color="#ffb340"/>
      <stop offset="100%" stop-color="#fff4e0"/>
    </linearGradient>
    <linearGradient id="lookscrollGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#ff9500"/>
      <stop offset="100%" stop-color="#ffe566"/>
    </linearGradient>
    <path id="titleArc" d="${arcPath(180, 175, 52, 200, 340)}" fill="none"/>
    <path id="labelLeft" d="${arcPath(180, 168, 132, 155, 215)}" fill="none"/>
    <path id="labelRight" d="${arcPath(180, 168, 132, -35, 25)}" fill="none"/>
  </defs>
  <text class="gauge-title">
    <textPath href="#titleArc" startOffset="50%" text-anchor="middle">CORTISOL</textPath>
  </text>
  ${arcs}
  <text class="arc-label">
    <textPath href="#labelLeft" startOffset="50%" text-anchor="middle">BLOCK APPS &amp; ASCEND</textPath>
  </text>
  <text class="arc-label">
    <textPath href="#labelRight" startOffset="50%" text-anchor="middle">DOOMSCROLLING</textPath>
  </text>
  <g class="needle">
    <polygon points="${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${baseL.x.toFixed(1)},${baseL.y.toFixed(1)} ${baseR.x.toFixed(1)},${baseR.y.toFixed(1)}" fill="#39ff5a"/>
  </g>
  <circle class="hub-ring" cx="${cx}" cy="${cy}" r="24"/>
  <g transform="translate(${cx - 32} ${cy - 32})">
    <path class="hub-mesh" d="${HEAD_MESH_PATH}"/>
  </g>
  <text x="118" y="288" class="brand-lookscroll">LookScroll</text>
  <text x="248" y="288" class="brand-app"> APP</text>
</svg>`;
}

function renderCard() {
  const root = document.getElementById('marketingCard');
  if (!root) return;
  const wrap = document.createElement('div');
  wrap.className = 'cortisol-gauge-wrap';
  wrap.innerHTML = buildGaugeSvg(state.level);
  root.replaceChildren(wrap);
}

function bindControls() {
  const range = document.getElementById('levelRange');
  const val = document.getElementById('levelVal');
  const presets = document.querySelectorAll('[data-preset]');

  const sync = () => {
    state.level = Number(range.value);
    val.textContent = String(state.level);
    renderCard();
  };

  range?.addEventListener('input', sync);
  presets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = Number(btn.getAttribute('data-preset'));
      range.value = String(v);
      sync();
    });
  });
}

function updatePreviewSizeLabel() {
  const shell = document.querySelector('.preview-card-shell');
  const label = document.getElementById('previewSizeLabel');
  if (!shell || !label) return;
  const w = Math.round(shell.getBoundingClientRect().width);
  const h = Math.round(shell.getBoundingClientRect().height);
  label.textContent = `${w}×${h}`;
}

function getPreviewExportTarget() {
  const shell = document.querySelector('.preview-card-shell');
  const card = document.getElementById('marketingCard');
  const el = card || shell;
  if (!el) return null;
  const rect = (shell || el).getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width));
  const targetW = 1024;
  const pixelRatio = targetW / cssW;
  return {
    el,
    outW: Math.round(cssW * pixelRatio),
    outH: Math.round(rect.height * pixelRatio),
    pixelRatio
  };
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function downloadTemplatePng() {
  const btn = document.getElementById('downloadPngBtn');
  const target = getPreviewExportTarget();
  if (!btn || !target) return;

  if (typeof htmlToImage === 'undefined' || !htmlToImage.toBlob) {
    alert('Export-Bibliothek nicht geladen. Bitte Seite neu laden.');
    return;
  }

  const { el, outW, outH, pixelRatio } = target;
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Exportiere PNG…';

  try {
    renderCard();
    await waitForNextFrame();
    const blob = await htmlToImage.toBlob(el, {
      pixelRatio,
      backgroundColor: null,
      cacheBust: false
    });

    if (!blob) throw new Error('Empty blob');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lookscroll-cortisol-marketing-${outW}x${outH}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert('PNG-Export fehlgeschlagen. Bitte erneut versuchen.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function bindDownload() {
  document.getElementById('downloadPngBtn')?.addEventListener('click', downloadTemplatePng);
}

bindControls();
bindDownload();
renderCard();
updatePreviewSizeLabel();
window.addEventListener('resize', updatePreviewSizeLabel);
