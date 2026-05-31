/**
 * Focus marketing template — 1:1 iOS FocusProgressSection (3:4).
 */

const APP_ICONS = [
  { id: 'instagram', label: 'Instagram', src: 'assets/app-icons/instagram.jpg', iconDataUrl: '' },
  { id: 'tiktok', label: 'TikTok', src: 'assets/app-icons/tiktok.jpg', iconDataUrl: '' },
  { id: 'clash', label: 'Clash Royale', src: 'assets/app-icons/clash-royale.jpg', iconDataUrl: '' }
];

const assetDataUrlCache = new Map();

/** Echte SF Symbols (aus macOS exportiert) — 1:1 wie Image(systemName:) in der App */
const SF_FLOW = 'assets/sf-flow';

const ICONS = {
  lockShield: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.1 5 4.9v5.6c0 4.4 3 8.6 7 10.4 4-1.8 7-6 7-10.4V4.9L12 2.1zm0 1.8 5.5 2.2v5.4c0 3.5-2.3 6.8-5.5 8.2-3.2-1.4-5.5-4.7-5.5-8.2V6.1L12 3.9z"/><path d="M9.2 11.4V9.9a2.8 2.8 0 1 1 5.6 0v1.5H9.2zm-1.1 0h7.8c.6 0 1.1.5 1.1 1.1v3.6c0 .6-.5 1.1-1.1 1.1H8.1c-.6 0-1.1-.5-1.1-1.1v-3.6c0-.6.5-1.1 1.1-1.1z"/></svg>`,
  lockFill: `<svg viewBox="0 0 12 12" fill="#fff" aria-hidden="true"><path d="M2.2 5.2V3.6a2.8 2.8 0 1 1 5.6 0v1.6H2.2zm-.9 0h7.4c.5 0 .9.4.9.9v3.4c0 .5-.4.9-.9.9H1.3c-.5 0-.9-.4-.9-.9V6.1c0-.5.4-.9.9-.9z"/></svg>`,
  flowBlocked: `${SF_FLOW}/lock-fill-red.png`,
  flowUnlock: `${SF_FLOW}/figure-run-orange.png`,
  flowUnlockDone: `${SF_FLOW}/checkmark-circle-fill-green.png`,
  flowOpen: `${SF_FLOW}/lock-open-fill-blue.png`,
  flowOpenDone: `${SF_FLOW}/lock-open-fill-green.png`,
  flowArrow: `${SF_FLOW}/arrow-right-gray.png`,
  bolt: `${SF_FLOW}/bolt-fill-orange.png`
};

function sfIconImg(src, alt) {
  const url = resolveAssetUrl(src);
  return `<img class="sf-icon" src="${escapeAttr(url)}" width="13" height="13" alt="${escapeAttr(alt)}" decoding="sync" crossorigin="anonymous">`;
}

const MESH_PLACEHOLDER_SVG = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><path stroke="rgba(255,255,255,0.35)" stroke-width="0.6" d="M60 18c-14 0-26 10-28 24-2 18 12 34 28 34s30-16 28-34c-2-14-14-24-28-24z"/><path stroke="rgba(255,255,255,0.2)" stroke-width="0.5" d="M32 52c8 6 20 10 28 10s20-4 28-10M40 68c6 8 14 12 20 12s14-4 20-12M48 82c4 6 8 8 12 8s8-2 12-8"/></svg>`;

/** 1:1 AlarmTaskType aus AppState.swift (CaseIterable-Reihenfolge) */
const APP_TASK_CATALOG = [
  {
    id: 'drinkWater',
    name: 'Drink 1L Water',
    marketingBenefit: '1L water · reduces debloat',
    accent: '#32d2ff',
    emoji: '💧'
  },
  {
    id: 'mealPhoto',
    name: 'Log Meal',
    marketingBenefit: 'Healthy meal · stay on track',
    accent: '#34c759',
    emoji: '🍽️'
  },
  {
    id: 'supplements',
    name: 'Take Supplements',
    marketingBenefit: 'Daily stack · skin & recovery',
    accent: '#af52de',
    emoji: '💊'
  },
  {
    id: 'jawExercise',
    name: 'Jaw Exercise',
    marketingBenefit: 'Jaw reps · sharper jawline',
    accent: '#ff9500',
    emoji: '😬'
  },
  {
    id: 'eyebrowRaises',
    name: 'Eyebrow Raises',
    marketingBenefit: 'Brow lifts · brighter eye area',
    accent: '#ff2d55',
    emoji: '🤨'
  },
  {
    id: 'neckStretches',
    name: 'Neck Stretches',
    marketingBenefit: 'Neck mobility · better symmetry',
    accent: '#63e6e2',
    emoji: '🔄'
  },
  {
    id: 'fishFace',
    name: 'Fish Face',
    marketingBenefit: 'Cheek holds · sculpt midface',
    accent: '#5856d6',
    emoji: '🐟'
  },
  {
    id: 'cheekLifts',
    name: 'Cheek Lifts',
    marketingBenefit: 'Cheek lifts · define cheekbones',
    accent: '#ffd60a',
    emoji: '😊'
  },
  {
    id: 'jawSideToSide',
    name: 'Jaw Side-to-Side',
    marketingBenefit: 'Side jaw reps · jaw angles',
    accent: '#ff9933',
    emoji: '↔️'
  },
  {
    id: 'headRotations',
    name: 'Head Rotations',
    marketingBenefit: 'Head turns · balance posture',
    accent: '#66b2ff',
    emoji: '🔁'
  },
  {
    id: 'oShapeMouth',
    name: 'O-Shape Mouth',
    marketingBenefit: 'Lip holds · tone perioral area',
    accent: '#cc66cc',
    emoji: '⭕'
  }
];

function getAppTask(id) {
  return APP_TASK_CATALOG.find((t) => t.id === id) || APP_TASK_CATALOG[0];
}

function parseMarketingBenefit(benefit) {
  const parts = benefit.split(' · ').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const sub = parts.slice(1).join(' · ');
    return {
      benefitMain: parts[0].toUpperCase(),
      benefitSub: sub.charAt(0).toUpperCase() + sub.slice(1)
    };
  }
  return { benefitMain: benefit.toUpperCase(), benefitSub: '' };
}

function resolveTaskRow(slot) {
  const def = getAppTask(slot.taskId);
  const benefit = parseMarketingBenefit(def.marketingBenefit);
  return {
    taskId: def.id,
    name: def.name,
    benefitMain: benefit.benefitMain,
    benefitSub: benefit.benefitSub,
    accent: def.accent,
    emoji: def.emoji,
    done: slot.done,
    required: slot.required
  };
}

const defaultState = {
  score: 62,
  potential: 78,
  faceImageUrl: '',
  locked: true,
  tasks: [
    { taskId: 'drinkWater', done: 0, required: 3 },
    { taskId: 'jawExercise', done: 1, required: 3 }
  ]
};

let state = structuredClone(defaultState);

function tierAccent(score100) {
  const r = Math.round(Math.max(0, Math.min(100, score100)) / 10);
  if (r <= 3) return '#ff3b30';
  if (r <= 5) return '#64d2ff';
  if (r === 6) return '#0a84ff';
  if (r === 7) return '#ff9500';
  return '#ff2d55';
}

function tierLabel(score100) {
  const r = Math.round(Math.max(0, Math.min(100, score100)) / 10);
  if (r <= 3) return 'SUB 3';
  if (r <= 5) return 'SUB 5';
  if (r === 6) return 'LTN';
  if (r === 7) return 'MTN';
  if (r === 8) return 'HTN';
  if (r === 9) return 'CHAD';
  return 'TRUE ADAM';
}

function formatPsl(score100) {
  const v = Math.max(1, Math.min(10, score100 / 10));
  return v.toFixed(1).replace('.', ',');
}

function scoreBlockHtml(label, score100) {
  const accent = tierAccent(score100);
  const pct = Math.max(0, Math.min(100, score100));
  return `
    <div class="score-block" style="--block-accent:${accent}">
      <span class="label">${label}</span>
      <span class="value">${formatPsl(score100)}</span>
      <div class="tier-row">
        <span class="tier-dot"></span>
        <span class="tier-label">${tierLabel(score100)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function meshTileHtml() {
  const url = state.faceImageUrl?.trim();
  if (url) {
    return `<div class="mesh-tile"><img src="${escapeAttr(url)}" alt="Face mesh" onerror="this.parentElement.innerHTML=window.meshPlaceholderInner()"></div>`;
  }
  return `<div class="mesh-tile"><div class="mesh-placeholder">${MESH_PLACEHOLDER_SVG}</div></div>`;
}

function meshPlaceholderInner() {
  return `<div class="mesh-placeholder">${MESH_PLACEHOLDER_SVG}</div>`;
}
window.meshPlaceholderInner = meshPlaceholderInner;

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^(data:|blob:|https?:)/i.test(path)) return path;
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImageAsDataUrl(url) {
  const absolute = resolveAssetUrl(url);
  if (!absolute) throw new Error('Empty image URL');
  if (absolute.startsWith('data:')) return absolute;
  if (assetDataUrlCache.has(absolute)) return assetDataUrlCache.get(absolute);

  let dataUrl;
  try {
    const res = await fetch(absolute);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    dataUrl = await blobToDataUrl(await res.blob());
  } catch (fetchErr) {
    dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 80;
          canvas.height = img.naturalHeight || 80;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(fetchErr);
      img.src = absolute;
    });
  }

  assetDataUrlCache.set(absolute, dataUrl);
  return dataUrl;
}

async function ensureAppIconsReady() {
  await Promise.all(
    APP_ICONS.map(async (app) => {
      app.iconDataUrl = await loadImageAsDataUrl(app.src);
    })
  );
}

function appIconsHtml() {
  return APP_ICONS.map((app) => {
    const src = app.iconDataUrl || resolveAssetUrl(app.src);
    return `
    <div class="app-icon-wrap">
      <div class="app-icon">
        <img src="${escapeAttr(src)}" alt="${escapeAttr(app.label)}" width="80" height="80" loading="eager" decoding="sync" crossorigin="anonymous">
      </div>
      <span class="lock-badge">${ICONS.lockFill}</span>
    </div>`;
  }).join('');
}

function taskRowHtml(slot) {
  const task = resolveTaskRow(slot);
  const frac = task.required > 0 ? task.done / task.required : 0;
  const pct = Math.min(100, Math.max(4, frac * 100));
  return `
    <article class="task-row" style="--thumb-accent:${task.accent}">
      <div class="task-row-top">
        <div class="task-thumb">${task.emoji}</div>
        <div class="task-copy">
          <div class="task-title-row">
            <span class="name">${escapeHtml(task.name)}</span>
            <span class="sets">${task.done}/${task.required} sets</span>
          </div>
          <div class="task-benefit-main">${escapeHtml(task.benefitMain)}</div>
          <div class="task-benefit-sub">${escapeHtml(task.benefitSub)}</div>
        </div>
      </div>
      <div class="task-bar-track">
        <div class="task-bar-fill" style="width:${pct}%"></div>
      </div>
    </article>`;
}

function allTasksComplete() {
  return state.tasks.length > 0 && state.tasks.every((t) => t.done >= t.required);
}

function appsSubtitle() {
  const n = APP_ICONS.length;
  if (allTasksComplete()) return `${n} apps · set done — tap below to unlock`;
  return `${n} apps · locked until unlock set is done`;
}

function flowBridgeHtml() {
  const done = allTasksComplete();
  const midSrc = done ? ICONS.flowUnlockDone : ICONS.flowUnlock;
  const openSrc = done ? ICONS.flowOpenDone : ICONS.flowOpen;

  return `
    <div class="flow-bridge">
      <div class="flow-step">
        <span class="flow-ico">${sfIconImg(ICONS.flowBlocked, 'Blocked')}</span>
        <span>Blocked</span>
      </div>
      <span class="flow-arrow">${sfIconImg(ICONS.flowArrow, '')}</span>
      <div class="flow-step">
        <span class="flow-ico">${sfIconImg(midSrc, done ? 'Set done' : 'Unlock set')}</span>
        <span>${done ? 'Set done' : 'Unlock set'}</span>
      </div>
      <span class="flow-arrow">${sfIconImg(ICONS.flowArrow, '')}</span>
      <div class="flow-step">
        <span class="flow-ico">${sfIconImg(openSrc, 'Apps open')}</span>
        <span>Apps open</span>
      </div>
    </div>`;
}

function renderCard() {
  const card = document.getElementById('marketingCard');
  const lockedBadge = state.locked
    ? '<span class="badge-locked">LOCKED</span>'
    : '<span class="badge-locked badge-locked--off">OFF</span>';

  card.innerHTML = `
    <section class="zone zone-score">
      <div class="score-pair">
        ${scoreBlockHtml('SCORE', state.score)}
        ${scoreBlockHtml('POTENTIAL', state.potential)}
      </div>
      ${meshTileHtml()}
    </section>
    <section class="zone zone-apps">
      <div class="apps-strip">
        <div class="apps-head">
          <span class="shield" aria-hidden="true">${ICONS.lockShield}</span>
          <div class="titles">
            <h3>Apps blocked</h3>
            <p>${escapeHtml(appsSubtitle())}</p>
          </div>
          ${lockedBadge}
        </div>
        <div class="app-icons">${appIconsHtml()}</div>
      </div>
    </section>
    ${flowBridgeHtml()}
    <section class="zone zone-tasks">
      <div class="tasks-zone">
        <div class="tasks-head">
          <span class="bolt" aria-hidden="true"><img class="sf-icon sf-icon--bolt" src="${escapeAttr(ICONS.bolt)}" width="13" height="13" alt="" decoding="async"></span>
          <span>Complete unlock tasks to open apps</span>
        </div>
        <div class="task-list">${state.tasks.map(taskRowHtml).join('')}</div>
      </div>
    </section>`;
  requestAnimationFrame(updatePreviewSizeLabel);
}

function taskPickerHtml(slot, slotIndex) {
  return APP_TASK_CATALOG.map((def) => {
    const selected = slot.taskId === def.id;
    const usedElsewhere = state.tasks.some((s, j) => j !== slotIndex && s.taskId === def.id);
    const disabled = !selected && usedElsewhere;
    return `<button type="button" class="task-pick-btn${selected ? ' is-active' : ''}"
      data-k="taskId" data-v="${escapeAttr(def.id)}"
      style="--pick-accent:${def.accent}"
      ${disabled ? 'disabled' : ''}
      aria-pressed="${selected}">
      <span class="task-pick-emoji" aria-hidden="true">${def.emoji}</span>
      <span class="task-pick-name">${escapeHtml(def.name)}</span>
    </button>`;
  }).join('');
}

function renderTaskEditors() {
  const wrap = document.getElementById('taskPanels');
  wrap.innerHTML =
    `<h2>Unlock tasks (2)</h2>
    <p class="task-editor-hint">Task per Button wählen — jede Übung nur einmal. Beide Zeilen in der Vorschau sichtbar.</p>` +
    state.tasks
      .map((slot, i) => {
        const preview = resolveTaskRow(slot);
        return `
    <div class="task-editor" data-idx="${i}">
      <h3>Task ${i + 1}</h3>
      <div class="field">
        <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.55)">App-Task</span>
        <div class="task-picker" role="group" aria-label="Task ${i + 1}">${taskPickerHtml(slot, i)}</div>
      </div>
      <p class="task-benefit-preview">${escapeHtml(preview.benefitMain)} · <span style="color:${preview.accent}">${escapeHtml(preview.benefitSub)}</span></p>
      <label class="field">Required sets<input type="number" data-k="required" min="1" max="99" value="${slot.required}"></label>
    </div>`;
      })
      .join('');

  wrap.querySelectorAll('.task-editor input[type="number"]').forEach((el) => {
    el.addEventListener('input', onTaskEditorChange);
    el.addEventListener('change', onTaskEditorChange);
  });
}

function onTaskEditorChange(e) {
  const editor = e.target.closest('.task-editor');
  if (!editor) return;
  const idx = Number(editor.dataset.idx);
  const k = e.target.dataset.k;
  let v = e.target.value;
  if (k === 'required') v = Number(v);
  if (k === 'taskId') {
    const usedElsewhere = state.tasks.some((s, j) => j !== idx && s.taskId === v);
    if (usedElsewhere) return;
  }
  state.tasks[idx][k] = v;
  renderTaskEditors();
  renderCard();
}

function onTaskPanelsClick(e) {
  const btn = e.target.closest('.task-pick-btn');
  if (!btn || btn.disabled) return;
  const editor = btn.closest('.task-editor');
  if (!editor) return;
  const idx = Number(editor.dataset.idx);
  const v = btn.dataset.v;
  const usedElsewhere = state.tasks.some((s, j) => j !== idx && s.taskId === v);
  if (usedElsewhere) return;
  state.tasks[idx].taskId = v;
  renderTaskEditors();
  renderCard();
}

function syncFaceImageControls() {
  const hasImage = Boolean(state.faceImageUrl?.trim());
  const clearBtn = document.getElementById('faceImageClear');
  if (clearBtn) clearBtn.hidden = !hasImage;
}

function bindControls() {
  const scoreR = document.getElementById('scoreRange');
  const potR = document.getElementById('potentialRange');
  const scoreV = document.getElementById('scoreVal');
  const potV = document.getElementById('potentialVal');
  const faceUrl = document.getElementById('faceImageUrl');
  const faceFile = document.getElementById('faceImageFile');
  const facePick = document.getElementById('faceImagePick');
  const faceClear = document.getElementById('faceImageClear');
  const taskPanels = document.getElementById('taskPanels');
  const locked = document.getElementById('lockedBadge');

  scoreR.addEventListener('input', () => {
    state.score = Number(scoreR.value);
    scoreV.textContent = state.score;
    renderCard();
  });
  potR.addEventListener('input', () => {
    state.potential = Number(potR.value);
    potV.textContent = state.potential;
    renderCard();
  });
  faceUrl.addEventListener('input', () => {
    state.faceImageUrl = faceUrl.value.trim();
    if (faceFile) faceFile.value = '';
    syncFaceImageControls();
    renderCard();
  });
  facePick?.addEventListener('click', () => faceFile?.click());
  faceFile?.addEventListener('change', () => {
    const file = faceFile.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.faceImageUrl = reader.result;
      faceUrl.value = '';
      syncFaceImageControls();
      renderCard();
    };
    reader.readAsDataURL(file);
  });
  faceClear?.addEventListener('click', () => {
    state.faceImageUrl = '';
    faceUrl.value = '';
    if (faceFile) faceFile.value = '';
    syncFaceImageControls();
    renderCard();
  });
  taskPanels?.addEventListener('click', onTaskPanelsClick);
  locked.addEventListener('change', () => {
    state.locked = locked.checked;
    renderCard();
  });
  syncFaceImageControls();
}

function updatePreviewSizeLabel() {
  const shell = document.querySelector('.preview-card-shell');
  const label = document.getElementById('previewSizeLabel');
  if (!shell || !label) return;
  const w = Math.round(shell.getBoundingClientRect().width);
  const h = Math.round(shell.getBoundingClientRect().height);
  label.textContent = `${w}×${h}`;
}

/** Liest die sichtbare 3:4-Vorschau aus dem DOM (wie auf dem Bildschirm). */
function getPreviewExportTarget() {
  const shell = document.querySelector('.preview-card-shell');
  const card = document.getElementById('marketingCard');
  const el = shell || card;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));
  const targetW = 1024;
  const pixelRatio = targetW / cssW;
  return {
    el: card || el,
    cssW,
    cssH,
    pixelRatio,
    outW: Math.round(cssW * pixelRatio),
    outH: Math.round(cssH * pixelRatio)
  };
}

function waitForImage(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

async function inlineImagesForExport(root) {
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(
    imgs.map(async (img) => {
      await waitForImage(img);
      const raw = img.getAttribute('src') || img.currentSrc || img.src;
      if (!raw || raw.startsWith('data:')) return;
      try {
        img.src = await loadImageAsDataUrl(raw);
        img.removeAttribute('srcset');
      } catch (e) {
        console.warn('Could not inline image for export:', raw, e);
      }
    })
  );
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
    await ensureAppIconsReady();
    renderCard();
    await waitForNextFrame();
    await inlineImagesForExport(el);
    await waitForNextFrame();
    const blob = await htmlToImage.toBlob(el, {
      pixelRatio,
      backgroundColor: 'rgb(15, 15, 18)',
      cacheBust: false
    });

    if (!blob) throw new Error('Empty blob');

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lookscroll-focus-marketing-${outW}x${outH}.png`;
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

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

bindControls();
bindDownload();
renderTaskEditors();
ensureAppIconsReady()
  .then(() => {
    renderCard();
    syncFaceImageControls();
    updatePreviewSizeLabel();
  })
  .catch((e) => {
    console.warn('App icons preload failed:', e);
    renderCard();
    syncFaceImageControls();
    updatePreviewSizeLabel();
  });
window.addEventListener('resize', updatePreviewSizeLabel);
