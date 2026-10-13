import { state } from './state.js';
import { previewCanvas, hiddenVideo, renderCanvasFrame, getCanvasMousePos } from './canvas.js';
import { applyVideoToCanvas, applyImageToCanvas, dropzone } from './media.js';
import { 
  togglePlay, 
  updatePlaybackProgress, 
  setupTextTimelineClip, 
  btnPlayPause, 
  registerSelectionCallback 
} from './timeline.js';

// --- SELETORES DO DOM ---
const mediaInput = document.getElementById('media-input');
const stageWrapper = document.getElementById('stage-wrapper');

// Abas e Painéis
const toolButtons = document.querySelectorAll('.tool-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const btnCloseSubpanels = document.querySelectorAll('.btn-close-subpanel');

// Slots
const slotVideo = document.getElementById('slot-video');
const slotOverlay = document.getElementById('slot-overlay');

// Input Dinâmico de Imagens
const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = 'image/*';
imageInput.style.display = 'none';
document.body.appendChild(imageInput);

// Cache de ficheiros dos Slots
let stagedVideoFile = null;
let stagedImageFile = null;

// Aspect Ratio
const btnAspectRatio = document.getElementById('btn-aspect-ratio');
const aspectDropdown = document.getElementById('aspect-dropdown-menu');
const currentRatioLabel = document.getElementById('current-ratio-label');
const ratioItems = document.querySelectorAll('.ratio-item');

// Timeline & Transporte
const timelineTracksArea = document.getElementById('timeline-scroll-area');
const btnBack5s = document.getElementById('btn-back-5s');
const btnForward5s = document.getElementById('btn-forward-5s');
const secondaryClip = document.getElementById('secondary-clip');
const secondaryClipTitle = document.getElementById('secondary-clip-title');
const btnDelete = document.getElementById('tl-delete');
const timelineResizer = document.getElementById('timeline-resizer');
const timelineContainer = document.getElementById('timeline-container');

// Legenda
const subtitleTextarea = document.getElementById('subtitle-text');
const btnClearText = document.getElementById('btn-clear-text');
const fontFamilySelect = document.getElementById('font-family-select');
const fontWeightSelect = document.getElementById('font-weight-select');
const fontSizeSelect = document.getElementById('font-size-select');
const textColorPicker = document.getElementById('text-color-picker');
const bgColorPicker = document.getElementById('bg-color-picker');
const noBackgroundCheck = document.getElementById('no-background-check');
const btnApplySubtitle = document.getElementById('btn-apply');
const btnUppercase = document.getElementById('btn-uppercase');

// Notifica a timeline sobre mudanças de seleção para atualizar o botão Excluir
registerSelectionCallback(updateDeleteButtonState);

// --- 1. ALTERNÂNCIA DE ABAS LATERAIS ---
toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetPanel = btn.getAttribute('data-panel');
    if (targetPanel === 'video') {
      mediaInput.click();
      return;
    }
    if (targetPanel === 'imagem') {
      imageInput.click();
      return;
    }

    toolButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    tabPanels.forEach(p => p.classList.remove('active'));
    const activeSection = document.getElementById(`panel-${targetPanel}`);
    if (activeSection) activeSection.classList.add('active');
  });
});

btnCloseSubpanels.forEach(btn => {
  btn.addEventListener('click', () => {
    tabPanels.forEach(p => p.classList.remove('active'));
    const panelLegenda = document.getElementById('panel-legenda');
    if (panelLegenda) panelLegenda.classList.add('active');
    toolButtons.forEach(b => b.classList.remove('active'));
    const btnLegenda = document.querySelector('.tool-btn[data-panel="legenda"]');
    if (btnLegenda) btnLegenda.classList.add('active');
  });
});

// --- 2. PAINEL DE EFEITOS ---
const effectCards = document.querySelectorAll('.effect-card');
effectCards.forEach(card => {
  card.addEventListener('click', () => {
    const effectName = card.getAttribute('data-fx');
    if (state.activeEffect === effectName) {
      state.activeEffect = null;
      card.classList.remove('active');
    } else {
      effectCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.activeEffect = effectName;
    }
    renderCanvasFrame();
  });
});

// --- 3. PAINEL DE TEXTOS PRÉ-FORMATADOS ---
const textPresets = document.querySelectorAll('[data-text-style]');
textPresets.forEach(preset => {
  preset.addEventListener('click', () => {
    const styleType = preset.getAttribute('data-text-style');
    let label = 'Novo Texto';

    if (styleType === 'creator') label = 'CREATOR';
    else if (styleType === 'textbox') label = 'Text Box';
    else if (styleType === 'pride') label = 'Pride';
    else if (styleType === 'button') label = 'Button';
    else if (styleType === 'bubble') label = 'Bubble';
    else if (styleType === 'retro') label = 'RETRO';
    else if (styleType === 'typewriter') label = 'Máquina|';
    else if (styleType === 'circular') label = 'Circular';
    else if (styleType === 'groovy') label = 'GROOVY';
    else if (styleType === 'neon-box') label = 'Título Nítido';
    else if (styleType === 'mare') label = 'MARÉ';

    state.customText.active = true;
    state.customText.style = styleType;
    state.customText.text = label;
    state.customText.x = (previewCanvas.width - 320) / 2;
    state.customText.y = (previewCanvas.height - 120) / 2;
    state.customText.width = 320;
    state.customText.height = 100;

    setupTextTimelineClip(label);

    if (secondaryClip) {
      secondaryClip.style.display = 'flex';
      if (secondaryClipTitle) secondaryClipTitle.textContent = label;
    }

    renderCanvasFrame();
  });
});

// --- 4. MENU DE FORMATOS (ASPECT RATIO) ---
btnAspectRatio.addEventListener('click', (e) => {
  e.stopPropagation();
  aspectDropdown.classList.toggle('active');
});

document.addEventListener('click', () => {
  aspectDropdown.classList.remove('active');
});

ratioItems.forEach(item => {
  item.addEventListener('click', () => {
    ratioItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const ratioStr = item.getAttribute('data-ratio');
    currentRatioLabel.textContent = `Tamanho (${ratioStr})`;
    stageWrapper.style.aspectRatio = ratioStr;

    const [w, h] = ratioStr.split('/').map(Number);
    state.aspectRatio = w / h;
    previewCanvas.width = 1080 * (w / h);
    previewCanvas.height = 1080;

    renderCanvasFrame();
  });
});

// --- 5. SLOTS LATERAIS ---
slotVideo.addEventListener('click', (e) => {
  if (!e.target.closest('.slot-remove-btn') && !stagedVideoFile) {
    mediaInput.click();
  }
});

slotOverlay.addEventListener('click', (e) => {
  if (!e.target.closest('.slot-remove-btn') && !stagedImageFile) {
    imageInput.click();
  }
});

mediaInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stagedVideoFile = file;

  const url = URL.createObjectURL(file);
  slotVideo.innerHTML = `
    <div class="slot-preview-wrapper" draggable="true" title="Arraste para o canvas">
      <video src="${url}" muted></video>
      <button class="slot-remove-btn" title="Remover">&times;</button>
    </div>
  `;

  const preview = slotVideo.querySelector('.slot-preview-wrapper');
  preview.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/plain', 'slot-video');
  });

  slotVideo.querySelector('.slot-remove-btn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    stagedVideoFile = null;
    mediaInput.value = '';
    slotVideo.innerHTML = '<button class="slot-add-btn"><i class="fa-solid fa-plus"></i></button>';
  });
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stagedImageFile = file;

  const url = URL.createObjectURL(file);
  slotOverlay.innerHTML = `
    <div class="slot-preview-wrapper" draggable="true" title="Arraste para o canvas">
      <img src="${url}" alt="Preview">
      <button class="slot-remove-btn" title="Remover">&times;</button>
    </div>
  `;

  const preview = slotOverlay.querySelector('.slot-preview-wrapper');
  preview.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/plain', 'slot-image');
  });

  slotOverlay.querySelector('.slot-remove-btn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    stagedImageFile = null;
    imageInput.value = '';
    slotOverlay.innerHTML = '<button class="slot-add-btn"><i class="fa-solid fa-plus"></i></button>';
  });
});

// --- 6. DRAG & DROP NO CANVAS ---
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
  e.preventDefault();
  const draggedType = e.dataTransfer.getData('text/plain');

  if (draggedType === 'slot-video' && stagedVideoFile) {
    applyVideoToCanvas(stagedVideoFile);
  } else if (draggedType === 'slot-image' && stagedImageFile) {
    applyImageToCanvas(stagedImageFile, updateDeleteButtonState);
  } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('video/')) applyVideoToCanvas(file);
    else if (file.type.startsWith('image/')) applyImageToCanvas(file, updateDeleteButtonState);
  }
}

[stageWrapper, previewCanvas, dropzone].forEach(el => {
  if (el) {
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('drop', handleDrop);
  }
});

dropzone.addEventListener('click', () => mediaInput.click());

// --- 7. CONTROLES DE TRANSPORTE E TIMELINE ---
btnPlayPause.addEventListener('click', togglePlay);

btnBack5s.addEventListener('click', () => {
  if (state.videoLoaded) {
    hiddenVideo.currentTime = Math.max(0, hiddenVideo.currentTime - 5);
    updatePlaybackProgress();
    renderCanvasFrame();
  }
});

btnForward5s.addEventListener('click', () => {
  if (state.videoLoaded) {
    hiddenVideo.currentTime = Math.min(state.duration, hiddenVideo.currentTime + 5);
    updatePlaybackProgress();
    renderCanvasFrame();
  }
});

timelineTracksArea.addEventListener('click', (e) => {
  if (!state.videoLoaded) return;
  const rect = timelineTracksArea.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));

  hiddenVideo.currentTime = clickPercent * state.duration;
  updatePlaybackProgress();
  renderCanvasFrame();
});

// --- 8. EVENTOS DE LEGENDA ---
btnApplySubtitle.addEventListener('click', () => {
  state.subtitle.text = subtitleTextarea.value;
  state.subtitle.font = fontFamilySelect.value;
  state.subtitle.weight = fontWeightSelect.value;
  state.subtitle.size = parseInt(fontSizeSelect.value, 10);
  state.subtitle.color = textColorPicker.value;
  state.subtitle.backgroundColor = bgColorPicker.value;
  state.subtitle.noBackground = noBackgroundCheck.checked;
  renderCanvasFrame();
});

btnClearText.addEventListener('click', () => {
  subtitleTextarea.value = '';
  state.subtitle.text = '';
  renderCanvasFrame();
});

btnUppercase.addEventListener('click', () => {
  state.subtitle.uppercase = !state.subtitle.uppercase;
  btnUppercase.classList.toggle('active', state.subtitle.uppercase);
  renderCanvasFrame();
});

// --- 9. INTERAÇÃO DO MOUSE NO CANVAS (SELEÇÃO, DRAG E RESIZE) ---
previewCanvas.addEventListener('mousedown', (e) => {
  const pos = getCanvasMousePos(e);

  if (state.customText.active) {
    const t = state.customText;
    if (Math.abs(pos.x - (t.x + t.width)) <= 20 && Math.abs(pos.y - (t.y + t.height)) <= 20) {
      state.selectedElement = 'text';
      updateDeleteButtonState();
      t.isResizing = true;
      renderCanvasFrame();
      return;
    }
    if (pos.x >= t.x && pos.x <= t.x + t.width && pos.y >= t.y && pos.y <= t.y + t.height) {
      state.selectedElement = 'text';
      updateDeleteButtonState();
      t.isDragging = true;
      t.dragStartX = pos.x - t.x;
      t.dragStartY = pos.y - t.y;
      renderCanvasFrame();
      return;
    }
  }

  if (state.overlay.img) {
    const ov = state.overlay;
    if (Math.abs(pos.x - (ov.x + ov.width)) <= 20 && Math.abs(pos.y - (ov.y + ov.height)) <= 20) {
      state.selectedElement = 'overlay';
      updateDeleteButtonState();
      ov.isResizing = true;
      renderCanvasFrame();
      return;
    }
    if (pos.x >= ov.x && pos.x <= ov.x + ov.width && pos.y >= ov.y && pos.y <= ov.y + ov.height) {
      state.selectedElement = 'overlay';
      updateDeleteButtonState();
      ov.isDragging = true;
      ov.dragStartX = pos.x - ov.x;
      ov.dragStartY = pos.y - ov.y;
      renderCanvasFrame();
      return;
    }
  }

  if (state.videoLoaded && state.videoRect) {
    const vr = state.videoRect;
    if (pos.x >= vr.x && pos.x <= vr.x + vr.width && pos.y >= vr.y && pos.y <= vr.y + vr.height) {
      state.selectedElement = 'video';
      updateDeleteButtonState();
      renderCanvasFrame();
      return;
    }
  }

  state.selectedElement = null;
  updateDeleteButtonState();
  renderCanvasFrame();
});

window.addEventListener('mousemove', (e) => {
  const pos = getCanvasMousePos(e);

  if (state.customText.active) {
    const t = state.customText;
    if (t.isResizing) {
      t.width = Math.max(100, pos.x - t.x);
      t.height = Math.max(40, pos.y - t.y);
      renderCanvasFrame();
      return;
    }
    if (t.isDragging) {
      t.x = pos.x - t.dragStartX;
      t.y = pos.y - t.dragStartY;
      renderCanvasFrame();
      return;
    }
  }

  if (state.overlay.img) {
    const ov = state.overlay;
    if (ov.isResizing) {
      const newWidth = Math.max(40, pos.x - ov.x);
      const ratio = ov.img.naturalHeight / ov.img.naturalWidth;
      ov.width = newWidth;
      ov.height = newWidth * ratio;
      renderCanvasFrame();
      return;
    }
    if (ov.isDragging) {
      ov.x = pos.x - ov.dragStartX;
      ov.y = pos.y - ov.dragStartY;
      renderCanvasFrame();
    }
  }
});

window.addEventListener('mouseup', () => {
  if (state.overlay.img) {
    state.overlay.isDragging = false;
    state.overlay.isResizing = false;
  }
  if (state.customText.active) {
    state.customText.isDragging = false;
    state.customText.isResizing = false;
  }
});

// --- 10. REDIMENSIONADOR DA TIMELINE ---
if (timelineResizer && timelineContainer) {
  let isResizingTimeline = false;
  let startY = 0;
  let startHeight = 0;

  timelineResizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizingTimeline = true;
    startY = e.clientY;
    startHeight = timelineContainer.getBoundingClientRect().height;
    timelineResizer.classList.add('resizing');
    document.body.style.cursor = 'ns-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizingTimeline) return;
    const deltaY = startY - e.clientY;
    const newHeight = Math.min(600, Math.max(120, startHeight + deltaY));
    timelineContainer.style.height = `${newHeight}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizingTimeline) {
      isResizingTimeline = false;
      timelineResizer.classList.remove('resizing');
      document.body.style.cursor = 'default';
    }
  });
}

// --- 11. GESTÃO DE EXCLUSÃO (BOTÃO & TECLA DELETE) ---
function updateDeleteButtonState() {
  if (!btnDelete) return;
  if (state.selectedElement) {
    btnDelete.classList.add('danger-active');
    btnDelete.title = `Excluir ${state.selectedElement}`;
  } else {
    btnDelete.classList.remove('danger-active');
    btnDelete.title = 'Selecione um elemento para excluir';
  }
}

function deleteSelectedElement() {
  if (!state.selectedElement) return;

  if (state.selectedElement === 'overlay') {
    state.overlay.img = null;
    const secTrack = document.getElementById('image-film-track');
    if (secTrack) secTrack.innerHTML = '';
    state.selectedElement = null;
  } else if (state.selectedElement === 'text') {
    state.customText.active = false;
    state.customText.text = '';
    const textTrack = document.getElementById('text-film-track');
    if (textTrack) textTrack.innerHTML = '';
    state.selectedElement = null;
  } else if (state.selectedElement === 'video') {
    hiddenVideo.pause();
    hiddenVideo.src = '';
    state.videoLoaded = false;
    state.duration = 0;
    state.currentTime = 0;
    dropzone.style.display = 'flex';
    const filmTrack = document.getElementById('video-film-track');
    if (filmTrack) filmTrack.innerHTML = '';
    state.selectedElement = null;
  }

  updateDeleteButtonState();
  renderCanvasFrame();
}

if (btnDelete) {
  btnDelete.addEventListener('click', deleteSelectedElement);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
      return;
    }
    deleteSelectedElement();
  }
});