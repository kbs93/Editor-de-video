// ESTADO GLOBAL DA APLICAÇÃO
const state = {
  videoLoaded: false,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  aspectRatio: 16 / 9,
  activeEffect: null,
  selectedElement: null, // 'overlay', 'video', 'text' ou null
  overlay: {
    img: null,
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    isDragging: false,
    isResizing: false,
    dragStartX: 0,
    dragStartY: 0
  },
  customText: {
    active: false,
    text: '',
    style: 'plain',
    x: 300,
    y: 300,
    width: 280,
    height: 90,
    isDragging: false,
    isResizing: false,
    dragStartX: 0,
    dragStartY: 0
  },
  subtitle: {
    text: '',
    font: 'Poppins',
    weight: 'bold',
    size: 24,
    align: 'center',
    uppercase: false,
    color: '#ffffff',
    backgroundColor: '#000000',
    noBackground: true
  }
};

// CONFIGURAÇÃO DA TIMELINE ESTILO CLIPCHAMP
const timelineConfig = {
  pixelsPerSecond: 120, // 1 segundo = 120px
  trimStart: 0,
  trimEnd: 0
};

// SELETORES DO DOM
const hiddenVideo = document.getElementById('hidden-video');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const dropzone = document.getElementById('dropzone');
const mediaInput = document.getElementById('media-input');
const stageWrapper = document.getElementById('stage-wrapper');

// ABAS / PAINÉIS LATERAIS DINÂMICOS
const toolButtons = document.querySelectorAll('.tool-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const btnCloseSubpanels = document.querySelectorAll('.btn-close-subpanel');

// SLOTS LATERAIS & BOTÕES DE FERRAMENTAS
const slotVideo = document.getElementById('slot-video');
const slotOverlay = document.getElementById('slot-overlay');

// Input invisível para imagens/overlays
const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = 'image/*';
imageInput.style.display = 'none';
document.body.appendChild(imageInput);

// DROPDOWN DE PROPORÇÃO (ASPECT RATIO)
const btnAspectRatio = document.getElementById('btn-aspect-ratio');
const aspectDropdown = document.getElementById('aspect-dropdown-menu');
const currentRatioLabel = document.getElementById('current-ratio-label');
const ratioItems = document.querySelectorAll('.ratio-item');

// CONTROLES DE TRANSPORTE E TIMELINE
const btnPlayPause = document.getElementById('btn-play-pause');
const timeIndicator = document.getElementById('time-indicator');
const playhead = document.getElementById('playhead');
const timelineTracksArea = document.getElementById('timeline-scroll-area');
const filmReel = document.getElementById('film-reel');
const btnBack5s = document.getElementById('btn-back-5s');
const btnForward5s = document.getElementById('btn-forward-5s');
const secondaryClip = document.getElementById('secondary-clip');
const secondaryClipTitle = document.getElementById('secondary-clip-title');

// CONTROLES DE LEGENDA
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

// 1. ALTERNÂNCIA DE ABAS LATERAIS (EFEITOS, TEXTO, LEGENDA)
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
    if (activeSection) {
      activeSection.classList.add('active');
    }
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

// 2. PAINEL DE EFEITOS
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


// 3. PAINEL DE TEXTOS PRÉ-FORMATADOS
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

    if (secondaryClip) {
      secondaryClip.style.display = 'flex';
      if (secondaryClipTitle) secondaryClipTitle.textContent = label;
    }

    renderCanvasFrame();
  });
});

// 4. MENU DE FORMATOS (16:9, 9:16, ETC.)
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

// 5. CACHE DOS ARQUIVOS E CARREGAMENTO DOS SLOTS
let stagedVideoFile = null;
let stagedImageFile = null;

// Clique no slot de vídeo
slotVideo.addEventListener('click', (e) => {
  if (!e.target.closest('.slot-remove-btn') && !stagedVideoFile) {
    mediaInput.click();
  }
});

// Clique no slot de imagem
slotOverlay.addEventListener('click', (e) => {
  if (!e.target.closest('.slot-remove-btn') && !stagedImageFile) {
    imageInput.click();
  }
});

// Seleção do arquivo de vídeo no input
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

// Seleção do arquivo de imagem no input
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

// 6. FUNÇÕES QUE APLICAM VÍDEO E IMAGEM NO CANVAS
function applyVideoToCanvas(file) {
  const url = URL.createObjectURL(file);
  hiddenVideo.src = url;
  hiddenVideo.load();

  hiddenVideo.onloadedmetadata = () => {
    state.videoLoaded = true;
    state.duration = hiddenVideo.duration;
    timelineConfig.trimStart = 0;
    timelineConfig.trimEnd = hiddenVideo.duration;
    dropzone.style.display = 'none';

    setupFlexibleFilmClip(file.name);
    updateTimeDisplay();

    hiddenVideo.currentTime = 0.1;
    hiddenVideo.onseeked = () => {
      extractFramesForClip();
      hiddenVideo.onseeked = null;
      renderCanvasFrame();
    };
  };
}

function applyImageToCanvas(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  img.onload = () => {
    const defaultWidth = previewCanvas.width * 0.35;
    const ratio = img.naturalHeight / img.naturalWidth;
    state.overlay.img = img;
    state.overlay.width = defaultWidth;
    state.overlay.height = defaultWidth * ratio;
    state.overlay.x = (previewCanvas.width - state.overlay.width) / 2;
    state.overlay.y = 80;
    state.selectedElement = 'overlay';
    updateDeleteButtonState();

    // Cria o clipe da imagem na trilha da timeline
    setupOverlayTimelineClip(file.name, url);

    renderCanvasFrame();
  };
}


// 7. EVENTOS DE ARRASTAR E SOLTAR (DRAG & DROP NO CANVAS)
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
    applyImageToCanvas(stagedImageFile);
  } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('video/')) applyVideoToCanvas(file);
    else if (file.type.startsWith('image/')) applyImageToCanvas(file);
  }
}

// Registra eventos no contêiner, no canvas e na dropzone
[stageWrapper, previewCanvas, dropzone].forEach(el => {
  if (el) {
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('drop', handleDrop);
  }
});

// Clique na dropzone inicial
dropzone.addEventListener('click', () => mediaInput.click());

// GESTÃO UNIFICADA DE CLIPES NA LINHA DO TEMPO (ARRASTAR POSIÇÃO E ALÇAS ROXAS)

// 1. Clipe de Vídeo na Trilha 1
function setupFlexibleFilmClip(fileName) {
  const track = document.getElementById('video-film-track');
  if (!track) return;
  const clipWidth = state.duration * timelineConfig.pixelsPerSecond;

  track.innerHTML = `
    <div class="timeline-clip-item" id="clip-video" style="width: ${clipWidth}px; left: 0px;">
      <div class="clip-filename-tag">${fileName}</div>
      <div class="clip-trim-handle handle-left" title="Cortar início"></div>
      <div class="clip-sound-indicator"><i class="fa-solid fa-volume-high"></i></div>
      <div class="film-frames-reel" id="film-reel"></div>
      <div class="clip-trim-handle handle-right" title="Cortar fim"></div>
    </div>
  `;

  attachClipDragAndTrim(document.getElementById('clip-video'), 'video');
}

// 2. Clipe de Imagem na Trilha 2 (com a mesma borda roxa e alças)
function setupOverlayTimelineClip(name, thumbUrl) {
  const track = document.getElementById('image-film-track');
  if (!track) return;
  const clipWidth = state.duration > 0 ? (state.duration * timelineConfig.pixelsPerSecond) * 0.7 : 300;

  track.innerHTML = `
    <div class="timeline-clip-item selected" id="clip-image" style="width: ${clipWidth}px; left: 0px;">
      <div class="clip-filename-tag">${name}</div>
      <div class="clip-trim-handle handle-left" title="Cortar início"></div>
      <div class="clip-content-box">
        <img class="clip-thumb-icon" src="${thumbUrl}" alt="thumb">
        <span class="clip-label-text">${name}</span>
      </div>
      <div class="clip-trim-handle handle-right" title="Cortar fim"></div>
    </div>
  `;

  attachClipDragAndTrim(document.getElementById('clip-image'), 'overlay');
}

// 3. Clipe de Texto na Trilha 3 (com a mesma borda roxa e alças)
function setupTextTimelineClip(label) {
  const track = document.getElementById('text-film-track');
  if (!track) return;
  const clipWidth = state.duration > 0 ? (state.duration * timelineConfig.pixelsPerSecond) * 0.5 : 250;

  track.innerHTML = `
    <div class="timeline-clip-item selected" id="clip-text" style="width: ${clipWidth}px; left: 40px;">
      <div class="clip-filename-tag">Texto: ${label}</div>
      <div class="clip-trim-handle handle-left" title="Cortar início"></div>
      <div class="clip-content-box">
        <i class="fa-solid fa-font" style="color: #c084fc;"></i>
        <span class="clip-label-text">${label}</span>
      </div>
      <div class="clip-trim-handle handle-right" title="Cortar fim"></div>
    </div>
  `;

  attachClipDragAndTrim(document.getElementById('clip-text'), 'text');
}

// FUNÇÃO PARA MOVER A POSIÇÃO HORIZONTAL DO BLOCO E CORTAR AS PONTAS
function attachClipDragAndTrim(clipEl, elementType) {
  if (!clipEl) return;
  const handleLeft = clipEl.querySelector('.handle-left');
  const handleRight = clipEl.querySelector('.handle-right');

  let mode = null; // 'drag', 'trim-left', 'trim-right'
  let startX = 0;
  let initialLeft = 0;
  let initialWidth = 0;

  // Selecionar o item ao clicar nele
  clipEl.addEventListener('mousedown', (e) => {
    // Se clicou na alça, não arrasta o bloco inteiro
    if (e.target.closest('.clip-trim-handle')) return;

    document.querySelectorAll('.timeline-clip-item').forEach(c => c.classList.remove('selected'));
    clipEl.classList.add('selected');
    state.selectedElement = elementType;
    updateDeleteButtonState();
    renderCanvasFrame();

    mode = 'drag';
    startX = e.clientX;
    initialLeft = parseFloat(clipEl.style.left) || 0;
  });

  // Alça esquerda (Trim Início)
  handleLeft.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    mode = 'trim-left';
    startX = e.clientX;
    initialLeft = parseFloat(clipEl.style.left) || 0;
    initialWidth = parseFloat(clipEl.style.width) || 200;
  });

  // Alça direita (Trim Fim)
  handleRight.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    mode = 'trim-right';
    startX = e.clientX;
    initialWidth = parseFloat(clipEl.style.width) || 200;
  });

  window.addEventListener('mousemove', (e) => {
    if (!mode) return;
    const deltaX = e.clientX - startX;

    // 1. Mover posição horizontal (em qual segundo o item começa)
    if (mode === 'drag') {
      const newLeft = Math.max(0, initialLeft + deltaX);
      clipEl.style.left = `${newLeft}px`;
    }
    // 2. Cortar início
    else if (mode === 'trim-left') {
      const newLeft = Math.max(0, initialLeft + deltaX);
      const newWidth = Math.max(40, initialWidth - deltaX);
      clipEl.style.left = `${newLeft}px`;
      clipEl.style.width = `${newWidth}px`;
      if (elementType === 'video') {
        timelineConfig.trimStart = newLeft / timelineConfig.pixelsPerSecond;
        hiddenVideo.currentTime = timelineConfig.trimStart;
        updatePlaybackProgress();
      }
    }
    // 3. Cortar fim
    else if (mode === 'trim-right') {
      const newWidth = Math.max(40, initialWidth + deltaX);
      clipEl.style.width = `${newWidth}px`;
      if (elementType === 'video') {
        const curLeft = parseFloat(clipEl.style.left) || 0;
        timelineConfig.trimEnd = (curLeft + newWidth) / timelineConfig.pixelsPerSecond;
        hiddenVideo.currentTime = timelineConfig.trimEnd;
        updatePlaybackProgress();
      }
    }
    renderCanvasFrame();
  });

  window.addEventListener('mouseup', () => {
    mode = null;
  });
}







function extractFramesForClip() {
  const mainReel = document.getElementById('film-reel');
  if (!mainReel) return;

  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = 120;
  captureCanvas.height = 60;
  const cCtx = captureCanvas.getContext('2d');

  try {
    cCtx.drawImage(hiddenVideo, 0, 0, captureCanvas.width, captureCanvas.height);
    const frameData = captureCanvas.toDataURL('image/jpeg', 0.85);

    mainReel.innerHTML = '';
    const clipWidth = state.duration * timelineConfig.pixelsPerSecond;
    const count = Math.max(5, Math.ceil(clipWidth / 70));

    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = frameData;
      img.className = 'film-frame-thumb';
      mainReel.appendChild(img);
    }
  } catch (err) {
    console.error("Erro ao extrair frames:", err);
  }
}

// 9. CONTROLE DE CORTE (TRIM) NAS PONTAS DO CLIPE
function setupTrimDragEvents() {
  const clip = document.getElementById('main-film-clip');
  if (!clip) return;
  const handleLeft = clip.querySelector('.handle-left');
  const handleRight = clip.querySelector('.handle-right');

  let activeHandle = null;
  let startX = 0;
  let initialLeft = 0;
  let initialWidth = 0;

  handleLeft.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    activeHandle = 'left';
    startX = e.clientX;
    initialLeft = parseFloat(clip.style.left) || 0;
    initialWidth = parseFloat(clip.style.width) || (state.duration * timelineConfig.pixelsPerSecond);
  });

  handleRight.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    activeHandle = 'right';
    startX = e.clientX;
    initialWidth = parseFloat(clip.style.width) || (state.duration * timelineConfig.pixelsPerSecond);
  });

  window.addEventListener('mousemove', (e) => {
    if (!activeHandle) return;
    const deltaX = e.clientX - startX;

    if (activeHandle === 'left') {
      const newLeft = Math.max(0, initialLeft + deltaX);
      const newWidth = Math.max(40, initialWidth - deltaX);
      clip.style.left = `${newLeft}px`;
      clip.style.width = `${newWidth}px`;
      timelineConfig.trimStart = newLeft / timelineConfig.pixelsPerSecond;
      hiddenVideo.currentTime = timelineConfig.trimStart;
      updatePlaybackProgress();
    } else if (activeHandle === 'right') {
      const newWidth = Math.max(40, initialWidth + deltaX);
      clip.style.width = `${newWidth}px`;
      const currentLeft = parseFloat(clip.style.left) || 0;
      timelineConfig.trimEnd = (currentLeft + newWidth) / timelineConfig.pixelsPerSecond;
      hiddenVideo.currentTime = timelineConfig.trimEnd;
      updatePlaybackProgress();
    }
    renderCanvasFrame();
  });

  window.addEventListener('mouseup', () => {
    activeHandle = null;
  });
}

// 10. REPRODUÇÃO & RENDERIZAÇÃO NO CANVAS
btnPlayPause.addEventListener('click', togglePlay);

function togglePlay() {
  if (!state.videoLoaded) return;

  if (hiddenVideo.paused) {
    hiddenVideo.play();
    state.isPlaying = true;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    requestAnimationFrame(renderLoop);
  } else {
    hiddenVideo.pause();
    state.isPlaying = false;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

function renderLoop() {
  if (state.isPlaying) {
    renderCanvasFrame();
    updatePlaybackProgress();
    requestAnimationFrame(renderLoop);
  }
}

function renderCanvasFrame() {
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  ctx.save();
  applyActiveEffectFilters();


let videoRect = null;

  if (state.videoLoaded) {
    let scaleModifier = 1;
    if (state.activeEffect === 'zoom-in') scaleModifier = 1.35;
    if (state.activeEffect === 'zoom-slow') scaleModifier = 1.15;

    const vWidth = hiddenVideo.videoWidth;
    const vHeight = hiddenVideo.videoHeight;
    const hRatio = previewCanvas.width / vWidth;
    const vRatio = previewCanvas.height / vHeight;
    const scale = Math.min(hRatio, vRatio) * scaleModifier;

    const x = (previewCanvas.width - vWidth * scale) / 2;
    const y = (previewCanvas.height - vHeight * scale) / 2;

    ctx.drawImage(hiddenVideo, x, y, vWidth * scale, vHeight * scale);
    videoRect = { x, y, width: vWidth * scale, height: vHeight * scale };
    state.videoRect = videoRect;

    // Se o vídeo for o selecionado, desenha borda roxa de foco nele
    if (state.selectedElement === 'video') {
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x, y, vWidth * scale, vHeight * scale);
      ctx.setLineDash([]);
    }
  }

  ctx.restore();

  // Desenha a imagem/overlay
  if (state.overlay.img) {
    const ov = state.overlay;
    ctx.drawImage(ov.img, ov.x, ov.y, ov.width, ov.height);

    // Borda e alça azul aparecem APENAS quando a imagem estiver clicada/selecionada
    if (state.selectedElement === 'overlay') {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(ov.x, ov.y, ov.width, ov.height);
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.fillRect(ov.x + ov.width - 8, ov.y + ov.height - 8, 16, 16);
      ctx.strokeRect(ov.x + ov.width - 8, ov.y + ov.height - 8, 16, 16);
    }
  }



  // Desenha texto formatado
  if (state.customText.active) {
    drawInteractivePresetText();
  }

  // Desenha legenda
  if (state.subtitle.text.trim()) {
    drawSubtitles();
  }
}

function applyActiveEffectFilters() {
  const fx = state.activeEffect;
  if (!fx) return;

  if (fx === 'blur') ctx.filter = 'blur(12px)';
  else if (fx === 'bw-remove') ctx.filter = 'grayscale(100%) contrast(150%)';
  else if (fx === 'film') ctx.filter = 'sepia(0.5) contrast(1.2) brightness(0.9)';
  else if (fx === 'glitch') ctx.filter = 'hue-rotate(90deg) saturate(200%)';
  else if (fx === 'disco') ctx.filter = 'hue-rotate(270deg) contrast(1.4)';
  else if (fx === 'color-shift') ctx.filter = 'hue-rotate(180deg)';
  else if (fx === 'green-screen') ctx.filter = 'saturate(250%)';
}

function drawInteractivePresetText() {
  const t = state.customText;
  ctx.save();

  if (t.style === 'creator') {
    ctx.font = `900 ${t.height * 0.75}px Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(t.text, t.x + t.width / 2, t.y + t.height / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.text, t.x + t.width / 2, t.y + t.height / 2);
  } else if (t.style === 'textbox') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(t.x, t.y, t.width, t.height);
    ctx.font = `bold ${t.height * 0.45}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.text, t.x + t.width / 2, t.y + t.height / 2);
  } else if (t.style === 'circular') {
    ctx.beginPath();
    ctx.arc(t.x + t.width / 2, t.y + t.height / 2, t.height / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.font = `bold ${t.height * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.text, t.x + t.width / 2, t.y + t.height / 2);
  } else {
    ctx.font = `bold ${t.height * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.text, t.x + t.width / 2, t.y + t.height / 2);
  }

  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(t.x, t.y, t.width, t.height);
  ctx.setLineDash([]);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(t.x + t.width - 6, t.y + t.height - 6, 12, 12);
  ctx.restore();
}

function drawSubtitles() {
  const sub = state.subtitle;
  const fontSizeScaled = sub.size * (previewCanvas.height / 720);

  ctx.font = `${sub.weight} ${fontSizeScaled}px ${sub.font}`;
  ctx.textAlign = sub.align;
  ctx.textBaseline = 'bottom';

  const textToDraw = sub.uppercase ? sub.text.toUpperCase() : sub.text;
  const posX = previewCanvas.width / 2;
  const posY = previewCanvas.height - 80;

  if (!sub.noBackground) {
    const textMetrics = ctx.measureText(textToDraw);
    const padding = 12;
    ctx.fillStyle = sub.backgroundColor;
    ctx.fillRect(
      posX - (textMetrics.width / 2) - padding,
      posY - fontSizeScaled - padding,
      textMetrics.width + (padding * 2),
      fontSizeScaled + (padding * 1.5)
    );
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(textToDraw, posX, posY);
  ctx.fillStyle = sub.color;
  ctx.fillText(textToDraw, posX, posY);
}

// 11. ATUALIZAÇÃO DA LINHA DO TEMPO E BOTÕES 5s
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

function updatePlaybackProgress() {
  state.currentTime = hiddenVideo.currentTime;
  updateTimeDisplay();

  if (timelineConfig.trimEnd > 0 && state.currentTime >= timelineConfig.trimEnd) {
    hiddenVideo.pause();
    state.isPlaying = false;
    btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    hiddenVideo.currentTime = timelineConfig.trimStart;
  }

  const playheadPosX = state.currentTime * timelineConfig.pixelsPerSecond + 16;
  playhead.style.left = `${playheadPosX}px`;

  let badge = document.getElementById('ruler-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'ruler-badge';
    badge.className = 'ruler-current-time-badge';
    document.getElementById('ruler').appendChild(badge);
  }
  badge.style.left = `${playheadPosX}px`;
  badge.textContent = `${state.currentTime.toFixed(2)}s`;
}

function updateTimeDisplay() {
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 100).toString().padStart(2, '0');
    return `${m}:${s}.${ms}`;
  };
  timeIndicator.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
}

// 12. EVENTOS DE LEGENDA
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

timelineTracksArea.addEventListener('click', (e) => {
  if (!state.videoLoaded) return;
  const rect = timelineTracksArea.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));

  hiddenVideo.currentTime = clickPercent * state.duration;
  updatePlaybackProgress();
  renderCanvasFrame();
});

// 13. CONTROLES DE MOUSE PARA ARRASTAR E REDIMENSIONAR NO CANVAS
function getCanvasMousePos(e) {
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

previewCanvas.addEventListener('mousedown', (e) => {
  const pos = getCanvasMousePos(e);

  // 1. Clicou no Texto?
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

  // 2. Clicou na Imagem / Overlay?
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

  // 3. Clicou no Vídeo base?
  if (state.videoLoaded && state.videoRect) {
    const vr = state.videoRect;
    if (pos.x >= vr.x && pos.x <= vr.x + vr.width && pos.y >= vr.y && pos.y <= vr.y + vr.height) {
      state.selectedElement = 'video';
      updateDeleteButtonState();
      renderCanvasFrame();
      return;
    }
  }

  // Se clicou no vazio, tira a seleção
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

// 14. REDIMENSIONAMENTO VERTICAL DA TIMELINE (PUXAR PARA CIMA / BAIXO)
const timelineResizer = document.getElementById('timeline-resizer');
const timelineContainer = document.getElementById('timeline-container');

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



// GESTÃO DO BOTÃO EXCLUIR (#tl-delete) E DA TECLA DELETE
const btnDelete = document.getElementById('tl-delete');

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

  // Excluir Imagem/Overlay
  if (state.selectedElement === 'overlay') {
    state.overlay.img = null;
    const secTrack = document.getElementById('secondary-track');
    if (secTrack) secTrack.innerHTML = '';
    state.selectedElement = null;
  }
  // Excluir Texto
  else if (state.selectedElement === 'text') {
    state.customText.active = false;
    state.customText.text = '';
    state.selectedElement = null;
  }
  // Excluir Vídeo
  else if (state.selectedElement === 'video') {
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

// Tecla DELETE ou BACKSPACE para apagar o item selecionado
window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Evita apagar se estiver digitando na caixa de texto da legenda
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
      return;
    }
    deleteSelectedElement();
  }
});