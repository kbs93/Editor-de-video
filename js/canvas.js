import { state } from './state.js';

export const previewCanvas = document.getElementById('preview-canvas');
export const ctx = previewCanvas.getContext('2d');
export const hiddenVideo = document.getElementById('hidden-video');

export function renderCanvasFrame() {
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  ctx.save();
  applyActiveEffectFilters();

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
    state.videoRect = { x, y, width: vWidth * scale, height: vHeight * scale };

    if (state.selectedElement === 'video') {
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x, y, vWidth * scale, vHeight * scale);
      ctx.setLineDash([]);
    }
  }

  ctx.restore();

  if (state.overlay.img) {
    const ov = state.overlay;
    ctx.drawImage(ov.img, ov.x, ov.y, ov.width, ov.height);

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

  if (state.customText.active) {
    drawInteractivePresetText();
  }

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

export function getCanvasMousePos(e) {
  const rect = previewCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width;
  const scaleY = previewCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}