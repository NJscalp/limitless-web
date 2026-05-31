const metrics = [
  { key: "potential", label: "Potential", min: 4.8, max: 7.0 },
  { key: "eyes", label: "Eyes", min: 3.9, max: 6.7 },
  { key: "midface", label: "Midface", min: 4.2, max: 6.9 },
  { key: "lowerThird", label: "Lower Third", min: 4.1, max: 6.8 },
  { key: "upperThird", label: "Upper Third", min: 3.8, max: 6.7 },
];

const state = {
  potential: 5.8,
  eyes: 5.2,
  midface: 5.4,
  lowerThird: 5.6,
  upperThird: 5.3,
  average: 5.4,
  gender: "male",
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

// Inline SVG als Data-URL: externe SVG-Dateien werden beim Canvas-Export oft nicht gezeichnet
// (file://, CORS, Browser-Limits). So ist das Icon in Vorschau + PNG garantiert dabei.
const APP_STORE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="lkAppStoreGrad" x1="50%" x2="50%" y1="0%" y2="100%"><stop offset="0%" stop-color="#17c9fb"/><stop offset="100%" stop-color="#1a74e8"/></linearGradient></defs><path fill="url(#lkAppStoreGrad)" d="M56.064 0h143.872C230.9 0 256 25.1 256 56.064v143.872C256 230.9 230.9 256 199.936 256H56.064C25.1 256 0 230.9 0 199.936V56.064C0 25.1 25.1 0 56.064 0"/><path fill="#fff" d="m82.042 185.81l.024.008l-8.753 15.16c-3.195 5.534-10.271 7.43-15.805 4.235s-7.43-10.271-4.235-15.805l6.448-11.168l.619-1.072c1.105-1.588 3.832-4.33 9.287-3.814c0 0 12.837 1.393 13.766 8.065c0 0 .126 2.195-1.351 4.391m124.143-38.72h-27.294c-1.859-.125-2.67-.789-2.99-1.175l-.02-.035l-29.217-50.606l-.038.025l-1.752-2.512c-2.872-4.392-7.432 6.84-7.432 6.84c-5.445 12.516.773 26.745 2.94 31.046l40.582 70.29c3.194 5.533 10.27 7.43 15.805 4.234c5.533-3.195 7.43-10.271 4.234-15.805l-10.147-17.576c-.197-.426-.539-1.582 1.542-1.587h13.787c6.39 0 11.57-5.18 11.57-11.57s-5.18-11.57-11.57-11.57m-53.014 15.728s1.457 7.411-4.18 7.411H48.092c-6.39 0-11.57-5.18-11.57-11.57s5.18-11.57 11.57-11.57h25.94c4.188-.242 5.18-2.66 5.18-2.66l.024.012l33.86-58.648l-.01-.002c.617-1.133.103-2.204.014-2.373l-11.183-19.369c-3.195-5.533-1.299-12.61 4.235-15.804s12.61-1.3 15.805 4.234l5.186 8.983l5.177-8.967c3.195-5.533 10.271-7.43 15.805-4.234s7.43 10.27 4.235 15.804l-47.118 81.61c-.206.497-.269 1.277 1.264 1.414h28.164l.006.275s16.278.253 18.495 15.454"/></svg>`;
const APP_STORE_ICON_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(APP_STORE_ICON_SVG)}`;

const appStoreIcon = new Image();
appStoreIcon.src = APP_STORE_ICON_DATA_URL;

const LIMITLESS_APP_ICON_SRC = new URL(
  "assets/limitless-app-icon.png",
  document.baseURI,
).href;
const limitlessAppIcon = new Image();
limitlessAppIcon.crossOrigin = "anonymous";
limitlessAppIcon.src = LIMITLESS_APP_ICON_SRC;

function waitForImage(img) {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    if (img.complete) {
      queueMicrotask(done);
      return;
    }
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

async function ensureAppStoreIconLoaded() {
  await waitForImage(appStoreIcon);
  try {
    if (typeof appStoreIcon.decode === "function") {
      await appStoreIcon.decode();
    }
  } catch (_) {
    /* decode optional */
  }
}

async function ensureLimitlessIconLoaded() {
  await waitForImage(limitlessAppIcon);
  try {
    if (typeof limitlessAppIcon.decode === "function") {
      await limitlessAppIcon.decode();
    }
  } catch (_) {
    /* decode optional */
  }
}

const refs = {
  phonePreview: document.querySelector(".phone-preview"),
  previewCanvas: document.getElementById("previewCanvas"),
  input: document.getElementById("photoInput"),
  image: document.getElementById("previewImage"),
  placeholder: document.getElementById("placeholder"),
  ratings: document.getElementById("ratings"),
  downloadBtn: document.getElementById("downloadBtn"),
  averageRange: document.getElementById("averageRange"),
  averageNumber: document.getElementById("averageNumber"),
  genderMaleBtn: document.getElementById("genderMaleBtn"),
  genderFemaleBtn: document.getElementById("genderFemaleBtn"),
  zoomRange: document.getElementById("zoomRange"),
  zoomNumber: document.getElementById("zoomNumber"),
  xRange: document.getElementById("xRange"),
  xNumber: document.getElementById("xNumber"),
  yRange: document.getElementById("yRange"),
  yNumber: document.getElementById("yNumber"),
  tierLabel: document.getElementById("tierLabel"),
  averageValue: document.getElementById("averageValue"),
  potentialValue: document.getElementById("potentialValue"),
  eyesValue: document.getElementById("eyesValue"),
  midfaceValue: document.getElementById("midfaceValue"),
  lowerThirdValue: document.getElementById("lowerThirdValue"),
  upperThirdValue: document.getElementById("upperThirdValue"),
  potentialBar: document.getElementById("potentialBar"),
  eyesBar: document.getElementById("eyesBar"),
  midfaceBar: document.getElementById("midfaceBar"),
  lowerThirdBar: document.getElementById("lowerThirdBar"),
  upperThirdBar: document.getElementById("upperThirdBar"),
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function seededHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function scoreToPercent(score) {
  return ((score - 1) / 6) * 100;
}

function colorForScore(score) {
  if (score >= 6.5) return "#4de1ff"; // true adam — neon light blue
  if (score >= 5.6) return "#54ff4f";
  if (score >= 4.7) return "#98ff52";
  if (score >= 3.6) return "#ffe44a";
  if (score >= 2.5) return "#ffb74a";
  return "#ff6e58";
}

function getTierLabel(score, gender) {
  const labelsMale = ["sub3", "sub5", "ltn", "mtn", "htn", "chad", "true adam"];
  const labelsFemale = ["sub3", "sub5", "ltb", "mtb", "htb", "stacy", "true eve"];
  const labels = gender === "female" ? labelsFemale : labelsMale;
  const idx = clamp(Math.round(score) - 1, 0, labels.length - 1);
  return labels[idx];
}

function recalcAverage() {
  const vals = metrics.map((m) => state[m.key]);
  state.average = vals.reduce((a, b) => a + b, 0) / vals.length;
  syncAverageControls();
}

function formatScore(v) {
  return Number(v).toFixed(1);
}

function updateMetricCards() {
  if (!refs.ratings.children.length) {
    refs.ratings.innerHTML = metrics
      .map((m) => {
        const score = state[m.key];
        const c = colorForScore(score);
        return `
          <div class="rating-row">
            <div class="rating-head">
              <span>${m.label}</span>
              <input
                class="rating-value-input"
                data-key="${m.key}"
                type="number"
                min="1"
                max="7"
                step="0.1"
                value="${formatScore(score)}"
                style="width:72px;background:#0b1020;border:1px solid #2b3658;border-radius:8px;color:${c};font-weight:800;padding:4px 6px;text-align:right;"
              />
            </div>
            <div class="bar"><span class="rating-bar-fill" data-key="${m.key}" style="width:${scoreToPercent(score)}%; color:${c}; background:${c};"></span></div>
          <input class="rating-slider" data-key="${m.key}" type="range" min="1" max="7" step="0.1" value="${formatScore(score)}" />
          </div>
        `;
      })
      .join("");

    refs.ratings.querySelectorAll(".rating-value-input").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.key;
        const raw = parseFloat(input.value);
        if (Number.isFinite(raw)) {
          state[key] = clamp(raw, 1, 7);
          recalcAverage();
          syncMetricRows();
          applyOverlay();
        }
      });

      const commitValue = () => {
        const key = input.dataset.key;
        const raw = parseFloat(input.value);
        const value = Number.isFinite(raw) ? clamp(raw, 1, 7) : state[key];
        state[key] = value;
        recalcAverage();
        syncMetricRows();
        applyOverlay();
      };

      input.addEventListener("change", commitValue);
      input.addEventListener("blur", commitValue);
    });

    refs.ratings.querySelectorAll(".rating-slider").forEach((slider) => {
      slider.addEventListener("input", () => {
        const key = slider.dataset.key;
        const value = clamp(parseFloat(slider.value), 1, 7);
        state[key] = value;
        recalcAverage();
        syncMetricRows();
        applyOverlay();
      });
    });
  }

  syncMetricRows();
}

function syncMetricRows() {
  const active = document.activeElement;
  refs.ratings.querySelectorAll(".rating-value-input").forEach((input) => {
    const key = input.dataset.key;
    const score = state[key];
    const color = colorForScore(score);
    if (input !== active) {
      input.value = formatScore(score);
    }
    input.style.color = color;
  });

  refs.ratings.querySelectorAll(".rating-bar-fill").forEach((bar) => {
    const key = bar.dataset.key;
    const score = state[key];
    const color = colorForScore(score);
    bar.style.width = `${scoreToPercent(score)}%`;
    bar.style.background = color;
    bar.style.color = color;
  });

  refs.ratings.querySelectorAll(".rating-slider").forEach((slider) => {
    const key = slider.dataset.key;
    const score = state[key];
    const color = colorForScore(score);
    slider.value = formatScore(score);
    slider.style.accentColor = color;
  });
}

function syncAverageControls() {
  if (!refs.averageRange || !refs.averageNumber) return;
  refs.averageRange.value = formatScore(state.average);
  refs.averageNumber.value = formatScore(state.average);
}

function applyOverlay() {
  refs.averageValue.textContent = formatScore(state.average);
  refs.tierLabel.textContent = getTierLabel(state.average, state.gender);
  refs.tierLabel.style.color = colorForScore(state.average);
  refs.potentialValue.textContent = formatScore(state.potential);
  refs.eyesValue.textContent = formatScore(state.eyes);
  refs.midfaceValue.textContent = formatScore(state.midface);
  refs.lowerThirdValue.textContent = formatScore(state.lowerThird);
  refs.upperThirdValue.textContent = formatScore(state.upperThird);

  refs.potentialBar.style.width = `${scoreToPercent(state.potential)}%`;
  refs.eyesBar.style.width = `${scoreToPercent(state.eyes)}%`;
  refs.midfaceBar.style.width = `${scoreToPercent(state.midface)}%`;
  refs.lowerThirdBar.style.width = `${scoreToPercent(state.lowerThird)}%`;
  refs.upperThirdBar.style.width = `${scoreToPercent(state.upperThird)}%`;

  refs.potentialBar.style.background = colorForScore(state.potential);
  refs.eyesBar.style.background = colorForScore(state.eyes);
  refs.midfaceBar.style.background = colorForScore(state.midface);
  refs.lowerThirdBar.style.background = colorForScore(state.lowerThird);
  refs.upperThirdBar.style.background = colorForScore(state.upperThird);
  void renderPreviewFromTemplate();
}

function applyImageTransform() {
  refs.image.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})`;
  refs.image.style.transformOrigin = "center center";
  void renderPreviewFromTemplate();
}

function bindAverageControl(rangeEl, numberEl) {
  if (!rangeEl || !numberEl) return;

  function update(v) {
    const raw = parseFloat(v);
    if (!Number.isFinite(raw)) return;
    state.average = clamp(raw, 1, 7);
    syncAverageControls();
    applyOverlay();
  }

  rangeEl.addEventListener("input", () => update(rangeEl.value));
  numberEl.addEventListener("input", () => update(numberEl.value));
  numberEl.addEventListener("blur", () => {
    update(numberEl.value);
  });
}

function bindImageControl(rangeEl, numberEl, key) {
  function updateFrom(v) {
    state[key] = parseFloat(v);
    rangeEl.value = String(state[key]);
    numberEl.value = String(state[key]);
    applyImageTransform();
  }
  rangeEl.addEventListener("input", () => updateFrom(rangeEl.value));
  numberEl.addEventListener("input", () => updateFrom(numberEl.value));
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function metricOverlayData() {
  return [
    { label: "POTENTIAL", key: "potential" },
    { label: "EYES", key: "eyes" },
    { label: "MIDFACE", key: "midface" },
    { label: "LOWER THIRD", key: "lowerThird" },
    { label: "UPPER THIRD", key: "upperThird" },
  ];
}

async function renderTemplateOnCanvas(ctx, W, H, viewportW, viewportH) {
  await Promise.all([ensureAppStoreIconLoaded(), ensureLimitlessIconLoaded()]);
  ctx.clearRect(0, 0, W, H);
  const previewW = Math.max(1, viewportW);
  const previewH = Math.max(1, viewportH);

  // Always paint the deep-blue base gradient. So if the photo doesn't cover
  // every pixel (zoomed out, panned, missing), we fade nicely into blue
  // instead of going black/transparent.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#18213d");
  bg.addColorStop(1, "#0a0f1e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (refs.image.src && refs.image.naturalWidth > 0) {
    const img = refs.image;
    const baseScale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const drawW = img.naturalWidth * baseScale * state.zoom;
    const drawH = img.naturalHeight * baseScale * state.zoom;
    const offsetX = state.offsetX * (W / previewW);
    const offsetY = state.offsetY * (H / previewH);
    const drawX = (W - drawW) / 2 + offsetX;
    const drawY = (H - drawH) / 2 + offsetY;

    // Draw to an offscreen canvas first so we can soft-fade the bottom edge
    // of the image into the blue background when it doesn't reach the
    // bottom of the canvas.
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const octx = off.getContext("2d");
    if (octx) {
      octx.drawImage(img, drawX, drawY, drawW, drawH);

      const imgBottom = drawY + drawH;
      if (imgBottom < H - 1) {
        const fadeH = Math.max(60, Math.min(220, drawH * 0.22));
        const fadeStart = Math.max(drawY, imgBottom - fadeH);
        octx.save();
        octx.globalCompositeOperation = "destination-out";
        const fadeGrad = octx.createLinearGradient(0, fadeStart, 0, imgBottom);
        fadeGrad.addColorStop(0, "rgba(0,0,0,0)");
        fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
        octx.fillStyle = fadeGrad;
        octx.fillRect(0, fadeStart, W, imgBottom - fadeStart);
        octx.restore();
      }

      ctx.drawImage(off, 0, 0);
    } else {
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
  }
  drawOverlayOnCanvas(ctx, W, H);
}

async function renderPreviewFromTemplate() {
  if (!refs.previewCanvas || !refs.phonePreview) return;
  const rect = refs.phonePreview.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;

  const canvas = refs.previewCanvas;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  await renderTemplateOnCanvas(ctx, cssW, cssH, cssW, cssH);
}

async function downloadTemplateImage() {
  const canvas = document.createElement("canvas");
  const W = 1080;
  const H = 1440; // 3:4 export
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const viewportRect = refs.phonePreview
    ? refs.phonePreview.getBoundingClientRect()
    : { width: W, height: H };

  await renderTemplateOnCanvas(
    ctx,
    W,
    H,
    Math.max(1, viewportRect.width),
    Math.max(1, viewportRect.height),
  );
  triggerCanvasDownload(canvas);
}

function drawOverlayOnCanvas(ctx, W, H) {
  const sx = W / 1080;
  const sy = H / 1920;
  const s = Math.min(sx, sy);

  // Dark fade overlay
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.25, "rgba(7,10,18,0.18)");
  g.addColorStop(0.70, "rgba(7,10,18,0.76)");
  g.addColorStop(1.00, "rgba(7,10,18,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const padX = 46 * sx;
  const gap = 38 * sx;
  const colW = (W - padX * 2 - gap) / 2;
  const startY = 1196 * sy;
  const rowGap = 226 * sy;

  // Top line
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `500 ${Math.round(66 * s)}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`;
  ctx.fillText("AVERAGE", padX, 962 * sy);

  const brandText = "LookScroll APP";
  const brandY = 958 * sy;
  const brandFontPx = Math.round(78 * s);
  ctx.font = `700 ${brandFontPx}px "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const brandTextW = ctx.measureText(brandText).width;
  const hasIcon = appStoreIcon.naturalWidth > 0;
  const hasLimitlessIconForLayout =
    limitlessAppIcon.naturalWidth > 0 && limitlessAppIcon.naturalHeight > 0;
  const smallIconSize = 78 * s;
  const smallIconGap = 14 * s;
  const brandToIconsGap = 24 * sx;
  const showBothSmall = hasIcon && hasLimitlessIconForLayout;
  const showAnySmallIcon = hasIcon || hasLimitlessIconForLayout;
  const smallIconsW = showBothSmall
    ? smallIconSize * 2 + smallIconGap
    : showAnySmallIcon
      ? smallIconSize
      : 0;
  const clusterW =
    brandTextW + (showAnySmallIcon ? brandToIconsGap + smallIconsW : 0);
  const clusterRightShift = 70 * sx;
  const clusterX = (W - clusterW) / 2 + clusterRightShift;
  const brandGroupX = clusterX;
  const brandTextX = brandGroupX;

  ctx.textAlign = "left";
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.85)";
  ctx.shadowBlur = 32 * s;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillText(brandText, brandTextX, brandY);
  ctx.shadowBlur = 18 * s;
  ctx.shadowColor = "rgba(140, 210, 255, 0.95)";
  ctx.fillStyle = "rgba(247,251,255,1)";
  ctx.fillText(brandText, brandTextX, brandY);
  ctx.shadowBlur = 0;
  ctx.fillText(brandText, brandTextX, brandY);
  ctx.restore();
  ctx.textAlign = "left";

  // App icons inline next to the brand text, top-right of the brand line.
  if (showAnySmallIcon) {
    const iconRowStartX = brandTextX + brandTextW + brandToIconsGap;
    const lkRadius = smallIconSize * 0.235; // iOS squircle approximation
    const iconsCenterY = brandY - brandFontPx * 0.34; // align with brand text middle
    const iconsTopY = iconsCenterY - smallIconSize / 2;
    const appIconX = iconRowStartX;
    const lkX = showBothSmall
      ? iconRowStartX + smallIconSize + smallIconGap
      : iconRowStartX;

    if (hasIcon) {
      ctx.save();
      ctx.shadowColor = "rgba(120, 200, 255, 0.55)";
      ctx.shadowBlur = 18 * s;
      ctx.beginPath();
      drawRoundedRect(ctx, appIconX, iconsTopY, smallIconSize, smallIconSize, lkRadius);
      ctx.clip();
      ctx.drawImage(appStoreIcon, appIconX, iconsTopY, smallIconSize, smallIconSize);
      ctx.restore();
    }

    if (hasLimitlessIconForLayout) {
      ctx.save();
      ctx.shadowColor = "rgba(120, 200, 255, 0.55)";
      ctx.shadowBlur = 18 * s;
      ctx.beginPath();
      drawRoundedRect(ctx, lkX, iconsTopY, smallIconSize, smallIconSize, lkRadius);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, lkX, iconsTopY, smallIconSize, smallIconSize, lkRadius);
      ctx.clip();
      ctx.drawImage(limitlessAppIcon, lkX, iconsTopY, smallIconSize, smallIconSize);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, lkX, iconsTopY, smallIconSize, smallIconSize, lkRadius);
      ctx.lineWidth = 2 * s;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.stroke();
      ctx.restore();
    }
  }

  // Main average number
  const avgScoreText = formatScore(state.average);
  const avgBaselineY = 1106 * sy;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(176 * s)}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`;
  ctx.fillText(avgScoreText, padX, avgBaselineY);
  const avgScoreW = ctx.measureText(avgScoreText).width;

  // Tier pill — right of the main average number, under the brand row.
  const tier = getTierLabel(state.average, state.gender).toUpperCase();
  const tierFontPx = Math.round(96 * s);
  ctx.font = `800 ${tierFontPx}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`;
  const tierPadX = 56 * sx;
  const tierTextW = ctx.measureText(tier).width;
  const tierW = tierTextW + tierPadX * 2;
  const tierH = 132 * sy;
  const tierX = padX + avgScoreW + 22 * sx;
  const tierY = avgBaselineY - tierH * 0.62;
  drawRoundedRect(ctx, tierX, tierY, tierW, tierH, tierH / 2);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  ctx.fillStyle = colorForScore(state.average);
  ctx.textAlign = "center";
  ctx.fillText(tier, tierX + tierW / 2, tierY + tierH * 0.72);
  ctx.textAlign = "left";

  // Metric grid
  const metricRows = metricOverlayData();
  metricRows.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = padX + col * (colW + gap);
    const y = startY + row * rowGap;
    const score = state[m.key];
    const barColor = colorForScore(score);

    const barW = colW * 0.86;
    const barX = x + (colW - barW) / 2;
    const barH = 22 * sy;
    const barR = Math.min(11 * s, barH / 2);

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(barX, y);
    ctx.lineTo(barX + barW, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `700 ${Math.round(46 * s)}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`;
    ctx.fillText(m.label, x, y + 54 * sy);

    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(126 * s)}px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`;
    ctx.fillText(formatScore(score), x, y + 158 * sy);

    const barY = y + 180 * sy;
    drawRoundedRect(ctx, barX, barY, barW, barH, barR);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    const pw = barW * (scoreToPercent(score) / 100);

    ctx.save();
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 22 * s;
    drawRoundedRect(ctx, barX, barY, pw, barH, barR);
    ctx.fillStyle = barColor;
    ctx.fill();
    ctx.shadowBlur = 12 * s;
    drawRoundedRect(ctx, barX, barY, pw, barH, barR);
    ctx.fill();
    ctx.restore();
  });
}

function triggerCanvasDownload(canvas) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "limitless-rating-template.png";
  a.click();
}

function generateRatings(seedSource) {
  const hash = seededHash(seedSource);
  metrics.forEach((m, idx) => {
    const t = ((hash >> (idx * 4)) & 255) / 255;
    state[m.key] = clamp(lerp(m.min, m.max, t), 1, 7);
  });
  recalcAverage();
}

function onImageSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    refs.image.src = reader.result;
    refs.image.style.display = "block";
    refs.placeholder.style.display = "none";
    generateRatings(`${file.name}|${file.size}|${file.lastModified}`);
    updateMetricCards();
    applyOverlay();
    applyImageTransform();
  };
  reader.readAsDataURL(file);
}

refs.input.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  onImageSelected(file);
});

window.addEventListener("resize", () => {
  void renderPreviewFromTemplate();
});

function setGender(gender) {
  state.gender = gender;
  refs.genderMaleBtn.classList.toggle("active", gender === "male");
  refs.genderFemaleBtn.classList.toggle("active", gender === "female");
  applyOverlay();
}

refs.genderMaleBtn.addEventListener("click", () => setGender("male"));
refs.genderFemaleBtn.addEventListener("click", () => setGender("female"));
if (refs.downloadBtn) {
  refs.downloadBtn.addEventListener("click", () => {
    void downloadTemplateImage();
  });
}

bindImageControl(refs.zoomRange, refs.zoomNumber, "zoom");
bindImageControl(refs.xRange, refs.xNumber, "offsetX");
bindImageControl(refs.yRange, refs.yNumber, "offsetY");
bindAverageControl(refs.averageRange, refs.averageNumber);

(function syncPreviewAppStoreIcon() {
  const el = document.getElementById("appStoreBrandIcon");
  if (el) el.src = APP_STORE_ICON_DATA_URL;
})();

updateMetricCards();
setGender(state.gender);
syncAverageControls();
applyOverlay();
applyImageTransform();
void renderPreviewFromTemplate();
