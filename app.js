// ESTADO GLOBAL DA APLICAÇÃO
const state = {
  videoLoaded: false,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  aspectRatio: 16 / 9,
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

// SELETORES DO DOM
const hiddenVideo = document.getElementById('hidden-video');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const dropzone = document.getElementById('dropzone');
const mediaInput = document.getElementById('media-input');
const stageWrapper = document.getElementById('stage-wrapper');

// SLOTS LATERAIS & BOTÕES DE FERRAMENTAS
const slotVideo = document.getElementById('slot-video');
const slotOverlay = document.getElementById('slot-overlay');
const btnToolVideo = document.querySelector('.tool-btn[data-panel="video"]');
const btnToolImage = document.querySelector('.tool-btn[data-panel="imagem"]');

// Input invisível exclusivo para carregar imagens/overlays
const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = 'image/*';
imageInput.style.display = 'none';
document.body.appendChild(imageInput);

// DROPDOWN DE ASPECT RATIO
const btnAspectRatio = document.getElementById('btn-aspect-ratio');
const aspectDropdown = document.getElementById('aspect-dropdown-menu');
const currentRatioLabel = document.getElementById('current-ratio-label');
const ratioItems = document.querySelectorAll('.ratio-item');

// CONTROLES DE TRANSPORTE
const btnPlayPause = document.getElementById('btn-play-pause');
const timeIndicator = document.getElementById('time-indicator');
const playhead = document.getElementById('playhead');
const timelineTracksArea = document.getElementById('timeline-scroll-area');

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

// 1. GESTÃO DO MENU DE PROPORÇÕES (16:9, 9:16, ETC.)
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
    const label = item.getAttribute('data-name');
    
    currentRatioLabel.textContent = `Tamanho (${ratioStr})`;
    stageWrapper.style.aspectRatio = ratioStr;

    // Atualiza proporções no canvas
    const [w, h] = ratioStr.split('/').map(Number);
    state.aspectRatio = w / h;
    previewCanvas.width = 1080 * (w / h);
    previewCanvas.height = 1080;

    renderCanvasFrame();
  });
});

// 2. GESTÃO DE CARREGAMENTO DO VÍDEO
// 2. GESTÃO DE ARMAZENAMENTO NOS SLOTS E ARRASTO PARA O CANVAS

// Cache local dos arquivos prontos para serem arrastados
let stagedVideoFile = null;
let stagedImageFile = null;

// Gatilhos para abrir o seletor de arquivos (sem ir para o canvas)
if (btnToolVideo) btnToolVideo.addEventListener('click', () => mediaInput.click());
slotVideo.addEventListener('click', (e) => {
  if (!e.target.closest('.slot-remove-btn') && !stagedVideoFile) {
    mediaInput.click();
  }
});

if (btnToolImage) btnToolImage.addEventListener('click', () => imageInput.click());
slotOverlay.addEventListener('click', (e) => {
  if (!e.target.closest('.slot-remove-btn') && !stagedImageFile) {
    imageInput.click();
  }
});

// Quando o usuário seleciona o vídeo -> Coloca APENAS no Slot 1
mediaInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stagedVideoFile = file;

  const url = URL.createObjectURL(file);
  slotVideo.innerHTML = `
    <div class="slot-preview-wrapper" draggable="true" title="Arraste para o canvas de edição">
      <video src="${url}" muted></video>
      <button class="slot-remove-btn" title="Remover">&times;</button>
    </div>
  `;

  // Configura o evento de arrastar do slot
  const preview = slotVideo.querySelector('.slot-preview-wrapper');
  preview.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/plain', 'slot-video');
  });

  slotVideo.querySelector('.slot-remove-btn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    stagedVideoFile = null;
    mediaInput.value = '';
    slotVideo.innerHTML = '<button class="slot-add-btn" title="Adicionar Camada de Vídeo"><i class="fa-solid fa-plus"></i></button>';
  });
});

// Quando o usuário seleciona a imagem -> Coloca APENAS no Slot 2
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stagedImageFile = file;

  const url = URL.createObjectURL(file);
  slotOverlay.innerHTML = `
    <div class="slot-preview-wrapper" draggable="true" title="Arraste para o canvas de edição">
      <img src="${url}" alt="Preview">
      <button class="slot-remove-btn" title="Remover">&times;</button>
    </div>
  `;

  // Configura o evento de arrastar do slot
  const preview = slotOverlay.querySelector('.slot-preview-wrapper');
  preview.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/plain', 'slot-image');
  });

  slotOverlay.querySelector('.slot-remove-btn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    stagedImageFile = null;
    imageInput.value = '';
    slotOverlay.innerHTML = '<button class="slot-add-btn" title="Adicionar Sobreposição / Imagem"><i class="fa-solid fa-plus"></i></button>';
  });
});

// SOLTAR NO CANVAS: SÓ AQUI O ARQUIVO ENTRA NA EDIÇÃO
stageWrapper.addEventListener('dragover', (e) => {
  e.preventDefault();
});

stageWrapper.addEventListener('drop', (e) => {
  e.preventDefault();
  const draggedType = e.dataTransfer.getData('text/plain');

  // Arrastou a partir do Slot de Vídeo
  if (draggedType === 'slot-video' && stagedVideoFile) {
    applyVideoToCanvas(stagedVideoFile);
  }
  // Arrastou a partir do Slot de Imagem
  else if (draggedType === 'slot-image' && stagedImageFile) {
    applyImageToCanvas(stagedImageFile);
  }
  // Suporte caso o usuário arraste um arquivo direto do computador para a área central
  else if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('video/')) applyVideoToCanvas(file);
    else if (file.type.startsWith('image/')) applyImageToCanvas(file);
  }
});

// Aplica o vídeo no Canvas e na Linha do Tempo
function applyVideoToCanvas(file) {
  const url = URL.createObjectURL(file);
  hiddenVideo.src = url;
  hiddenVideo.load();

  hiddenVideo.onloadedmetadata = () => {
    state.videoLoaded = true;
    state.duration = hiddenVideo.duration;
    dropzone.style.display = 'none';

    document.getElementById('clip-block').textContent = file.name;
    updateTimeDisplay();
    renderCanvasFrame();
  };
}

// Aplica a imagem no Canvas de edição
// Aplica a imagem no Canvas de edição com tamanho e posição iniciais dinâmicos
function applyImageToCanvas(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  img.onload = () => {
    const defaultWidth = previewCanvas.width * 0.25;
    const ratio = img.naturalHeight / img.naturalWidth;
    state.overlay.img = img;
    state.overlay.width = defaultWidth;
    state.overlay.height = defaultWidth * ratio;
    state.overlay.x = (previewCanvas.width - state.overlay.width) / 2;
    state.overlay.y = 80;
    renderCanvasFrame();
  };
}

// 3. REPRODUÇÃO & CANVAS ENGINE
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

  // 1. Desenha o frame do vídeo
  if (state.videoLoaded) {
    const vWidth = hiddenVideo.videoWidth;
    const vHeight = hiddenVideo.videoHeight;
    const hRatio = previewCanvas.width / vWidth;
    const vRatio = previewCanvas.height / vHeight;
    const scale = Math.min(hRatio, vRatio);

    const x = (previewCanvas.width - vWidth * scale) / 2;
    const y = (previewCanvas.height - vHeight * scale) / 2;

    ctx.drawImage(hiddenVideo, x, y, vWidth * scale, vHeight * scale);
  }

  // 2. Desenha a sobreposição de imagem/logo (canto superior direito proporcional)
// 2. Desenha o overlay interativo com borda de seleção e alça de redimensionamento
  if (state.overlay.img) {
    const ov = state.overlay;
    ctx.drawImage(ov.img, ov.x, ov.y, ov.width, ov.height);

    // Borda delimitadora de seleção
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(ov.x, ov.y, ov.width, ov.height);
    ctx.setLineDash([]);

    // Alça no canto inferior direito para redimensionar
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.fillRect(ov.x + ov.width - 8, ov.y + ov.height - 8, 16, 16);
    ctx.strokeRect(ov.x + ov.width - 8, ov.y + ov.height - 8, 16, 16);
  }

  // 3. Desenha a legenda configurada
  if (state.subtitle.text.trim()) {
    drawSubtitles();
  }
}

// 4. DESENHO DE LEGENDAS NO FRAME
function drawSubtitles() {
  const sub = state.subtitle;
  const fontSizeScaled = sub.size * (previewCanvas.height / 720);
  
  ctx.font = `${sub.weight} ${fontSizeScaled}px ${sub.font}`;
  ctx.textAlign = sub.align;
  ctx.textBaseline = 'bottom';

  const textToDraw = sub.uppercase ? sub.text.toUpperCase() : sub.text;
  const posX = previewCanvas.width / 2;
  const posY = previewCanvas.height - 80;

  // Caixa de fundo caso ativada
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

  // Contorno da fonte para legibilidade
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(textToDraw, posX, posY);

  // Texto principal
  ctx.fillStyle = sub.color;
  ctx.fillText(textToDraw, posX, posY);
}

// 5. ATUALIZAÇÃO DA LINHA DO TEMPO
function updatePlaybackProgress() {
  state.currentTime = hiddenVideo.currentTime;
  updateTimeDisplay();

  // Posiciona a agulha na linha do tempo
  if (state.duration > 0) {
    const progressPercent = (state.currentTime / state.duration) * 100;
    playhead.style.left = `${progressPercent}%`;
  }
}

function updateTimeDisplay() {
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  timeIndicator.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
}

// 6. EVENTOS DE EDIÇÃO DE LEGENDA
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

// Suporte para corte ou salto ao clicar na régua da timeline
timelineTracksArea.addEventListener('click', (e) => {
  if (!state.videoLoaded) return;
  const rect = timelineTracksArea.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
  
  hiddenVideo.currentTime = clickPercent * state.duration;
  updatePlaybackProgress();
  renderCanvasFrame();
});

// CONTROLES MANUAIS DO MOUSE (ARRASTAR E REDIMENSIONAR NO CANVAS)
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
  if (!state.overlay.img) return;
  const pos = getCanvasMousePos(e);
  const ov = state.overlay;

  // Checa se clicou na alça de redimensionamento (canto inferior direito)
  const handleX = ov.x + ov.width;
  const handleY = ov.y + ov.height;
  if (Math.abs(pos.x - handleX) <= 20 && Math.abs(pos.y - handleY) <= 20) {
    ov.isResizing = true;
    return;
  }

  // Checa se clicou dentro da imagem para arrastar
  if (pos.x >= ov.x && pos.x <= ov.x + ov.width && pos.y >= ov.y && pos.y <= ov.y + ov.height) {
    ov.isDragging = true;
    ov.dragStartX = pos.x - ov.x;
    ov.dragStartY = pos.y - ov.y;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!state.overlay.img) return;
  const pos = getCanvasMousePos(e);
  const ov = state.overlay;

  // Atualiza cursor
  const handleX = ov.x + ov.width;
  const handleY = ov.y + ov.height;
  if (Math.abs(pos.x - handleX) <= 20 && Math.abs(pos.y - handleY) <= 20) {
    previewCanvas.style.cursor = 'nwse-resize';
  } else if (pos.x >= ov.x && pos.x <= ov.x + ov.width && pos.y >= ov.y && pos.y <= ov.y + ov.height) {
    previewCanvas.style.cursor = 'move';
  } else {
    previewCanvas.style.cursor = 'default';
  }

  // Executa redimensionamento
  if (ov.isResizing) {
    const newWidth = Math.max(40, pos.x - ov.x);
    const ratio = ov.img.naturalHeight / ov.img.naturalWidth;
    ov.width = newWidth;
    ov.height = newWidth * ratio;
    renderCanvasFrame();
  }
  // Executa movimentação
  else if (ov.isDragging) {
    ov.x = pos.x - ov.dragStartX;
    ov.y = pos.y - ov.dragStartY;
    renderCanvasFrame();
  }
});

window.addEventListener('mouseup', () => {
  if (state.overlay.img) {
    state.overlay.isDragging = false;
    state.overlay.isResizing = false;
  }
});