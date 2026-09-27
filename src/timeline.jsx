import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import CanvasTimeline, {
  Audio as AudioBase,
  Caption as CaptionBase,
  Control,
  controlsUtils,
  Helper as HelperBase,
  Image as ImageBase,
  Pattern,
  resize,
  TIMELINE_BOUNDING_CHANGED,
  TIMELINE_PREFIX,
  util,
} from "@designcombo/timeline";
import { getAudioData, getWaveformPortion } from "@remotion/media-utils";
import { dispatch, filter, subject } from "@designcombo/events";
import {
  ACTIVE_SPLIT,
  EDIT_OBJECT,
  LAYER_CLONE,
  LAYER_DELETE,
  TIMELINE_SCALE_CHANGED,
} from "@designcombo/state";
import { SquareSplitHorizontal, Trash, ZoomIn, ZoomOut } from "lucide-react";

import { Button, Slider } from "./ui-components";
import useStore, {
  calculateTextHeight,
  PLAYER_PAUSE,
  PLAYER_PLAY,
  PREVIEW_FRAME_WIDTH,
  SECONDARY_FONT,
  SMALL_FONT_SIZE,
  TIMELINE_OFFSET_CANVAS_LEFT,
  TIMELINE_OFFSET_CANVAS_RIGHT,
  TIMELINE_OFFSET_X,
  useCurrentPlayerFrame,
  useUpdateAnsestors,
} from "./editor-store";
import {
  formatTimelineUnit,
  frameToTimeString,
  getCurrentTime,
  getFitZoomLevel,
  getNextZoomLevel,
  getPreviousZoomLevel,
  getZoomByIndex,
  timeMsToUnits,
  timeToString,
  unitsToTimeMs,
} from "./timeline-toolkit";

import { Track, PreviewTrackItem } from "./timeline-items";

// ==========================================
// 1. DESENHO DOS CONTROLOS DO CANVAS (FABRIC)
// ==========================================
export function drawVerticalLine(ctx, left, top, _, fabricObject) {
  const cSize = 12;
  const cSizeBy2 = cSize / 2;

  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(util.degreesToRadians(90 + fabricObject.angle));

  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(-cSizeBy2, 0);
  ctx.lineTo(cSizeBy2, 0);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "black";
  ctx.beginPath();
  ctx.moveTo(-cSizeBy2, 0);
  ctx.lineTo(cSizeBy2, 0);
  ctx.stroke();

  ctx.restore();
}

export function drawVerticalLeftIcon(ctx, left, top, styleOverride, fabricObject) {
  const width = 12;
  const height = fabricObject.height;
  const leftBorderRadius = 4;

  ctx.save();
  ctx.translate(left + 6, top);
  ctx.rotate(util.degreesToRadians(fabricObject.angle));

  ctx.fillStyle = "rgba(255,255,255, 0.85)";
  ctx.beginPath();
  ctx.moveTo(-width / 2, -height / 2 + leftBorderRadius);
  ctx.lineTo(-width / 2, height / 2 - leftBorderRadius);
  ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2 + leftBorderRadius, height / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.lineTo(width / 2, -height / 2);
  ctx.lineTo(-width / 2 + leftBorderRadius, -height / 2);
  ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2, -height / 2 + leftBorderRadius);
  ctx.fill();

  const lineWidth = 1;
  const lineHeight = Math.min(height * 0.45, 100);
  const lineSpacing = 2;
  ctx.fillStyle = "#000";

  const firstLineX = -lineWidth / 2 - lineSpacing / 2 - 1;
  const secondLineX = lineWidth / 2 + lineSpacing / 2 - 1;

  ctx.fillRect(firstLineX, -lineHeight / 2, lineWidth, lineHeight);
  ctx.fillRect(secondLineX, -lineHeight / 2, lineWidth, lineHeight);
  ctx.restore();
}

export function drawVerticalRightIcon(ctx, left, top, styleOverride, fabricObject) {
  const width = 12;
  const height = fabricObject.height;
  const rightBorderRadius = 4;

  ctx.save();
  ctx.translate(left - 6, top);
  ctx.rotate(util.degreesToRadians(fabricObject.angle));

  ctx.fillStyle = "rgba(255,255,255, 0.85)";
  ctx.beginPath();
  ctx.moveTo(width / 2, -height / 2 + rightBorderRadius);
  ctx.lineTo(width / 2, height / 2 - rightBorderRadius);
  ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - rightBorderRadius, height / 2);
  ctx.lineTo(-width / 2, height / 2);
  ctx.lineTo(-width / 2, -height / 2);
  ctx.lineTo(width / 2 - rightBorderRadius, -height / 2);
  ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + rightBorderRadius);
  ctx.fill();

  const lineWidth = 1;
  const lineHeight = Math.min(height * 0.45, 100);
  const lineSpacing = 2;
  ctx.fillStyle = "#000";

  const firstLineX = -lineWidth / 2 - lineSpacing / 2 - 1;
  const secondLineX = lineWidth / 2 + lineSpacing / 2 - 1;

  ctx.fillRect(firstLineX, -lineHeight / 2, lineWidth, lineHeight);
  ctx.fillRect(secondLineX, -lineHeight / 2, lineWidth, lineHeight);
  ctx.restore();
}

const { scaleSkewCursorStyleHandler } = controlsUtils;

export const createResizeControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    render: drawVerticalRightIcon,
    actionHandler: resize.common,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    actionHandler: resize.common,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    render: drawVerticalLeftIcon,
    sizeX: 20,
    sizeY: 32,
  }),
});

export const createAudioControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    render: drawVerticalRightIcon,
    actionHandler: resize.audio,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    render: drawVerticalLeftIcon,
    actionHandler: resize.audio,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
  }),
});

export const createMediaControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    actionHandler: resize.media,
    render: drawVerticalRightIcon,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    render: drawVerticalLeftIcon,
    actionHandler: resize.media,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
  }),
});

export const createTransitionControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    actionHandler: resize.transition,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    render: drawVerticalLine,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    actionHandler: resize.transition,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    render: drawVerticalLine,
  }),
});

// ==========================================
// 2. CLASSES DE ITENS DO CANVAS EMBUTIDAS
// ==========================================
class Helper extends HelperBase {
  static type = "Helper";

  constructor(props) {
    props.activeGuideFill = "#ffffff";
    super(props);
  }
}

class TextItem extends CaptionBase {
  static type = "Text";

  static createControls() {
    return { controls: createResizeControls() };
  }

  constructor(props) {
    super(props);
    this.itemType = "text";
    this.fill = "#2e2e48";
    this.name = props.name || props.details?.text || props.text || "Texto";
    this.text = this.name;
  }

  set(key, value) {
    super.set(key, value);
    if (key === "name" || key === "text") {
      this.name = value;
      this.text = value;
      this.canvas?.requestRenderAll();
    } else if (key === "details" && value?.text) {
      this.name = value.text;
      this.text = value.text;
      this.canvas?.requestRenderAll();
    }
    return this;
  }

  _render(ctx) {
    super._render(ctx);
    this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
  }

  drawTextIdentity(ctx) {
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.font = `600 12px ${SECONDARY_FONT || "sans-serif"}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const label = this.name || this.text || this.details?.text || "Texto";
    const availableWidth = Math.max(10, this.width - 24);

    let displayText = label;
    if (ctx.measureText(displayText).width > availableWidth) {
      while (
        ctx.measureText(displayText + "...").width > availableWidth &&
        displayText.length > 0
      ) {
        displayText = displayText.slice(0, -1);
      }
      displayText += "...";
    }

    ctx.fillText(displayText, 12, this.height / 2);
    ctx.restore();
  }

  updateSelected(ctx) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255, 1.0)"
      : "rgba(255, 255, 255, 0.15)";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }
}

class CaptionItem extends CaptionBase {
  static type = "Caption";

  static createControls() {
    return { controls: createResizeControls() };
  }
  constructor(props) {
    super(props);
    this.fill = "#353560";
  }

  _render(ctx) {
    super._render(ctx);
    this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
  }

  drawTextIdentity(ctx) {
    const textPath = new Path2D(
      "M4 4.8C3.55817 4.8 3.2 5.15817 3.2 5.6C3.2 6.04183 3.55817 6.4 4 6.4H5.6C6.04183 6.4 6.4 6.04183 6.4 5.6C6.4 5.15817 6.04183 4.8 5.6 4.8H4Z M8.8 4.8C8.35817 4.8 8 5.15817 8 5.6C8 6.04183 8.35817 6.4 8.8 6.4H12C12.4418 6.4 12.8 6.04183 12.8 5.6C12.8 5.15817 12.4418 4.8 12 4.8H8.8Z M4 8C3.55817 8 3.2 8.35817 3.2 8.8C3.2 9.24183 3.55817 9.6 4 9.6H7.2C7.64183 9.6 8 9.24183 8 8.8C8 8.35817 7.64183 8 7.2 8H4Z M10.4 8C9.95817 8 9.6 8.35817 9.6 8.8C9.6 9.24183 9.95817 9.6 10.4 9.6H12C12.4418 9.6 12.8 9.24183 12.8 8.8C12.8 8.35817 12.4418 8 12 8H10.4Z M2.4 0C1.07452 0 0 1.07452 0 2.4V10.4C0 11.7255 1.07452 12.8 2.4 12.8H13.6C14.9255 12.8 16 11.7255 16 10.4V2.4C16 1.07452 14.9255 0 13.6 0H2.4ZM1.6 2.4C1.6 1.95817 1.95817 1.6 2.4 1.6H13.6C14.0418 1.6 14.4 1.95817 14.4 2.4V10.4C14.4 10.8418 14.0418 11.2 13.6 11.2H2.4C1.95817 11.2 1.6 10.8418 1.6 10.4V2.4Z"
    );
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.translate(0, 8);
    ctx.font = `400 12px ${SECONDARY_FONT}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.textAlign = "left";

    const iconSpace = 28;
    const rightPadding = 5;
    const availableWidth = this.width - iconSpace - rightPadding;

    let displayText = this.text;
    const textWidth = ctx.measureText(this.text).width;

    if (textWidth > availableWidth) {
      let currentText = this.text;
      while (
        ctx.measureText(currentText + "...").width > availableWidth &&
        currentText.length > 0
      ) {
        currentText = currentText.slice(0, -1);
      }
      displayText = currentText + "...";
    }

    ctx.clip();
    ctx.fillText(displayText, 28, 12);
    ctx.translate(8, 1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fill(textPath);
    ctx.restore();
  }

  updateSelected(ctx) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255,1.0)"
      : "rgba(255, 255, 255,0.1)";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }
}

class ImageItem extends ImageBase {
  static type = "Image";

  static createControls() {
    return { controls: createResizeControls() };
  }

  constructor(props) {
    super(props);
    this.loadImage();
  }

  _render(ctx) {
    super._render(ctx);
    this.updateSelected(ctx);
  }

  loadImage() {
    util.loadImage(this.src).then((img) => {
      const imgHeight = img.height;
      const rectHeight = this.height;
      const scaleY = rectHeight / imgHeight;
      const pattern = new Pattern({
        source: img,
        repeat: "repeat-x",
        patternTransform: [scaleY, 0, 0, scaleY, 0, 0],
      });
      this.set("fill", pattern);
      this.canvas?.requestRenderAll();
    });
  }

  setSrc(src) {
    this.src = src;
    this.loadImage();
    this.canvas?.requestRenderAll();
  }
}

class VideoItem extends ImageBase {
  static type = "Video";

  static createControls() {
    return { controls: createMediaControls() };
  }

  constructor(props) {
    super(props);
    this.itemType = "video";
    this.previewUrl = props.metadata?.previewUrl || props.src;
    this.loadVideoThumbnail();
  }

  loadVideoThumbnail() {
    const sourceImg = this.previewUrl || this.src;
    if (!sourceImg) return;

    util
      .loadImage(sourceImg)
      .then((img) => {
        const imgHeight = img.height || 40;
        const rectHeight = this.height || 40;
        const scaleY = rectHeight / imgHeight;
        const pattern = new Pattern({
          source: img,
          repeat: "repeat-x",
          patternTransform: [scaleY, 0, 0, scaleY, 0, 0],
        });
        this.set("fill", pattern);
        this.canvas?.requestRenderAll();
      })
      .catch(() => {
        this.set("fill", "#27272a");
        this.canvas?.requestRenderAll();
      });
  }

  _render(ctx) {
    super._render(ctx);
    this.drawVideoBadge(ctx);
    this.updateSelected(ctx);
  }

  drawVideoBadge(ctx) {
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(4, 4, 42, 18);
    ctx.font = "600 10px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("VÍDEO", 8, 17);
    ctx.restore();
  }

  setSrc(src) {
    this.src = src;
    this.previewUrl = src;
    this.loadVideoThumbnail();
    this.canvas?.requestRenderAll();
  }
}

const MAX_CANVAS_WIDTH = 12000;
const CANVAS_SAFE_DRAWING = 2000;
const EMPTY_FILMSTRIP = {
  offset: 0,
  startTime: 0,
  thumbnailsCount: 0,
  widthOnScreen: 0,
};

const calculateAudioOffscreenSegments = (offscreenHeight, trimFromSize, segmentSize) => {
  return Math.floor((offscreenHeight + trimFromSize) / segmentSize);
};

class AudioItem extends AudioBase {
  static type = "Audio";
  barData;
  tScale;
  offscreenCanvas = null;
  offscreenCtx = null;
  fallbackSegmentIndex = 0;
  thumbnailsPerSegment = 0;
  scrollLeft = 0;
  segmentSize = 0;
  display;
  isDirty = true;
  fallbackSegmentsCount = 0;
  thumbnailWidth = 8;
  isFetchingThumbnails = false;
  nextFilmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
  loadingFilmstrip = EMPTY_FILMSTRIP;
  playbackRate;
  barsCache = new Map();
  bars = [];

  static createControls() {
    return { controls: createAudioControls() };
  }

  constructor(props) {
    super(props);
    this.display = props.display;
    this.fill = "#00586c";
    this.objectCaching = false;
    this.initOffscreenCanvas();
    this.initialize();
  }

  _render(ctx) {
    super._render(ctx);
    this.updateSelected(ctx);

    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);

    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    this.renderToOffscreen();

    const displayFromInUnits = timeMsToUnits(this.display.from, this.tScale);
    const scrollLeft = this.scrollLeft + displayFromInUnits;
    const visibleStart = Math.max(0, -scrollLeft) - CANVAS_SAFE_DRAWING;
    ctx.drawImage(
      this.offscreenCanvas,
      0,
      0,
      this.offscreenCanvas.width,
      this.height,
      visibleStart,
      0,
      this.offscreenCanvas.width,
      this.height
    );

    ctx.restore();
    this.canvas?.requestRenderAll();
  }

  async initialize() {
    this.initDimensions();
    const audioData = await getAudioData(this.src);
    this.barData = audioData;
    this.bars = this.getBars(0, 0);
    this.canvas?.requestRenderAll();
    this.onScrollChange({ scrollLeft: 0 });
  }

  initDimensions() {
    this.segmentSize = 1200;
  }

  getBars(start, duration) {
    if (!this.barData) return [];
    const cacheKey = `${start}-${duration}-${this.width}`;
    if (this.barsCache.has(cacheKey)) {
      return this.barsCache.get(cacheKey);
    }

    try {
      const scale = this.tScale || 1;
      const durationMs =
        this.duration || this.barData.durationInSeconds * 1000 || 5000;
      const durationInUnits = timeMsToUnits(
        durationMs,
        scale,
        this.playbackRate || 1
      );

      const calculatedSamples = Math.round((durationInUnits || 400) / 4);
      const numberOfSamples = Math.min(Math.max(calculatedSamples, 50), 2000);

      const bars = getWaveformPortion({
        audioData: this.barData,
        startTimeInSeconds: start / 1000 || 0,
        durationInSeconds: duration || this.barData.durationInSeconds || 5,
        numberOfSamples,
      });

      this.barsCache.set(cacheKey, bars);
      return bars;
    } catch (err) {
      console.warn("Falha ao gerar waveform do áudio, usando fallback vazio:", err);
      return [];
    }
  }

  initOffscreenCanvas() {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = new OffscreenCanvas(this.width, this.height);
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }

    if (
      this.offscreenCanvas.width !== this.width ||
      this.offscreenCanvas.height !== this.height
    ) {
      this.offscreenCanvas.width = this.width;
      this.offscreenCanvas.height = this.height;
      this.isDirty = true;
    }
  }

  updateSelected(ctx) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255,1.0)"
      : "rgba(255, 255, 255,0.1)";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }

  calculateOffscreenWidth({ scrollLeft }) {
    const offscreenWidth = Math.min(this.left + scrollLeft, 0);
    return Math.abs(offscreenWidth);
  }

  calulateWidthOnScreen() {
    const canvasEl = document.getElementById("designcombo-timeline-canvas");
    const canvasWidth = canvasEl?.clientWidth || 0;
    const scrollLeft = this.scrollLeft;
    const timelineWidth = canvasWidth;
    const cutFromBottomEdge = Math.max(
      timelineWidth - (this.width + this.left + scrollLeft),
      0
    );
    const visibleHeight = Math.min(
      timelineWidth - this.left - scrollLeft,
      timelineWidth
    );
    return Math.max(visibleHeight - cutFromBottomEdge, 0);
  }

  calculateFilmstripDimensions({ segmentIndex, widthOnScreen }) {
    const filmstripOffset = segmentIndex * this.segmentSize;
    const shouldUseLeftBacklog = segmentIndex > 0;
    const leftBacklogSize = shouldUseLeftBacklog ? this.segmentSize : 0;
    const duration = (this.display?.to || 0) - (this.display?.from || 0);

    const totalWidth = timeMsToUnits(duration, this.tScale);
    const rightRemainingSize =
      totalWidth - widthOnScreen - leftBacklogSize - filmstripOffset;
    const rightBacklogSize = Math.min(this.segmentSize, rightRemainingSize);

    const filmstripStartTime = unitsToTimeMs(filmstripOffset, this.tScale);
    const filmstrimpThumbnailsCount =
      1 +
      Math.round(
        (widthOnScreen + leftBacklogSize + rightBacklogSize) /
          this.thumbnailWidth
      );

    return {
      filmstripOffset,
      leftBacklogSize,
      rightBacklogSize,
      filmstripStartTime,
      filmstrimpThumbnailsCount,
    };
  }

  onScrollChange({ scrollLeft }) {
    const offscreenWidth = this.calculateOffscreenWidth({ scrollLeft });
    const trimFromSize = timeMsToUnits(this.trim.from, this.tScale);
    const offscreenSegments = calculateAudioOffscreenSegments(
      offscreenWidth,
      trimFromSize,
      this.segmentSize
    );

    const segmentToDraw = offscreenSegments;

    if (segmentToDraw !== this.fallbackSegmentIndex) {
      const fillPattern = this.fill;
      if (fillPattern instanceof Pattern) {
        fillPattern.offsetX =
          this.segmentSize *
          (segmentToDraw - Math.floor(this.fallbackSegmentsCount / 2));
      }
      this.fallbackSegmentIndex = segmentToDraw;
    }

    if (!this.isFetchingThumbnails) {
      this.scrollLeft = scrollLeft;
      const widthOnScreen = this.calulateWidthOnScreen();
      const { filmstripOffset, filmstripStartTime, filmstrimpThumbnailsCount } =
        this.calculateFilmstripDimensions({
          widthOnScreen,
          segmentIndex: segmentToDraw,
        });

      this.nextFilmstrip = {
        segmentIndex: segmentToDraw,
        offset: filmstripOffset,
        startTime: filmstripStartTime,
        thumbnailsCount: filmstrimpThumbnailsCount,
        widthOnScreen,
      };
      this.isDirty = true;
    }
  }

  renderToOffscreen(force) {
    if (!this.offscreenCtx) return;
    if (!this.isDirty && !force) return;

    this.offscreenCanvas.width = MAX_CANVAS_WIDTH;
    this.offscreenCanvas.height = this.height;

    const ctx = this.offscreenCtx;
    const displayFromInUnits = timeMsToUnits(this.display.from, this.tScale);
    const scrollLeft = this.scrollLeft + displayFromInUnits;

    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate
    );

    const visibleStart =
      Math.max(0, -scrollLeft) - CANVAS_SAFE_DRAWING + trimFromSize;
    const visibleWidth = MAX_CANVAS_WIDTH;

    const bars = this.bars;
    if (!bars) return;

    ctx.clearRect(0, 0, this.offscreenCanvas.width, this.height);
    ctx.beginPath();
    ctx.roundRect(0, 0, this.offscreenCanvas.width, this.height, this.rx);
    ctx.clip();

    ctx.fillStyle = "#f4f4f5";
    ctx.imageSmoothingEnabled = false;

    const barWidth = 4;
    const startBarIndex = Math.floor(visibleStart / barWidth);
    const endBarIndex = Math.ceil((visibleStart + visibleWidth) / barWidth);
    ctx.beginPath();

    for (let i = startBarIndex; i < endBarIndex && i < bars.length; i++) {
      const bar = bars[i];
      if (bar) {
        const x = Math.round(i * barWidth - visibleStart);
        if (x >= 0 && x < this.offscreenCanvas.width) {
          const amplitude = bar.amplitude || 0;
          const height = Math.round(amplitude * 15);
          const y = Math.round((20 - height) / 2 + 8);
          ctx.rect(x, y, 1, height);
        }
      }
    }
    ctx.fill();
    this.isDirty = false;
  }

  onResizeSnap() {
    this.renderToOffscreen(true);
  }

  onResize() {
    this.renderToOffscreen(true);
  }

  onScale() {
    this.barsCache.clear();
    this.bars = this.getBars(0, 0);
    this.isFetchingThumbnails = false;
    this.nextFilmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
    this.loadingFilmstrip = { ...EMPTY_FILMSTRIP };
    this.onScrollChange({ scrollLeft: this.scrollLeft });
  }
}

export const onTextBlur = (id) => {
  const elRef = document.querySelector(`.id-${id}`);
  if (!elRef) return;

  const textDiv =
    elRef.querySelector(".designcombo_textLayer") ||
    elRef.firstElementChild?.firstElementChild?.firstElementChild ||
    elRef;

  const currentText = textDiv.innerText?.trim() || "";
  if (!currentText) return;

  const {
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    textShadow,
    webkitTextStroke,
  } = textDiv.style;
  const { width } = elRef.style;

  const newHeight = calculateTextHeight({
    family: fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    text: currentText,
    textShadow,
    webkitTextStroke,
    width,
    id,
  });

  dispatch(EDIT_OBJECT, {
    payload: {
      [id]: {
        name: currentText,
        text: currentText,
        details: {
          text: currentText,
          height: newHeight,
        },
      },
    },
  });

  const { timeline } = useStore.getState();
  if (timeline) {
    const fabricObjects = timeline.getObjects ? timeline.getObjects() : [];
    const itemNode = fabricObjects.find((obj) => obj.id === id);

    if (itemNode) {
      itemNode.text = currentText;
      if (itemNode.details) {
        itemNode.details.text = currentText;
      }
      itemNode.name = currentText;
    }
    timeline.requestRenderAll?.();
  }
};

CanvasTimeline.registerItems({
  Text: TextItem,
  Image: ImageItem,
  Video: VideoItem,
  Audio: AudioItem,
  Caption: CaptionItem,
  Helper,
  Track,
  PreviewTrackItem,
});

// ==========================================
// 3. ÍCONES E COMPONENTES AUXILIARES DO HEADER
// ==========================================
const IconPlayerPlayFilled = ({ size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} viewBox="0 0 24 24" fill="currentColor">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z" />
  </svg>
);

const IconPlayerPauseFilled = ({ size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} viewBox="0 0 24 24" fill="currentColor">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
    <path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
  </svg>
);

const IconPlayerSkipBack = ({ size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M20 5v14l-12 -7z" />
    <path d="M4 5l0 14" />
  </svg>
);

const IconPlayerSkipForward = ({ size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 5v14l12 -7z" />
    <path d="M20 5l0 14" />
  </svg>
);

const ZoomControl = ({ scale, onChangeTimelineScale, duration }) => {
  const [localValue, setLocalValue] = useState(scale.index);

  useEffect(() => {
    setLocalValue(scale.index);
  }, [scale.index]);

  const onZoomOutClick = () => {
    const previousZoom = getPreviousZoomLevel(scale);
    onChangeTimelineScale(previousZoom);
  };

  const onZoomInClick = () => {
    const nextZoom = getNextZoomLevel(scale);
    onChangeTimelineScale(nextZoom);
  };

  const onZoomFitClick = () => {
    const fitZoom = getFitZoomLevel(duration, scale.zoom);
    onChangeTimelineScale(fitZoom);
  };

  return (
    <div className="flex items-center justify-end">
      <div className="flex border-l border-border pl-4 pr-2">
        <Button size={"icon"} variant={"ghost"} onClick={onZoomOutClick}>
          <ZoomOut size={16} />
        </Button>
        <Slider
          className="w-28"
          value={[localValue]}
          min={0}
          max={12}
          step={1}
          onValueChange={(e) => setLocalValue(e[0])}
          onValueCommit={() => {
            const zoom = getZoomByIndex(localValue);
            onChangeTimelineScale(zoom);
          }}
        />
        <Button size={"icon"} variant={"ghost"} onClick={onZoomInClick}>
          <ZoomIn size={16} />
        </Button>
        <Button onClick={onZoomFitClick} variant={"ghost"} size={"icon"}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M20 8V6h-2q-.425 0-.712-.288T17 5t.288-.712T18 4h2q.825 0 1.413.588T22 6v2q0 .425-.288.713T21 9t-.712-.288T20 8M2 8V6q0-.825.588-1.412T4 4h2q.425 0 .713.288T7 5t-.288.713T6 6H4v2q0 .425-.288.713T3 9t-.712-.288T2 8m18 12h-2q-.425 0-.712-.288T17 19t.288-.712T18 18h2v-2q0-.425.288-.712T21 15t.713.288T22 16v2q0 .825-.587 1.413T20 20M4 20q-.825 0-1.412-.587T2 18v-2q0-.425.288-.712T3 15t.713.288T4 16v2h2q.425 0 .713.288T7 19t-.288.713T6 20zm2-6v-4q0-.825.588-1.412T8 8h8q.825 0 1.413.588T18 10v4q0 .825-.587 1.413T16 16H8q-.825 0-1.412-.587T6 14"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
};

const Header = () => {
  const [playing, setPlaying] = useState(false);
  const { duration, fps, scale, playerRef, activeIds } = useStore();

  useUpdateAnsestors({ playing, playerRef });
  const currentFrame = useCurrentPlayerFrame(playerRef);

  const doActiveDelete = () => dispatch(LAYER_DELETE);
  const doActiveSplit = () => {
    dispatch(ACTIVE_SPLIT, {
      payload: {},
      options: { time: getCurrentTime() },
    });
  };

  const changeScale = (newScale) => {
    dispatch(TIMELINE_SCALE_CHANGED, { payload: { scale: newScale } });
  };

  const handlePlay = () => dispatch(PLAYER_PLAY);
  const handlePause = () => dispatch(PLAYER_PAUSE);

  useEffect(() => {
    const p = playerRef?.current;
    if (!p) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [playerRef]);

  return (
    <div style={{ position: "relative", height: "50px", flex: "none" }}>
      <div style={{ position: "absolute", height: 50, width: "100%", display: "flex", alignItems: "center" }}>
        <div style={{ height: 36, width: "100%", display: "grid", gridTemplateColumns: "1fr 260px 1fr", alignItems: "center" }}>
          <div className="flex px-2">
            <Button disabled={!activeIds.length} onClick={doActiveDelete} variant={"ghost"} size={"sm"} className="flex items-center gap-1 px-2">
              <Trash size={14} /> Delete
            </Button>
            <Button disabled={!activeIds.length} onClick={doActiveSplit} variant={"ghost"} size={"sm"} className="flex items-center gap-1 px-2">
              <SquareSplitHorizontal size={15} /> Split
            </Button>
            <Button disabled={!activeIds.length} onClick={() => dispatch(LAYER_CLONE)} variant={"ghost"} size={"sm"} className="flex items-center gap-1 px-2">
              <SquareSplitHorizontal size={15} /> Clone
            </Button>
          </div>
          <div className="flex items-center justify-center">
            <div>
              <Button onClick={doActiveDelete} variant={"ghost"} size={"icon"}>
                <IconPlayerSkipBack size={14} />
              </Button>
              <Button onClick={playing ? handlePause : handlePlay} variant={"ghost"} size={"icon"}>
                {playing ? <IconPlayerPauseFilled size={14} /> : <IconPlayerPlayFilled size={14} />}
              </Button>
              <Button onClick={doActiveSplit} variant={"ghost"} size={"icon"}>
                <IconPlayerSkipForward size={14} />
              </Button>
            </div>
            <div className="text-xs font-light" style={{ display: "grid", alignItems: "center", gridTemplateColumns: "54px 4px 54px", paddingTop: "2px", justifyContent: "center" }}>
              <div className="font-medium text-zinc-200" style={{ display: "flex", justifyContent: "center" }} data-current-time={currentFrame / fps} id="video-current-time">
                {frameToTimeString({ frame: currentFrame }, { fps })}
              </div>
              <span>/</span>
              <div className="text-muted-foreground" style={{ display: "flex", justifyContent: "center" }}>
                {timeToString({ time: duration })}
              </div>
            </div>
          </div>
          <ZoomControl scale={scale} onChangeTimelineScale={changeScale} duration={duration} />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. RULER (RÉGUA DA TIMELINE)
// ==========================================
function Ruler(props) {
  const {
    height = 40,
    longLineSize = 8,
    shortLineSize = 10,
    offsetX = TIMELINE_OFFSET_X + TIMELINE_OFFSET_CANVAS_LEFT,
    textOffsetY = 17,
    textFormat = formatTimelineUnit,
    scrollLeft: scrollPos = 0,
    onClick,
  } = props;
  const { scale } = useStore();
  const canvasRef = useRef(null);
  const [canvasContext, setCanvasContext] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height });

  const draw = (context, sPos, width, h) => {
    const zoom = scale.zoom;
    const unit = scale.unit;
    const segments = scale.segments;
    context.clearRect(0, 0, width, h);
    context.save();
    context.strokeStyle = "#71717a";
    context.fillStyle = "#71717a";
    context.lineWidth = 1;
    context.font = `${SMALL_FONT_SIZE}px ${SECONDARY_FONT}`;
    context.textBaseline = "top";

    context.translate(0.5, 0);
    context.beginPath();

    const zoomUnit = unit * zoom * PREVIEW_FRAME_WIDTH;
    const minRange = Math.floor(sPos / zoomUnit);
    const maxRange = Math.ceil((sPos + width) / zoomUnit);
    const length = maxRange - minRange;

    for (let i = 0; i <= length; ++i) {
      const value = i + minRange;
      if (value < 0) continue;
      const startValue = (value * zoomUnit) / zoom;
      const startPos = (startValue - sPos / zoom) * zoom;
      if (startPos < -zoomUnit || startPos >= width + zoomUnit) continue;
      const text = textFormat(startValue);
      const textWidth = context.measureText(text).width;
      const textOffsetX = -textWidth / 2;
      context.fillText(text, startPos + textOffsetX + offsetX, textOffsetY);
    }

    for (let i = 0; i <= length; ++i) {
      const value = i + minRange;
      if (value < 0) continue;
      const startValue = value * zoomUnit;
      const startPos = startValue - sPos + offsetX;

      for (let j = 0; j < segments; ++j) {
        const pos = startPos + (j / segments) * zoomUnit;
        if (pos < 0 || pos >= width) continue;
        const lineSize = j % segments ? shortLineSize : longLineSize;
        context.strokeStyle = lineSize === shortLineSize ? "#52525b" : "#18181b";
        const origin = 18;
        const [x1, y1] = [pos, origin];
        const [x2, y2] = [x1, y1 + lineSize];
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        if (lineSize === shortLineSize) context.stroke();
      }
    }
    context.restore();
  };

  const resizeCanvas = (canvas, context, sPos) => {
    if (!canvas || !context) return;
    const offsetParent = canvas.offsetParent;
    const width = offsetParent?.offsetWidth ?? canvas.offsetWidth;
    const h = canvasSize.height;
    canvas.width = width;
    canvas.height = h;
    draw(context, sPos, width, h);
    setCanvasSize({ width, height: h });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      setCanvasContext(context);
      resizeCanvas(canvas, context, scrollPos);
    }
  }, []);

  const handleResize = useCallback(() => {
    resizeCanvas(canvasRef.current, canvasContext, scrollPos);
  }, [canvasContext, scrollPos]);

  useEffect(() => {
    const resizeHandler = debounce(handleResize, 200);
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
  }, [handleResize]);

  useEffect(() => {
    if (canvasContext) {
      resizeCanvas(canvasRef.current, canvasContext, scrollPos);
    }
  }, [canvasContext, scrollPos, scale]);

  const handleClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const totalX = clickX + scrollPos - TIMELINE_OFFSET_X - TIMELINE_OFFSET_CANVAS_LEFT;
    onClick?.(totalX);
  };

  return (
    <div className="border-t border-border" style={{ position: "relative", width: "100%", height: `${canvasSize.height}px` }}>
      <canvas onMouseUp={handleClick} ref={canvasRef} height={canvasSize.height} />
    </div>
  );
}

// ==========================================
// 5. PLAYHEAD (AGULHA DA TIMELINE)
// ==========================================
function Playhead({ scrollLeft }) {
  const playheadRef = useRef(null);
  const { playerRef, fps, scale } = useStore();
  const currentFrame = useCurrentPlayerFrame(playerRef);
  const position = timeMsToUnits((currentFrame / fps) * 1000, scale.zoom) - scrollLeft;
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPosition, setDragStartPosition] = useState(position);

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    setDragStartPosition(position);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const delta = clientX - dragStartX + scrollLeft;
      const newPosition = dragStartPosition + delta;
      const time = unitsToTimeMs(newPosition, scale.zoom);
      playerRef?.current?.seekTo((time * fps) / 1000);
    }
  };

  useEffect(() => {
    const preventDefaultDrag = (e) => e.preventDefault();
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleMouseMove);
      document.addEventListener("touchend", handleMouseUp);
      document.addEventListener("dragstart", preventDefaultDrag);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("dragstart", preventDefaultDrag);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("dragstart", preventDefaultDrag);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={playheadRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: "absolute",
        left: 40 + TIMELINE_OFFSET_CANVAS_LEFT + position,
        top: 50,
        width: 1,
        height: "calc(100% - 40px)",
        zIndex: 10,
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      <div style={{ borderRadius: "0 0 4px 4px" }} className="absolute top-0 h-4 w-2 -translate-x-1/2 transform bg-white text-xs font-semibold text-zinc-800" />
      <div className="relative h-full">
        <div className="absolute top-0 h-full w-3 -translate-x-1/2 transform" />
        <div className="absolute top-0 h-full w-0.5 -translate-x-1/2 transform bg-white/50" />
      </div>
    </div>
  );
}

// ==========================================
// 6. TIMELINE PRINCIPAL
// ==========================================
const EMPTY_SIZE = { width: 0, height: 0 };

const Timeline = ({ stateManager }) => {
  const canScrollRef = useRef(false);
  const timelineContainerRef = useRef(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef(null);
  const canvasElRef = useRef(null);
  const canvasRef = useRef(null);
  const verticalScrollbarVpRef = useRef(null);
  const horizontalScrollbarVpRef = useRef(null);

  const { scale, playerRef, fps, duration, setState, timeline, setTimeline } = useStore();
  const currentFrame = useCurrentPlayerFrame(playerRef);
  const [canvasSize, setCanvasSize] = useState(EMPTY_SIZE);
  const [size, setSize] = useState(EMPTY_SIZE);

  const onScroll = (v) => {
    if (horizontalScrollbarVpRef.current && verticalScrollbarVpRef.current) {
      verticalScrollbarVpRef.current.scrollTop = -v.scrollTop;
      horizontalScrollbarVpRef.current.scrollLeft = -v.scrollLeft;
      setScrollLeft(-v.scrollLeft);
    }
  };

  useEffect(() => {
    if (playerRef?.current) {
      canScrollRef.current = Boolean(playerRef.current.isPlaying?.());
    }
  });

  useEffect(() => {
    const position = timeMsToUnits((currentFrame / fps) * 1000, scale.zoom);
    const canvasBoudingX =
      canvasElRef.current?.getBoundingClientRect().x +
      canvasElRef.current?.clientWidth;
    const playHeadPos = position - scrollLeft + 40;
    if (playHeadPos >= canvasBoudingX) {
      const scrollDivWidth = horizontalScrollbarVpRef.current?.clientWidth || 0;
      const totalScrollWidth = horizontalScrollbarVpRef.current?.scrollWidth || 0;
      const currentPosScroll = horizontalScrollbarVpRef.current?.scrollLeft || 0;
      const availableScroll = totalScrollWidth - (scrollDivWidth + currentPosScroll);
      const scaleScroll = availableScroll / scrollDivWidth;
      if (scaleScroll >= 0) {
        if (scaleScroll > 1) {
          horizontalScrollbarVpRef.current?.scrollTo({ left: currentPosScroll + scrollDivWidth });
        } else {
          horizontalScrollbarVpRef.current?.scrollTo({ left: totalScrollWidth - scrollDivWidth });
        }
      }
    }
  }, [currentFrame, fps, scale.zoom, scrollLeft]);

  const onResizeCanvas = (payload) => {
    setCanvasSize({ width: payload.width, height: payload.height });
  };

  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const timelineContainerEl = timelineContainerRef.current;
    if (!canvasEl || !timelineContainerEl) return;

    const containerWidth = timelineContainerEl.clientWidth - 40;
    const containerHeight = timelineContainerEl.clientHeight - 90;
    const canvas = new CanvasTimeline(canvasEl, {
      width: containerWidth,
      height: containerHeight,
      bounding: { width: containerWidth, height: 0 },
      selectionColor: "rgba(0, 216, 214,0.1)",
      selectionBorderColor: "rgba(0, 216, 214,1.0)",
      onScroll,
      onResizeCanvas,
      scale,
      state: stateManager,
      duration,
      spacing: {
        left: TIMELINE_OFFSET_CANVAS_LEFT,
        right: TIMELINE_OFFSET_CANVAS_RIGHT,
      },
      sizesMap: {
        caption: 32,
        text: 32,
        audio: 36,
        customTrack: 40,
        customTrack2: 40,
      },
      acceptsMap: {
        text: ["text", "caption"],
        image: ["image", "video"],
        video: ["video", "image"],
        audio: ["audio"],
        caption: ["caption", "text"],
        template: ["template"],
        customTrack: ["video", "image"],
        customTrack2: ["video", "image"],
        main: ["video", "image"],
      },
      guideLineColor: "#ffffff",
    });

    canvasRef.current = canvas;
    setCanvasSize({ width: containerWidth, height: containerHeight });
    setSize({ width: containerWidth, height: 0 });
    setTimeline(canvas);

    const resizeDesignSubscription = stateManager.subscribeToSize((newState) => setState(newState));
    const scaleSubscription = stateManager.subscribeToScale((newState) => setState(newState));
    const tracksSubscription = stateManager.subscribeToState((newState) => setState(newState));
    const durationSubscription = stateManager.subscribeToDuration((newState) => setState(newState));
    const updateTrackItemsMap = stateManager.subscribeToUpdateTrackItem(() => {
      const currentState = stateManager.getState();
      setState({ duration: currentState.duration, trackItemsMap: currentState.trackItemsMap });
    });
    const itemsDetailsSubscription = stateManager.subscribeToAddOrRemoveItems(() => {
      const currentState = stateManager.getState();
      setState({
        trackItemDetailsMap: currentState.trackItemDetailsMap,
        trackItemsMap: currentState.trackItemsMap,
        trackItemIds: currentState.trackItemIds,
        tracks: currentState.tracks,
      });
    });
    const updateItemDetailsSubscription = stateManager.subscribeToUpdateItemDetails(() => {
      const currentState = stateManager.getState();
      setState({ trackItemDetailsMap: currentState.trackItemDetailsMap });
    });

    return () => {
      canvas.purge();
      scaleSubscription.unsubscribe();
      tracksSubscription.unsubscribe();
      durationSubscription.unsubscribe();
      itemsDetailsSubscription.unsubscribe();
      updateTrackItemsMap.unsubscribe();
      updateItemDetailsSubscription.unsubscribe();
      resizeDesignSubscription.unsubscribe();
    };
  }, []);

  const handleOnScrollH = (e) => {
    const nextScrollLeft = e.currentTarget.scrollLeft;
    if (canScrollRef.current) {
      canvasRef.current?.scrollTo({ scrollLeft: nextScrollLeft });
    }
    setScrollLeft(nextScrollLeft);
  };

  const handleOnScrollV = (e) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (canScrollRef.current) {
      canvasRef.current?.scrollTo({ scrollTop });
    }
  };

  useEffect(() => {
    const addEvents = subject.pipe(filter(({ key }) => key.startsWith(TIMELINE_PREFIX)));
    const subscription = addEvents.subscribe((obj) => {
      if (obj.key === TIMELINE_BOUNDING_CHANGED) {
        const bounding = obj.value?.payload?.bounding;
        if (bounding) {
          setSize({ width: bounding.width, height: bounding.height });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const onClickRuler = (units) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const time = unitsToTimeMs(units, scale.zoom);
    playerRef?.current?.seekTo((time * fps) / 1000);
  };

  useEffect(() => {
    const availableScroll = horizontalScrollbarVpRef.current?.scrollWidth;
    if (!availableScroll || !timeline) return;
    const canvasWidth = timeline.width;
    if (availableScroll < canvasWidth + scrollLeft) {
      timeline.scrollTo({ scrollLeft: availableScroll - canvasWidth });
    }
  }, [scale, timeline, scrollLeft]);

  return (
    <div
      ref={timelineContainerRef}
      id="timeline-container"
      className="relative h-full w-full overflow-hidden bg-sidebar"
    >
      <Header />
      <Ruler onClick={onClickRuler} scrollLeft={scrollLeft} />
      <Playhead scrollLeft={scrollLeft} />
      <div className="flex">
        <div className="relative w-10 flex-none" />
        <div style={{ height: canvasSize.height }} className="relative flex-1">
          <div style={{ height: canvasSize.height }} ref={containerRef} className="absolute top-0 w-full">
            <canvas id="designcombo-timeline-canvas" ref={canvasElRef} />
          </div>
          <ScrollArea.Root
            type="always"
            style={{ position: "absolute", width: "calc(100vw - 40px)", height: "10px" }}
            className="ScrollAreaRootH"
            onPointerDown={() => { canScrollRef.current = true; }}
            onPointerUp={() => { canScrollRef.current = false; }}
          >
            <ScrollArea.Viewport onScroll={handleOnScrollH} className="ScrollAreaViewport" id="viewportH" ref={horizontalScrollbarVpRef}>
              <div
                style={{
                  width: size.width > canvasSize.width ? size.width + TIMELINE_OFFSET_CANVAS_RIGHT : size.width,
                }}
                className="pointer-events-none h-[10px]"
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
              <ScrollArea.Thumb
                onMouseDown={() => { canScrollRef.current = true; }}
                onMouseUp={() => { canScrollRef.current = false; }}
                className="ScrollAreaThumb"
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          <ScrollArea.Root
            type="always"
            style={{ position: "absolute", height: canvasSize.height, width: "10px" }}
            className="ScrollAreaRootV"
          >
            <ScrollArea.Viewport onScroll={handleOnScrollV} className="ScrollAreaViewport" ref={verticalScrollbarVpRef}>
              <div
                style={{
                  height: size.height > canvasSize.height ? size.height + 40 : canvasSize.height,
                }}
                className="pointer-events-none w-[10px]"
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
              <ScrollArea.Thumb
                onMouseDown={() => { canScrollRef.current = true; }}
                onMouseUp={() => { canScrollRef.current = false; }}
                className="ScrollAreaThumb"
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
      </div>
    </div>
  );
};

export default Timeline;