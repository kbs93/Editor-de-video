import { FabricObject, util, controlsUtils, Control, resize } from "@designcombo/timeline";

// ======================== DRAW FUNCTIONS ========================
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

// ======================== CONTROLS BUILDERS ========================
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