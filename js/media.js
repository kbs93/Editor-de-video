import { state, timelineConfig } from './state.js';
import { hiddenVideo, previewCanvas, renderCanvasFrame } from './canvas.js';
import { setupFlexibleFilmClip, setupOverlayTimelineClip, updateTimeDisplay, extractFramesForClip } from './timeline.js';

export const dropzone = document.getElementById('dropzone');

export function applyVideoToCanvas(file) {
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

export function applyImageToCanvas(file, onSelectCallback) {
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

    if (onSelectCallback) onSelectCallback();
    setupOverlayTimelineClip(file.name, url);
    renderCanvasFrame();
  };
}