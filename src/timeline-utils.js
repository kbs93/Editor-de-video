import { generateId } from "@designcombo/timeline";

// ======================== FILE UTILS ========================
export const getBlobFromUrl = async (url) => {
  const response = await fetch(url);
  return await response.blob();
};

export const getFileFromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const filename = url.split("/").pop() || "video.mp4";
  return new File([blob], filename);
};

export const fileToBlob = async (file) => {
  return await new Response(file.stream()).blob();
};

export const blobToStream = async (blob) => {
  const file = new File([blob], "video.mp4");
  return file.stream();
};

export const getStreamFromUrl = async (url) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const file = new File([blob], "video.mp4");
  return file.stream();
};

// ======================== CAPTION UTILS ========================
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

// ======================== FILMSTRIP UTILS ========================
export const calculateThumbnailSegmentLayout = (thumbnailWidth) => {
  const maxThumbnails = Math.floor(1200 / thumbnailWidth);
  const segmentSize = maxThumbnails * thumbnailWidth;
  return { thumbnailsPerSegment: maxThumbnails, segmentSize };
};

export const calculateOffscreenSegments = (offscreenWidth, trimFromSize, segmentSize) => {
  return Math.floor((offscreenWidth + trimFromSize) / segmentSize);
};

export function matchTimestampsToNearestThumbnails(timestamps, thumbnailsList) {
  const results = [];
  timestamps.forEach((ts) => {
    const closestThumbnail = thumbnailsList.reduce((prev, curr) => {
      return Math.abs(curr.ts - ts) < Math.abs(prev.ts - ts) ? curr : prev;
    });
    results.push({ ts, url: closestThumbnail.url });
  });
  return results;
}

import { PREVIEW_FRAME_WIDTH } from "./constants";

// ======================== FORMAT & FRAMES ========================
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

// ======================== TRACK GROUPING ========================
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