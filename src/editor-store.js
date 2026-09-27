import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { create } from "zustand";
import { groupBy } from "lodash";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { dispatch, filter, subject } from "@designcombo/events";
import { ENTER_EDIT_MODE, LAYER_PREFIX, LAYER_SELECTION } from "@designcombo/state";
import { DRAG_END, DRAG_PREFIX, DRAG_START, generateId, TIMELINE_PREFIX, TIMELINE_SEEK } from "@designcombo/timeline";

// ==========================================
// 1. HELPERS GERAIS DE UI E RESPONSIVIDADE
// ==========================================
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

// ==========================================
// 2. CONSTANTES GLOBAIS DA TIMELINE E PLAYER
// ==========================================
export const PREVIEW_FRAME_WIDTH = 188;
export const DEFAULT_FRAMERATE = 60;
export const FRAME_INTERVAL = 1000 / DEFAULT_FRAMERATE;
export const TIMELINE_OFFSET_X = 40;
export const TIMELINE_OFFSET_CANVAS_LEFT = 16;
export const TIMELINE_OFFSET_CANVAS_RIGHT = 80;

// Tipografia
export const DEFAULT_FONT = "Roboto";
export const DEFAULT_WEIGHT = "Regular";
export const SECONDARY_FONT = "Roboto";
export const SECONDARY_FONT_URL =
  "https://fonts.gstatic.com/s/roboto/v29/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf";

export const LARGER_FONT_SIZE = 30;
export const LARGE_FONT_SIZE = 24;
export const NORMAL_FONT_SIZE = 16;
export const SMALL_FONT_SIZE = 12;

// Eventos de Reprodução
export const PLAYER_PREFIX = "player";
export const PLAYER_PLAY = `${PLAYER_PREFIX}:play`;
export const PLAYER_PAUSE = `${PLAYER_PREFIX}:pause`;
export const PLAYER_SEEK = `${PLAYER_PREFIX}:seek`;
export const PLAYER_SEEK_TO = `${PLAYER_PREFIX}:seekTo`;
export const PLAYER_SEEK_BY = `${PLAYER_PREFIX}:seekBy`;
export const PLAYER_TOGGLE_PLAY = `${PLAYER_PREFIX}:togglePlay`;

// Predefinições
export const presets = {};

// Lista de imagens padrão
export const IMAGES = [
  {
    id: "images1",
    details: { src: "https://ik.imagekit.io/wombo/images/img1.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img1.jpg?tr=w-190",
    type: "image",
  },
  {
    id: "images2",
    details: { src: "https://ik.imagekit.io/wombo/images/img2.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img2.jpg?tr=w-190",
    type: "image",
  },
  {
    id: "images3",
    details: { src: "https://ik.imagekit.io/wombo/images/img3.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img3.jpg?tr=w-190",
    type: "image",
  },
  {
    id: "images4",
    details: { src: "https://ik.imagekit.io/wombo/images/img4.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img4.jpg?tr=w-190",
    type: "image",
  },
  {
    id: "images5",
    details: { src: "https://ik.imagekit.io/wombo/images/img5.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img5.jpg?tr=w-190",
    type: "image",
  },
  {
    id: "images6",
    details: { src: "https://ik.imagekit.io/wombo/images/img6.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img6.jpg?tr=w-190",
    type: "image",
  },
  {
    id: "images7",
    details: { src: "https://ik.imagekit.io/wombo/images/img7.jpg" },
    preview: "https://ik.imagekit.io/wombo/images/img7.jpg?tr=w-190",
    type: "image",
  },
];

// Lista de uploads padrão
export const UPLOADS = [
  {
    id: "1",
    src: "https://ik.imagekit.io/snapmotion/upload-video-1.mp4",
    type: "video",
  },
  {
    id: "2",
    src: "https://ik.imagekit.io/snapmotion/upload-video-2.mp4",
    type: "video",
  },
  {
    id: "3",
    src: "https://ik.imagekit.io/snapmotion/upload-video-3.mp4",
    type: "video",
  },
];

// Lista de transições de vídeo disponíveis
export const TRANSITIONS = [
  {
    id: "1",
    kind: "none",
    duration: 0,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/transition-none.png",
    type: "transition",
  },
  {
    id: "2",
    kind: "fade",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/fade.webp",
    type: "transition",
  },
  {
    id: "3",
    kind: "slide",
    name: "slide up",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/slide-up.webp",
    type: "transition",
    direction: "from-bottom",
  },
  {
    id: "4",
    kind: "slide",
    name: "slide down",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/slide-down.webp",
    type: "transition",
    direction: "from-top",
  },
  {
    id: "5",
    kind: "slide",
    name: "slide left",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/slide-left.webp",
    type: "transition",
    direction: "from-right",
  },
  {
    id: "6",
    kind: "slide",
    name: "slide right",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/slide-right.webp",
    type: "transition",
    direction: "from-left",
  },
  {
    id: "7",
    kind: "wipe",
    name: "wipe up",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/wipe-up.webp",
    type: "transition",
    direction: "from-bottom",
  },
  {
    id: "8",
    kind: "wipe",
    name: "wipe down",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/wipe-down.webp",
    type: "transition",
    direction: "from-top",
  },
  {
    id: "9",
    kind: "wipe",
    name: "wipe left",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/wipe-left.webp",
    type: "transition",
    direction: "from-right",
  },
  {
    id: "10",
    kind: "wipe",
    name: "wipe right",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/wipe-right.webp",
    type: "transition",
    direction: "from-left",
  },
  {
    id: "11",
    kind: "flip",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/flip.webp",
    type: "transition",
  },
  {
    id: "12",
    kind: "clockWipe",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/clock-wipe.webp",
    type: "transition",
  },
  {
    id: "13",
    kind: "star",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/star.webp",
    type: "transition",
  },
  {
    id: "14",
    kind: "circle",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/circle.webp",
    type: "transition",
  },
  {
    id: "15",
    kind: "rectangle",
    duration: 0.5,
    preview: "https://ik.imagekit.io/wombo/transitions-v2/rectangle.webp",
    type: "transition",
  },
];

// Payload predefinido para inserção de texto
export const TEXT_ADD_PAYLOAD = {
  id: generateId(),
  display: {
    from: 0,
    to: 5000,
  },
  type: "text",
  details: {
    text: "Heading and some body",
    fontSize: 120,
    width: 600,
    fontUrl: SECONDARY_FONT_URL,
    fontFamily: SECONDARY_FONT,
    color: "#ffffff",
    wordWrap: "break-word",
    textAlign: "center",
    borderWidth: 0,
    borderColor: "#000000",
    boxShadow: {
      color: "#ffffff",
      x: 0,
      y: 0,
      blur: 0,
    },
  },
};

// ==========================================
// 3. UTILITÁRIOS E GESTÃO DE FONTES
// ==========================================
export const loadFonts = (fonts) => {
  const promisesList = fonts.map((font) => {
    return new FontFace(font.name, `url(${font.url})`)
      .load()
      .catch((err) => err);
  });
  return new Promise((resolve, reject) => {
    Promise.all(promisesList)
      .then((res) => {
        res.forEach((uniqueFont) => {
          if (uniqueFont && uniqueFont.family) {
            document.fonts.add(uniqueFont);
            resolve(true);
          }
        });
      })
      .catch((err) => reject(err));
  });
};

const findDefaultFont = (fonts) => {
  const regularFont = fonts.find((font) =>
    font.fullName?.toLowerCase().includes("regular")
  );
  return regularFont ? regularFont : fonts[0];
};

export const getCompactFontData = (fonts) => {
  const compactFontsMap = {};
  const fontsGroupedByFamily = groupBy(fonts, (font) => font.family);

  Object.keys(fontsGroupedByFamily).forEach((family) => {
    const fontsInFamily = fontsGroupedByFamily[family];
    const defaultFont = findDefaultFont(fontsInFamily);
    compactFontsMap[family] = {
      family,
      styles: fontsInFamily,
      default: defaultFont,
    };
  });

  return Object.values(compactFontsMap);
};

// ==========================================
// 4. ESTADOS GLOBAIS (ZUSTAND)
// ==========================================
export const useDataState = create((set) => ({
  fonts: [],
  compactFonts: [],
  setFonts: (fonts) => set({ fonts }),
  setCompactFonts: (compactFonts) => set({ compactFonts }),
}));

const useStore = create((set) => ({
  size: {
    width: 1920,
    height: 1080,
  },
  timeline: null,
  duration: 1000,
  fps: 30,
  scale: {
    index: 7,
    unit: 300,
    zoom: 1 / 300,
    segments: 5,
  },
  scroll: {
    left: 0,
    top: 0,
  },
  playerRef: null,
  trackItemDetailsMap: {},
  activeIds: [],
  targetIds: [],
  tracks: [],
  trackItemIds: [],
  transitionIds: [],
  transitionsMap: {},
  trackItemsMap: {},
  sceneMoveableRef: null,

  cropState: {
    activeId: null,
    crop: null,
    backupCrop: null,
  },
  setCropState: (cropState) =>
    set((state) => ({
      cropState:
        typeof cropState === "function"
          ? cropState(state.cropState)
          : { ...state.cropState, ...cropState },
    })),

  setTimeline: (timeline) => set({ timeline }),
  setScale: (scale) => set({ scale }),
  setScroll: (scroll) => set({ scroll }),
  setState: (state) => set((prev) => ({ ...prev, ...state })),
  setPlayerRef: (playerRef) => set({ playerRef }),
  setSceneMoveableRef: (sceneMoveableRef) => set({ sceneMoveableRef }),
}));

export default useStore;

// ==========================================
// 5. HOOKS DO PLAYER E DA TIMELINE
// ==========================================
export const useCurrentPlayerFrame = (ref) => {
  const subscribe = useCallback(
    (onStoreChange) => {
      const { current } = ref;
      if (!current) {
        return () => undefined;
      }
      const updater = () => {
        onStoreChange();
      };
      current.addEventListener("frameupdate", updater);
      return () => {
        current.removeEventListener("frameupdate", updater);
      };
    },
    [ref]
  );

  const data = useSyncExternalStore(
    subscribe,
    () => ref.current?.getCurrentFrame() ?? 0,
    () => 0
  );
  return data;
};

export const useTimelineEvents = () => {
  const { playerRef, fps, timeline, setState } = useStore();

  useEffect(() => {
    const playerEvents = subject.pipe(
      filter(({ key }) => key.startsWith(PLAYER_PREFIX))
    );
    const timelineEvents = subject.pipe(
      filter(({ key }) => key.startsWith(TIMELINE_PREFIX))
    );

    const timelineEventsSubscription = timelineEvents.subscribe((obj) => {
      if (obj.key === TIMELINE_SEEK) {
        const { time } = obj.value?.payload;
        playerRef?.current?.seekTo((time / 1000) * fps);
      }
    });

    const playerEventsSubscription = playerEvents.subscribe((obj) => {
      if (obj.key === PLAYER_SEEK) {
        const { time } = obj.value?.payload;
        playerRef?.current?.seekTo((time / 1000) * fps);
      } else if (obj.key === PLAYER_PLAY) {
        playerRef?.current?.play();
      } else if (obj.key === PLAYER_PAUSE) {
        playerRef?.current?.pause();
      } else if (obj.key === PLAYER_TOGGLE_PLAY) {
        if (playerRef?.current?.isPlaying()) {
          playerRef?.current?.pause();
        } else {
          playerRef?.current?.play();
        }
      } else if (obj.key === PLAYER_SEEK_BY) {
        const { frames } = obj.value?.payload;
        playerRef?.current?.seekTo(
          Math.round(playerRef?.current?.getCurrentFrame()) + frames
        );
      }
    });

    return () => {
      playerEventsSubscription.unsubscribe();
      timelineEventsSubscription.unsubscribe();
    };
  }, [playerRef, fps]);

  useEffect(() => {
    const selectionEvents = subject.pipe(
      filter(({ key }) => key.startsWith(LAYER_PREFIX))
    );

    const selectionSubscription = selectionEvents.subscribe((obj) => {
      if (obj.key === LAYER_SELECTION) {
        setState({
          activeIds: obj.value?.payload.activeIds,
        });
      }
    });

    return () => selectionSubscription.unsubscribe();
  }, [timeline]);
};

export const useIsDraggingOverTimeline = () => {
  const [isDraggingOverTimeline, setIsDraggingOverTimeline] = useState(false);

  useEffect(() => {
    const dragEvents = subject.pipe(
      filter(({ key }) => key.startsWith(DRAG_PREFIX))
    );

    const dragEventsSubscription = dragEvents.subscribe((obj) => {
      if (obj.key === DRAG_START) {
        setIsDraggingOverTimeline(true);
      } else if (obj.key === DRAG_END) {
        setIsDraggingOverTimeline(false);
      }
    });

    return () => dragEventsSubscription.unsubscribe();
  }, []);

  return isDraggingOverTimeline;
};

// ==========================================
// 6. HELPERS DE SELEÇÃO E ELEMENTOS DO PALCO
// ==========================================
export const getIdFromClassName = (input) => {
  const regex = /designcombo-scene-item id-([^ ]+)/;
  const match = input.match(regex);
  return match ? match[1] : null;
};

export const getTypeFromClassName = (input) => {
  const regex = /designcombo-scene-item-type-([^ ]+)/;
  const match = input.match(regex);
  return match ? match[1] : null;
};

export const getTargetById = (id) => {
  return document.querySelector(`.designcombo-scene-item.id-${id}`);
};

export const getTargetControls = (targetType) => {
  switch (targetType) {
    case "text":
    case "caption":
      return ["w", "e", "s", "se", "sw"];
    case "svg":
      return ["nw", "n", "ne", "w", "e", "sw", "s", "se"];
    case "image":
    case "group":
    default:
      return ["nw", "ne", "sw", "se"];
  }
};

export const getTargetAbles = (targetType) => {
  switch (targetType) {
    case "text":
    case "caption":
      return {
        rotatable: true,
        resizable: true,
        scalable: false,
        keepRatio: false,
        draggable: true,
        snappable: true,
      };
    case "image":
    case "svg":
      return {
        rotatable: true,
        resizable: false,
        scalable: true,
        keepRatio: true,
        draggable: true,
        snappable: true,
      };
    case "group":
      return {
        rotatable: false,
        resizable: false,
        scalable: true,
        keepRatio: true,
        draggable: true,
        snappable: true,
      };
    default:
      return {
        rotatable: true,
        resizable: false,
        scalable: true,
        keepRatio: true,
        draggable: true,
        snappable: true,
      };
  }
};

export const emptySelection = {
  targets: [],
  layerType: null,
  ables: {
    rotatable: false,
    resizable: false,
    scalable: false,
    keepRatio: false,
    draggable: true,
    snappable: true,
  },
  controls: [],
};

export const getSelectionByIds = (ids) => {
  if (!ids || ids.length === 0) return emptySelection;

  const targets = ids
    .map((id) => (id ? getTargetById(id) : null))
    .filter((target) => target !== null)
    .filter((target) => {
      const targetType = getTypeFromClassName(target.className);
      return targetType !== "audio";
    });

  if (targets.length === 0) return emptySelection;
  if (targets.length === 1) {
    const target = targets[0];
    const targetType = getTypeFromClassName(target.className);
    const ables = getTargetAbles(targetType);
    const controls = getTargetControls(targetType);
    return { targets: [target], layerType: targetType, ables, controls };
  } else {
    return {
      targets,
      layerType: "group",
      ables: getTargetAbles("group"),
      controls: [],
    };
  }
};

// ==========================================
// 7. ESTILIZAÇÃO E MEDIÇÃO DE CENA
// ==========================================
export const calculateCropStyles = (details, crop) => ({
  width: details.width || "100%",
  height: details.height || "auto",
  top: -crop.y || 0,
  left: -crop.x || 0,
  position: "absolute",
  borderRadius: `${Math.min(crop.width, crop.height) * ((details.borderRadius || 0) / 100)}px`,
});

export const calculateMediaStyles = (details, crop) => ({
  pointerEvents: "none",
  boxShadow: [
    `0 0 0 ${details.borderWidth}px ${details.borderColor}`,
    details.boxShadow
      ? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
      : "",
  ]
    .filter(Boolean)
    .join(", "),
  ...calculateCropStyles(details, crop),
});

export const calculateTextStyles = (details) => ({
  position: "relative",
  textDecoration: details.textDecoration || "none",
  WebkitTextStroke: `${details.borderWidth}px ${details.borderColor}`,
  paintOrder: "stroke fill",
  textShadow: details.boxShadow
    ? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
    : "",
  fontFamily: details.fontFamily || "Arial",
  fontWeight: details.fontWeight || "normal",
  lineHeight: details.lineHeight || "normal",
  letterSpacing: details.letterSpacing || "normal",
  wordSpacing: details.wordSpacing || "normal",
  wordWrap: details.wordWrap || "normal",
  wordBreak: details.wordBreak || "normal",
  textTransform: details.textTransform || "none",
  fontSize: details.fontSize || "16px",
  textAlign: details.textAlign || "left",
  color: details.color || "#000000",
});

export const calculateContainerStyles = (details, crop = {}, overrides = {}) => {
  const hasCrop = crop && crop.width > 0 && crop.height > 0;
  return {
    pointerEvents: "auto",
    top: details.top || 0,
    left: details.left || 0,
    width: hasCrop ? crop.width : (details.width || "100%"),
    height: hasCrop ? crop.height : (details.height || "auto"),
    overflow: "hidden",
    transform: details.transform || "none",
    opacity: details.opacity !== undefined ? details.opacity / 100 : 1,
    transformOrigin: details.transformOrigin || "center center",
    filter: `brightness(${details.brightness || 100}%) blur(${details.blur || 0}px)`,
    rotate: details.rotate || "0deg",
    ...overrides,
  };
};

export const calculateTextHeight = (props) => {
  const {
    family,
    fontSize,
    width,
    lineHeight,
    letterSpacing,
    textShadow,
    webkitTextStroke,
    fontWeight,
    id,
  } = props;

  const div = document.createElement("div");
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.style.width = width;
  div.style.fontSize = fontSize;
  div.style.fontFamily = family;
  div.style.lineHeight = lineHeight;
  div.style.height = "fit-content";
  div.style.fontWeight = fontWeight;
  div.style.letterSpacing = letterSpacing;
  div.style.position = "absolute";
  div.style.top = "100";
  div.style.left = "100";
  div.style.webkitTextStroke = webkitTextStroke;
  div.style.textShadow = textShadow;
  div.style.minWidth = "1ch";

  const compositionLayer = document.querySelector(`[data-text-id="${id}"]`);
  if (compositionLayer) {
    div.innerHTML = compositionLayer.innerHTML;
  }

  document.body.appendChild(div);
  const newHeight = div.clientHeight;
  document.body.removeChild(div);

  return newHeight;
};

// ==========================================
// 8. HOOKS DE ZOOM E ATUALIZAÇÃO DE ANCESTRAIS
// ==========================================
export function useZoom(containerRef, viewerRef, size) {
  const [zoom, setZoom] = useState(0.01);
  const currentZoomRef = useRef(0.01);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const PADDING = 96;
    const containerHeight = container.clientHeight - PADDING;
    const containerWidth = container.clientWidth - PADDING;
    const { width, height } = size;

    viewerRef.current?.infiniteViewer.scrollCenter();
    const desiredZoom = Math.min(
      containerWidth / width,
      containerHeight / height
    );
    currentZoomRef.current = desiredZoom;
    setZoom(desiredZoom);
  }, [size, containerRef, viewerRef]);

  const handlePinch = useCallback((e) => {
    const deltaY = e.inputEvent.deltaY;
    const changer = deltaY > 0 ? 0.0085 : -0.0085;
    const currentZoom = currentZoomRef.current;
    const newZoom = currentZoom + changer;
    if (newZoom >= 0.001 && newZoom <= 10) {
      currentZoomRef.current = newZoom;
      setZoom(newZoom);
    }
  }, []);

  return { zoom, handlePinch };
}

export function useUpdateAnsestors({ playing, playerRef }) {
  const { trackItemIds, activeIds } = useStore();

  const updateAnsestorsPointerEvents = () => {
    const elements = document.querySelectorAll(
      '[data-track-item="transition-element"]'
    );

    elements.forEach((element) => {
      let currentElement = element;
      while (currentElement.parentElement?.className !== "__remotion-player") {
        const parentElement = currentElement.parentElement;
        if (parentElement) {
          currentElement = parentElement;
          parentElement.style.pointerEvents = "none";
        }
      }
    });
  };

  useEffect(() => {
    if (!playing) {
      updateAnsestorsPointerEvents();
    }
  }, [playing, trackItemIds, activeIds]);

  useEffect(() => {
    if (playerRef && playerRef.current) {
      playerRef.current.addEventListener(
        "seeked",
        updateAnsestorsPointerEvents
      );
    }
    return () => {
      if (playerRef && playerRef.current) {
        playerRef.current.removeEventListener(
          "seeked",
          updateAnsestorsPointerEvents
        );
      }
    };
  }, [playerRef]);

  useEffect(() => {
    if (activeIds.length !== 1) {
      dispatch(ENTER_EDIT_MODE, {
        payload: {
          id: null,
        },
      });
      return;
    }
    const element = getTargetById(activeIds[0]);
    if (!element) return;
    const handleDoubleClick = (e) => {
      const type = getTypeFromClassName(element.className);
      if (type === "text") {
        dispatch(ENTER_EDIT_MODE, {
          payload: {
            id: activeIds[0],
          },
        });
        e.stopPropagation();
      }
    };
    element.addEventListener("dblclick", handleDoubleClick);
    return () => {
      element.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [activeIds]);
}