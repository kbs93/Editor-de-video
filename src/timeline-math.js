import {
  FRAME_INTERVAL,
  PREVIEW_FRAME_WIDTH,
  TIMELINE_OFFSET_X,
} from "./constants";

// ======================== MATH HELPERS ========================
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

// ======================== ZOOM LEVELS ========================
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

// ======================== TIME HELPERS ========================
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

// ======================== TIMELINE SCALE & UNITS ========================
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

export const getPreviousZoom = (currentZoom) => {
  const smallerZoomLevels = TIMELINE_ZOOM_LEVELS.filter(
    (level) => level.zoom < currentZoom.zoom
  );
  if (smallerZoomLevels.length === 0) return null;
  return smallerZoomLevels.reduce((prev, curr) => (curr.zoom > prev.zoom ? curr : prev));
};

export const getNextZoom = (currentZoom) => {
  const largerZoomLevels = TIMELINE_ZOOM_LEVELS.filter(
    (level) => level.zoom > currentZoom.zoom
  );
  if (largerZoomLevels.length === 0) return null;
  return largerZoomLevels.reduce((prev, curr) => (curr.zoom < prev.zoom ? curr : prev));
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
    const timelineCanvas = document.getElementById("designcombo-timeline-canvas");
    const offsetWidth = timelineCanvas?.offsetWidth ?? document.body.offsetWidth;
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