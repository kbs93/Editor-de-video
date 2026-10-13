import { state, timelineConfig } from './state.js';
import { hiddenVideo, renderCanvasFrame } from './canvas.js';

export const playhead = document.getElementById('playhead');
export const timeIndicator = document.getElementById('time-indicator');
export const btnPlayPause = document.getElementById('btn-play-pause');

let onElementSelectedCallback = null;

export function registerSelectionCallback(cb) {
  onElementSelectedCallback = cb;
}

export function togglePlay() {
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

export function updatePlaybackProgress() {
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

export function updateTimeDisplay() {
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    const ms = Math.floor((secs % 1) * 100).toString().padStart(2, '0');
    return `${m}:${s}.${ms}`;
  };
  timeIndicator.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
}

export function setupFlexibleFilmClip(fileName) {
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

export function setupOverlayTimelineClip(name, thumbUrl) {
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

export function setupTextTimelineClip(label) {
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

export function attachClipDragAndTrim(clipEl, elementType) {
  if (!clipEl) return;
  const handleLeft = clipEl.querySelector('.handle-left');
  const handleRight = clipEl.querySelector('.handle-right');

  let mode = null;
  let startX = 0;
  let initialLeft = 0;
  let initialWidth = 0;

  clipEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.clip-trim-handle')) return;

    document.querySelectorAll('.timeline-clip-item').forEach(c => c.classList.remove('selected'));
    clipEl.classList.add('selected');
    state.selectedElement = elementType;
    if (onElementSelectedCallback) onElementSelectedCallback();
    renderCanvasFrame();

    mode = 'drag';
    startX = e.clientX;
    initialLeft = parseFloat(clipEl.style.left) || 0;
  });

  handleLeft.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    mode = 'trim-left';
    startX = e.clientX;
    initialLeft = parseFloat(clipEl.style.left) || 0;
    initialWidth = parseFloat(clipEl.style.width) || 200;
  });

  handleRight.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    mode = 'trim-right';
    startX = e.clientX;
    initialWidth = parseFloat(clipEl.style.width) || 200;
  });

  window.addEventListener('mousemove', (e) => {
    if (!mode) return;
    const deltaX = e.clientX - startX;

    if (mode === 'drag') {
      const newLeft = Math.max(0, initialLeft + deltaX);
      clipEl.style.left = `${newLeft}px`;
    } else if (mode === 'trim-left') {
      const newLeft = Math.max(0, initialLeft + deltaX);
      const newWidth = Math.max(40, initialWidth - deltaX);
      clipEl.style.left = `${newLeft}px`;
      clipEl.style.width = `${newWidth}px`;
      if (elementType === 'video') {
        timelineConfig.trimStart = newLeft / timelineConfig.pixelsPerSecond;
        hiddenVideo.currentTime = timelineConfig.trimStart;
        updatePlaybackProgress();
      }
    } else if (mode === 'trim-right') {
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

export function extractFramesForClip() {
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