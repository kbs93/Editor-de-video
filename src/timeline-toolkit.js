import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { generateId } from "@designcombo/timeline";
import {
  FRAME_INTERVAL,
  PREVIEW_FRAME_WIDTH,
  TIMELINE_OFFSET_X,
} from "./editor-store";

// ==========================================
// 1. HELPERS MATEMÁTICOS E NÍVEIS DE ZOOM
// ==========================================
export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function findIndex(arr, predicate) {
  let l = -1;
  let r = arr.length - 1;

  while (1 + l < r) {
    const mid = l + ((r - l) >> 1);
    const cmp = predicate(arr[mid], mid, arr);
    cmp ? (r = mid) : (l = mid);
  }

  return r;
}

export const TIMELINE_ZOOM_LEVELS = [
  { index: 0, unit: 18000, zoom: 1 / 18000, segments: 5 },
  { index: 1, unit: 10800, zoom: 1 / 10800, segments: 5 },
  { index: 2, unit: 7200, zoom: 1 / 7200, segments: 5 },
  { index: 3, unit: 3600, zoom: 1 / 3600, segments: 5 },
  { index: 4, unit: 1800, zoom: 1 / 1800, segments: 5 },
  { index: 5, unit: 900, zoom: 1 / 900, segments: 5 },
  { index: 6, unit: 600, zoom: 1 / 600, segments: 5 },
  { index: 7, unit: 300, zoom: 1 / 300, segments: 5 },
  { index: 8, unit: 180, zoom: 1 / 180, segments: 3 },
  { index: 9, unit: 120, zoom: 1 / 120, segments: 10 },
  { index: 10, unit: 60, zoom: 1 / 60, segments: 3 },
  { index: 11, unit: 60, zoom: 1 / 60, segments: 4 },
  { index: 12, unit: 30, zoom: 1 / 30, segments: 5 },
];

export const getPreviousZoom = (currentZoom) => {
  const smallerZoomLevels = TIMELINE_ZOOM_LEVELS.filter(
    (level) => level.zoom < currentZoom.zoom
  );
  if (smallerZoomLevels.length === 0) return null;
  return smallerZoomLevels.reduce((prev, curr) =>
    curr.zoom > prev.zoom ? curr : prev
  );
};

export const getNextZoom = (currentZoom) => {
  const largerZoomLevels = TIMELINE_ZOOM_LEVELS.filter(
    (level) => level.zoom > currentZoom.zoom
  );
  if (largerZoomLevels.length === 0) return null;
  return largerZoomLevels.reduce((prev, curr) =>
    curr.zoom < prev.zoom ? curr : prev
  );
};

export function getPreviousZoomLevel(currentZoom) {
  const previousZoom = getPreviousZoom(currentZoom);
  return previousZoom || TIMELINE_ZOOM_LEVELS[0];
}

export function getZoomByIndex(index) {
  return TIMELINE_ZOOM_LEVELS[index];
}

export function getNextZoomLevel(currentZoom) {
  const nextZoom = getNextZoom(currentZoom);
  return nextZoom || TIMELINE_ZOOM_LEVELS[TIMELINE_ZOOM_LEVELS.length - 1];
}

export function getFitZoomLevel(totalLengthMs, zoom = 1) {
  const getVisibleWidth = () => {
    const scrollOffset = TIMELINE_OFFSET_X;
    const clampedScrollOffset = Math.max(0, scrollOffset);
    const timelineCanvas = document.getElementById(
      "designcombo-timeline-canvas"
    );
    const offsetWidth =
      timelineCanvas?.offsetWidth ?? document.body.offsetWidth;
    return Math.max(1, offsetWidth - clampedScrollOffset);
  };

  const getFullWidth = () => {
    if (typeof totalLengthMs === "number") {
      return timeMsToUnits(totalLengthMs, zoom);
    }
    return calculateTimelineWidth(totalLengthMs, zoom);
  };

  const multiplier = getVisibleWidth() / getFullWidth();
  const targetZoom = zoom * multiplier;

  const fitZoomIndex = findIndex(TIMELINE_ZOOM_LEVELS, (level) => {
    return level.zoom > targetZoom;
  });

  return {
    segments: 5,
    index: fitZoomIndex,
    zoom: targetZoom,
    unit: 1 / targetZoom,
  };
}

// ==========================================
// 2. CONVERSÕES DE TEMPO, FRAMES E ESCALA
// ==========================================
export const frameToTimeString = ({ frame }, { fps }) => {
  const totalSeconds = frame / fps;
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.floor(remainingSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const timeToString = ({ time }) => {
  const totalSeconds = time / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = Math.floor(remainingSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export const getCurrentTime = () => {
  const currentTimeElement = document.getElementById("video-current-time");
  let currentTimeSeconds = currentTimeElement
    ? parseFloat(currentTimeElement.getAttribute("data-current-time"))
    : 0;
  return currentTimeSeconds * 1000;
};

export function timeMsToUnits(timeMs, zoom = 1) {
  const zoomedFrameWidth = PREVIEW_FRAME_WIDTH * zoom;
  const frames = timeMs * (60 / 1000);
  return frames * zoomedFrameWidth;
}

export function unitsToTimeMs(units, zoom = 1) {
  const zoomedFrameWidth = PREVIEW_FRAME_WIDTH * zoom;
  const frames = units / zoomedFrameWidth;
  return frames * FRAME_INTERVAL;
}

export function calculateTimelineWidth(totalLengthMs, zoom = 1) {
  return timeMsToUnits(totalLengthMs, zoom);
}

export const calculateFrames = (display, fps) => {
  const from = (display.from / 1000) * fps;
  const durationInFrames = (display.to / 1000) * fps - from;
  return { from, durationInFrames };
};

export function formatTimelineUnit(units) {
  if (!units) return "0";
  const time = units / PREVIEW_FRAME_WIDTH;

  const frames = Math.trunc(time) % 60;
  const seconds = Math.trunc(time / 60) % 60;
  const minutes = Math.trunc(time / 3600) % 60;
  const hours = Math.trunc(time / 216000);
  const formattedTime = [
    hours.toString(),
    minutes.toString(),
    seconds.toString(),
    frames.toString(),
  ];

  if (time < 60) {
    return `${formattedTime[3].padStart(2, "0")}f`;
  }
  if (time < 3600) {
    return `${formattedTime[2].padStart(1, "0")}s`;
  }
  if (time < 216000) {
    return `${formattedTime[1].padStart(2, "0")}:${formattedTime[2].padStart(2, "0")}`;
  }
  return `${formattedTime[0].padStart(2, "0")}:${formattedTime[1].padStart(2, "0")}:${formattedTime[2].padStart(2, "0")}`;
}

export function formatTimeToHumanReadable(ms, includeFrames = false) {
  if (!ms) return "00:00";

  const fps = 60;
  const msPerFrame = 1000 / fps;

  if (ms < 1000) {
    if (includeFrames) {
      const frames = Math.floor(ms / msPerFrame);
      return `${frames}f`;
    } else {
      const seconds = (ms / 1000).toFixed(1);
      return `${seconds}s`;
    }
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  return `${hours.toString().padStart(2, "0")}:${remainingMinutes
    .toString()
    .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function millisecondsToHHMMSS(ms) {
  if (ms < 0) return "00:00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// ==========================================
// 3. UTILITÁRIOS DE FICHEIROS E STREAM
// ==========================================
export const getBlobFromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  return blob;
};

export const getFileFromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const filename = url.split("/").pop() || "video.mp4";
  const file = new File([blob], filename);
  return file;
};

export const fileToBlob = async (file) => {
  const blob = await new Response(file.stream()).blob();
  return blob;
};

export const blobToStream = async (blob) => {
  const file = new File([blob], "video.mp4");
  const stream = file.stream();
  return stream;
};

export const getStreamFromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], "video.mp4");
  const stream = file.stream();
  return stream;
};

// ==========================================
// 4. CACHE DE MINIATURAS (ThumbnailCache)
// ==========================================
export class ThumbnailCache {
  cache = {};
  maxCacheSize = 500;
  accessOrder = [];

  setThumbnail(timestamp, img) {
    if (this.accessOrder.length >= this.maxCacheSize) {
      const oldestTimestamp = this.accessOrder.shift();
      if (oldestTimestamp !== undefined) {
        delete this.cache[oldestTimestamp];
      }
    }
    this.cache[timestamp] = img;
    this.accessOrder.push(timestamp);
  }

  getThumbnail(timestamp) {
    const img = this.cache[timestamp];
    if (img) {
      this.accessOrder = this.accessOrder.filter((t) => t !== timestamp);
      this.accessOrder.push(timestamp);
    }
    return img;
  }

  clearCache() {
    this.cache = {};
    this.accessOrder = [];
  }

  clearCacheButFallback() {
    const fallback = this.getThumbnail("fallback");
    this.cache = {};
    this.accessOrder = [];
    this.setThumbnail("fallback", fallback);
  }
}

// ==========================================
// 5. UTILITÁRIOS DE LEGENDAS
// ==========================================
export const generateCaption = (captionLine, fontInfo, options, sourceUrl) => {
  return {
    id: generateId(),
    type: "caption",
    name: "Caption",
    display: {
      from: options.displayFrom + captionLine.start * 1000,
      to: options.displayFrom + captionLine.end * 1000,
    },
    metadata: {
      words: captionLine.words.map((w) => ({
        ...w,
        start: w.start * 1000,
        end: w.end * 1000,
      })),
      sourceUrl,
      parentId: options.parentId,
    },
    details: {
      top: 800,
      text: captionLine.text,
      fontSize: fontInfo.fontSize,
      width: options.containerWidth,
      fontFamily: fontInfo.fontFamily,
      fontUrl: fontInfo.fontUrl,
      color: "#ff4757",
      textAlign: "center",
    },
  };
};

function createCaptionLines(input, fontInfo, options) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${fontInfo.fontSize}px ${fontInfo.fontFamily}`;

  const captionLines = [];
  const words = input.results.main.words;

  let currentLine = {
    text: "",
    words: [],
    width: 0,
    start: words.length > 0 ? words[0].start : 0,
    end: 0,
  };
  let linesCount = 0;

  words.forEach((wordObj, index) => {
    const wordWidth = context.measureText(wordObj.word).width;

    if (
      currentLine.width + wordWidth > options.containerWidth - 64 ||
      currentLine.text.endsWith(".")
    ) {
      const advance = currentLine.text.endsWith(".");
      if (linesCount + 1 === options.linesPerCaption || advance) {
        captionLines.push(currentLine);
        linesCount = 0;
        currentLine = {
          text: "",
          words: [],
          width: 0,
          start: wordObj.start,
          end: wordObj.end,
        };
      } else {
        linesCount += 1;
        currentLine.width = 0;
      }
    }

    currentLine.text += (currentLine.text ? " " : "") + wordObj.word;
    currentLine.words.push(wordObj);
    currentLine.width += wordWidth;
    currentLine.end = wordObj.end;

    if (index === words.length - 1 && currentLine.text) {
      captionLines.push(currentLine);
    }
  });

  return captionLines;
}

export function generateCaptions(input, fontInfo, options) {
  const captionLines = createCaptionLines(input, fontInfo, options);
  return captionLines.map((line) =>
    generateCaption(line, fontInfo, options, input.sourceUrl)
  );
}

// ==========================================
// 6. MINIATURAS E AGRUPAMENTO DE PISTAS
// ==========================================
export const calculateThumbnailSegmentLayout = (thumbnailWidth) => {
  const maxThumbnails = Math.floor(1200 / thumbnailWidth);
  const segmentSize = maxThumbnails * thumbnailWidth;
  return { thumbnailsPerSegment: maxThumbnails, segmentSize };
};

export const calculateOffscreenSegments = (
  offscreenWidth,
  trimFromSize,
  segmentSize
) => {
  return Math.floor((offscreenWidth + trimFromSize) / segmentSize);
};

export function matchTimestampsToNearestThumbnails(
  timestamps,
  thumbnailsList
) {
  const results = [];
  timestamps.forEach((ts) => {
    const closestThumbnail = thumbnailsList.reduce((prev, curr) => {
      return Math.abs(curr.ts - ts) < Math.abs(prev.ts - ts) ? curr : prev;
    });
    results.push({ ts, url: closestThumbnail.url });
  });
  return results;
}

export const groupTrackItems = (data) => {
  const { trackItemIds, transitionsMap, trackItemsMap } = data;
  const itemTransitionMap = new Map();

  Object.values(transitionsMap).forEach((transition) => {
    const { fromId, toId, kind } = transition;
    if (kind === "none") return;
    if (!itemTransitionMap.has(fromId)) itemTransitionMap.set(fromId, []);
    if (!itemTransitionMap.has(toId)) itemTransitionMap.set(toId, []);
    itemTransitionMap.get(fromId)?.push(transition);
    itemTransitionMap.get(toId)?.push(transition);
  });

  const groups = [];
  const processed = new Set();

  const buildGroup = (startItemId) => {
    const group = [];
    let currentId = startItemId;

    while (currentId) {
      if (processed.has(currentId)) break;
      processed.add(currentId);
      const currentItem = trackItemsMap[currentId];
      group.push(currentItem);

      const transition = Object.values(transitionsMap).find(
        (t) => t.fromId === currentId && t.kind !== "none"
      );
      if (!transition) break;

      group.push(transition);
      currentId = transition.toId;
    }
    return group;
  };

  for (const itemId of trackItemIds) {
    if (processed.has(itemId)) continue;
    if (
      !itemTransitionMap.has(itemId) ||
      !Object.values(transitionsMap).some((t) => t.toId === itemId)
    ) {
      const group = buildGroup(itemId);
      if (group.length > 0) {
        groups.push(group);
      }
    }
  }

  groups.forEach((group) => {
    group.sort((a, b) => {
      if ("display" in a && "display" in b) {
        return a.display.from - b.display.from;
      }
      return 0;
    });
  });

  return groups;
};

// ==========================================
// 7. HOOK DE ANIMAÇÃO DO REMOTION
// ==========================================
const createPropertyHandler = () => ({
  scale: (value) => ({ transform: `scale(${value})` }),
  opacity: (value) => ({ opacity: value }),
  translateX: (value) => ({ transform: `translateX(${value}px)` }),
  translateY: (value) => ({ transform: `translateY(${value}px)` }),
  rotate: (value) => ({ transform: `rotate(${value}deg)` }),
  default: () => ({}),
});

const interpolateValue = (
  frame,
  animation,
  durationInFrames,
  isOut = false
) => {
  const { from, to, ease } = animation;
  const animationDurationInFrames = animation.durationInFrames || 30;

  const safeFrom = Number(from);
  const safeTo = Number(to);
  const safeDuration = Math.max(1, Number(animationDurationInFrames || 1));

  if (isNaN(safeFrom) || isNaN(safeTo)) {
    console.error("Invalid animation values:", {
      from,
      to,
      animationDurationInFrames,
      property: animation.property,
    });
    return safeFrom;
  }

  const inputRange = isOut
    ? [durationInFrames - animationDurationInFrames, durationInFrames]
    : [0, safeDuration];

  return interpolate(frame, inputRange, [safeFrom, safeTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
};

const calculateStyle = (animation, frame, durationInFrames, isOut) => {
  const { property, durationInFrames: animationDurationInFrames } = animation;
  if (!isOut && frame > animationDurationInFrames) return {};
  const value = interpolateValue(frame, animation, durationInFrames, isOut);
  const propertyHandler = createPropertyHandler();
  return (propertyHandler[property] || propertyHandler.default)(value);
};

export const useAnimation = (animations, durationInFrames, isOut = false) => {
  const frame = useCurrentFrame();
  return React.useMemo(() => {
    if (!animations || animations.length === 0) return {};

    return animations.reduce((style, anim) => {
      if (anim?.from === undefined || anim?.to === undefined) {
        console.error("Invalid animation object:", anim);
        return style;
      }
      const newStyle = calculateStyle(anim, frame, durationInFrames, isOut);
      return { ...style, ...newStyle };
    }, {});
  }, [animations, frame, durationInFrames, isOut]);
};

export const combineAnimations = (animations) => {
  if (!animations) return [];
  return Array.isArray(animations) ? animations : [animations];
};

// ==========================================
// 8. MOTOR DE ANIMAÇÕES DE ENTRADA E SAÍDA
// ==========================================
const getSlideAnimation = (type, anim, item) => {
  const transformString = item.details.transform || "";
  const scaleMatch = /scale\(([^,]+), ([^)]+)\)/.exec(transformString);
  const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
  const left = parseFloat(item.details.left) || 0;
  const top = parseFloat(item.details.top) || 0;
  const width = parseFloat(item.details.width) || 0;
  const height = parseFloat(item.details.height) || 0;

  if (type === "slideInRight" || type === "slideOutLeft") {
    const commonValue = -left - width / scale;
    const from = type.includes("In") ? commonValue : anim.from;
    const to = type.includes("In") ? anim.to : commonValue;
    return {
      property: anim.property,
      from,
      to,
      durationInFrames: anim.durationInFrames,
      ease: Easing[anim.easing],
    };
  } else if (type === "slideInLeft" || type === "slideOutRight") {
    const commonValue = left + width / scale;
    const from = type.includes("In") ? commonValue : anim.from;
    const to = type.includes("In") ? anim.to : commonValue;
    return {
      property: anim.property,
      from,
      to,
      durationInFrames: anim.durationInFrames,
      ease: Easing[anim.easing],
    };
  } else if (type === "slideInBottom" || type === "slideOutTop") {
    const commonValue = -top - height / scale;
    const from = type.includes("In") ? commonValue : anim.from;
    const to = type.includes("In") ? anim.to : commonValue;
    return {
      property: anim.property,
      from,
      to,
      durationInFrames: anim.durationInFrames,
      ease: Easing[anim.easing],
    };
  } else if (type === "slideInTop" || type === "slideOutBottom") {
    const commonValue = top + height / scale;
    const from = type.includes("In") ? commonValue : anim.from;
    const to = type.includes("In") ? anim.to : commonValue;
    return {
      property: anim.property,
      from,
      to,
      durationInFrames: anim.durationInFrames,
      ease: Easing[anim.easing],
    };
  }
};

export const getAnimations = (animation, item) => {
  let animationIn = null;
  let animationOut = null;
  if (animation?.in) {
    animationIn = [];
    animation.in.composition?.forEach((comp) => {
      if (animation.in.name?.includes("slide")) {
        animationIn.push(getSlideAnimation(animation.in.name, comp, item));
      } else {
        animationIn.push({
          property: comp.property,
          from: comp.from,
          to: comp.to,
          durationInFrames: comp.durationInFrames,
          ease: Easing[comp.easing],
        });
      }
    });
  }
  if (animation?.out) {
    animationOut = [];
    animation.out.composition?.forEach((comp) => {
      if (animation.out.name?.includes("slide")) {
        animationOut.push(getSlideAnimation(animation.out.name, comp, item));
      } else {
        animationOut.push({
          property: comp.property,
          from: comp.from,
          to: comp.to,
          durationInFrames: comp.durationInFrames,
          ease: Easing[comp.easing],
        });
      }
    });
  }
  return { animationIn, animationOut };
};

export default ThumbnailCache;