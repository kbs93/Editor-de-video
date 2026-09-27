// ======================== SCENE ID & CLASSES ========================
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

// ======================== TARGETS & CONTROLS ========================
export const getTargetControls = (targetType) => {
  switch (targetType) {
    case "text":
    case "caption":
      return ["e", "se"];
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

export const getTargetById = (id) => {
  return document.querySelector(`.designcombo-scene-item.id-${id}`);
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

// ======================== STYLES ========================
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

export const calculateContainerStyles = (details, crop = {}, overrides = {}) => ({
  pointerEvents: "auto",
  top: details.top || 0,
  left: details.left || 0,
  width: crop.width || details.width || "100%",
  height: crop.height || details.height || "auto",
  transform: details.transform || "none",
  opacity: details.opacity !== undefined ? details.opacity / 100 : 1,
  transformOrigin: details.transformOrigin || "center center",
  filter: `brightness(${details.brightness}%) blur(${details.blur}px)`,
  rotate: details.rotate || "0deg",
  ...overrides,
});


// ======================== TEXT DIMENSION UTILS ========================
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