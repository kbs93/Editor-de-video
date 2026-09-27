import { useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "lodash";
import {
  PREVIEW_FRAME_WIDTH,
  SECONDARY_FONT,
  SMALL_FONT_SIZE,
  TIMELINE_OFFSET_CANVAS_LEFT,
  TIMELINE_OFFSET_X,
} from "./constants";
import { formatTimelineUnit } from "./timeline-utils";
import { timeMsToUnits, unitsToTimeMs } from "./timeline-math";
import { useCurrentPlayerFrame } from "./player-hooks";
import useStore from "./use-store";
// ======================== RULER ========================
export function Ruler(props) {
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
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: height });

  const draw = (context, scrollPos, width, height) => {
    const zoom = scale.zoom;
    const unit = scale.unit;
    const segments = scale.segments;
    context.clearRect(0, 0, width, height);
    context.save();
    context.strokeStyle = "#71717a";
    context.fillStyle = "#71717a";
    context.lineWidth = 1;
    context.font = `${SMALL_FONT_SIZE}px ${SECONDARY_FONT}`;
    context.textBaseline = "top";

    context.translate(0.5, 0);
    context.beginPath();

    const zoomUnit = unit * zoom * PREVIEW_FRAME_WIDTH;
    const minRange = Math.floor(scrollPos / zoomUnit);
    const maxRange = Math.ceil((scrollPos + width) / zoomUnit);
    const length = maxRange - minRange;

    for (let i = 0; i <= length; ++i) {
      const value = i + minRange;
      if (value < 0) continue;
      const startValue = (value * zoomUnit) / zoom;
      const startPos = (startValue - scrollPos / zoom) * zoom;
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
      const startPos = startValue - scrollPos + offsetX;

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

  const resize = (canvas, context, scrollPos) => {
    if (!canvas || !context) return;
    const offsetParent = canvas.offsetParent;
    const width = offsetParent?.offsetWidth ?? canvas.offsetWidth;
    const height = canvasSize.height;
    canvas.width = width;
    canvas.height = height;
    draw(context, scrollPos, width, height);
    setCanvasSize({ width, height });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      setCanvasContext(context);
      resize(canvas, context, scrollPos);
    }
  }, []);

  const handleResize = useCallback(() => {
    resize(canvasRef.current, canvasContext, scrollPos);
  }, [canvasContext, scrollPos]);

  useEffect(() => {
    const resizeHandler = debounce(handleResize, 200);
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
  }, [handleResize]);

  useEffect(() => {
    if (canvasContext) {
      resize(canvasRef.current, canvasContext, scrollPos);
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
    <div
      className="border-t border-border"
      style={{ position: "relative", width: "100%", height: `${canvasSize.height}px` }}
    >
      <canvas onMouseUp={handleClick} ref={canvasRef} height={canvasSize.height} />
    </div>
  );
}

// ======================== PLAYHEAD ========================
export function Playhead({ scrollLeft }) {
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
      <div
        style={{ borderRadius: "0 0 4px 4px" }}
        className="absolute top-0 h-4 w-2 -translate-x-1/2 transform bg-white text-xs font-semibold text-zinc-800"
      />
      <div className="relative h-full">
        <div className="absolute top-0 h-full w-3 -translate-x-1/2 transform" />
        <div className="absolute top-0 h-full w-0.5 -translate-x-1/2 transform bg-white/50" />
      </div>
    </div>
  );
}

export default { Ruler, Playhead };