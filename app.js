// ESTADO GLOBAL DA APLICAÇÃO
const state = {
  videoLoaded: false,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  aspectRatio: 16 / 9,
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
dropzone.addEventListener('click', () => mediaInput.click());

mediaInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadMediaFile(file);
});

// Suporte para Arrasto e Soltura (Drag & Drop)
stageWrapper.addEventListener('dragover', (e) => e.preventDefault());
stageWrapper.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) loadMediaFile(file);
});

function loadMediaFile(file) {
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

  if (state.videoLoaded) {
    // Desenha o frame do vídeo centralizado com Letterbox/Fit
    const vWidth = hiddenVideo.videoWidth;
    const vHeight = hiddenVideo.videoHeight;
    const hRatio = previewCanvas.width / vWidth;
    const vRatio = previewCanvas.height / vHeight;
    const scale = Math.min(hRatio, vRatio);

    const x = (previewCanvas.width - vWidth * scale) / 2;
    const y = (previewCanvas.height - vHeight * scale) / 2;

    ctx.drawImage(hiddenVideo, x, y, vWidth * scale, vHeight * scale);
  }

  // Desenho da legenda configurada
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