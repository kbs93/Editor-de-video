import { useCallback, useEffect, useRef, useState } from "react";
import { Player as RemotionPlayer } from "@remotion/player";
import { Moveable, Selection, Viewer } from "@interactify/toolkit";
import { Check, PlusIcon, RotateCcw } from "lucide-react";
import { dispatch } from "@designcombo/events";
import { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO, EDIT_OBJECT } from "@designcombo/state";
import { generateId } from "@designcombo/timeline";

import Composition from "./composition";
import useStore, {
  emptySelection,
  getIdFromClassName,
  getSelectionByIds,
  getTargetById,
  useZoom,
} from "./editor-store";
import { getCurrentTime } from "./timeline-toolkit";

let holdGroupPosition = null;
let dragStartEnd = false;

// ==========================================
// 1. OVERLAY DE CORTE (CropOverlay)
// ==========================================
function CropOverlay({ item, zoom, currentCrop, setCropValues }) {
  const safeZoom = zoom && zoom > 0 ? zoom : 1;
  const { size } = useStore.getState();

  const fullMediaWidth = item.details?.width || size?.width || 1920;
  const fullMediaHeight = item.details?.height || size?.height || 1080;
  const itemLeft = parseFloat(item.details?.left) || 0;
  const itemTop = parseFloat(item.details?.top) || 0;

  const onHandleStart = (handle, e) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...currentCrop };

    const onMouseMove = (moveEvent) => {
      moveEvent.stopPropagation();
      moveEvent.preventDefault();

      const dx = (moveEvent.clientX - startX) / safeZoom;
      const dy = (moveEvent.clientY - startY) / safeZoom;

      let nextX = startCrop.x;
      let nextY = startCrop.y;
      let nextWidth = startCrop.width;
      let nextHeight = startCrop.height;

      if (handle.includes("w")) {
        const requestedX = startCrop.x + dx;
        const clampedX = Math.max(0, Math.min(requestedX, startCrop.x + startCrop.width - 30));
        nextWidth = startCrop.width + (startCrop.x - clampedX);
        nextX = clampedX;
      }

      if (handle.includes("e")) {
        const requestedWidth = startCrop.width + dx;
        nextWidth = Math.max(30, Math.min(requestedWidth, fullMediaWidth - startCrop.x));
      }

      if (handle.includes("n")) {
        const requestedY = startCrop.y + dy;
        const clampedY = Math.max(0, Math.min(requestedY, startCrop.y + startCrop.height - 30));
        nextHeight = startCrop.height + (startCrop.y - clampedY);
        nextY = clampedY;
      }

      if (handle.includes("s")) {
        const requestedHeight = startCrop.height + dy;
        nextHeight = Math.max(30, Math.min(requestedHeight, fullMediaHeight - startCrop.y));
      }

      setCropValues({
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };

    const onMouseUp = (upEvent) => {
      upEvent.stopPropagation();
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };

    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: itemLeft,
        top: itemTop,
        width: fullMediaWidth,
        height: fullMediaHeight,
        pointerEvents: "none",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: currentCrop.x,
          top: currentCrop.y,
          width: currentCrop.width,
          height: currentCrop.height,
          border: "2px dashed #38bdf8",
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
          pointerEvents: "auto",
        }}
      >
        <div onMouseDown={(e) => onHandleStart("nw", e)} className="absolute -left-3 -top-3 w-10 h-10 flex items-start justify-start cursor-nwse-resize p-1 z-30 select-none">
          <div className="w-6 h-6 border-l-4 border-t-4 border-white shadow-lg pointer-events-none" />
        </div>
        <div onMouseDown={(e) => onHandleStart("ne", e)} className="absolute -right-3 -top-3 w-10 h-10 flex items-start justify-end cursor-nesw-resize p-1 z-30 select-none">
          <div className="w-6 h-6 border-r-4 border-t-4 border-white shadow-lg pointer-events-none" />
        </div>
        <div onMouseDown={(e) => onHandleStart("sw", e)} className="absolute -left-3 -bottom-3 w-10 h-10 flex items-end justify-start cursor-nesw-resize p-1 z-30 select-none">
          <div className="w-6 h-6 border-l-4 border-b-4 border-white shadow-lg pointer-events-none" />
        </div>
        <div onMouseDown={(e) => onHandleStart("se", e)} className="absolute -right-3 -bottom-3 w-10 h-10 flex items-end justify-end cursor-nwse-resize p-1 z-30 select-none">
          <div className="w-6 h-6 border-r-4 border-b-4 border-white shadow-lg pointer-events-none" />
        </div>

        <div onMouseDown={(e) => onHandleStart("n", e)} className="absolute top-0 left-0 w-full h-10 -translate-y-1/2 flex items-center justify-center cursor-ns-resize z-20 select-none">
          <div className="w-16 h-3 bg-white rounded shadow-lg pointer-events-none" />
        </div>
        <div onMouseDown={(e) => onHandleStart("s", e)} className="absolute bottom-0 left-0 w-full h-10 translate-y-1/2 flex items-center justify-center cursor-ns-resize z-20 select-none">
          <div className="w-16 h-3 bg-white rounded shadow-lg pointer-events-none" />
        </div>
        <div onMouseDown={(e) => onHandleStart("w", e)} className="absolute left-0 top-0 h-full w-10 -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 select-none">
          <div className="w-3 h-16 bg-white rounded shadow-lg pointer-events-none" />
        </div>
        <div onMouseDown={(e) => onHandleStart("e", e)} className="absolute right-0 top-0 h-full w-10 translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 select-none">
          <div className="w-3 h-16 bg-white rounded shadow-lg pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. INTERAÇÕES DE CENA (SceneInteractions)
// ==========================================
function SceneInteractions({ stateManager, viewerRef, zoom }) {
  const [targets, setTargets] = useState([]);
  const [selection, setSelection] = useState();
  const {
    activeIds,
    setState,
    trackItemDetailsMap,
    trackItemsMap,
    playerRef,
    setSceneMoveableRef,
  } = useStore();

  const moveableRef = useRef(null);
  const [selectionInfo, setSelectionInfo] = useState(emptySelection);

  const [isCropping, setIsCropping] = useState(false);
  const [cropValues, setCropValues] = useState(null);
  const [backupCrop, setBackupCrop] = useState(null);

  const selectedItem =
    activeIds.length === 1 ? trackItemsMap[activeIds[0]] : null;
  const canCrop =
    selectedItem &&
    (selectedItem.type === "video" || selectedItem.type === "image");

  const handleStartCrop = () => {
    if (!selectedItem) return;
    const { size } = useStore.getState();

    const fullW = selectedItem.details?.width || size?.width || 1920;
    const fullH = selectedItem.details?.height || size?.height || 1080;

    const hasValidCrop =
      selectedItem.details?.crop &&
      selectedItem.details.crop.width > 0 &&
      selectedItem.details.crop.height > 0;

    const initialCrop = hasValidCrop
      ? { ...selectedItem.details.crop }
      : {
          x: 0,
          y: 0,
          width: fullW,
          height: fullH,
        };

    setBackupCrop({ ...initialCrop });
    setCropValues({ ...initialCrop });
    setIsCropping(true);
  };

  const handleApplyCrop = () => {
    if (!selectedItem || !cropValues) return;

    const currentLeft = parseFloat(selectedItem.details?.left) || 0;
    const currentTop = parseFloat(selectedItem.details?.top) || 0;

    const prevCropX = selectedItem.details?.crop?.x || 0;
    const prevCropY = selectedItem.details?.crop?.y || 0;

    const deltaX = cropValues.x - prevCropX;
    const deltaY = cropValues.y - prevCropY;

    const newLeft = currentLeft + deltaX;
    const newTop = currentTop + deltaY;

    dispatch(EDIT_OBJECT, {
      payload: {
        [selectedItem.id]: {
          details: {
            left: `${newLeft}px`,
            top: `${newTop}px`,
            crop: {
              x: cropValues.x,
              y: cropValues.y,
              width: cropValues.width,
              height: cropValues.height,
            },
          },
        },
      },
    });

    setIsCropping(false);
    setCropValues(null);
    setBackupCrop(null);

    setTimeout(() => {
      moveableRef.current?.moveable?.updateRect();
    }, 50);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCropValues(null);
    setBackupCrop(null);
  };

  useEffect(() => {
    const handleToggleCrop = () => {
      if (canCrop) {
        if (!isCropping) {
          handleStartCrop();
        } else {
          handleApplyCrop();
        }
      }
    };

    window.addEventListener("TOGGLE_CROP_MODE", handleToggleCrop);
    return () => {
      window.removeEventListener("TOGGLE_CROP_MODE", handleToggleCrop);
    };
  }, [canCrop, isCropping, selectedItem, cropValues]);

  useEffect(() => {
    if (isCropping) {
      setTargets([]);
      return;
    }

    const updateTargets = (time) => {
      const currentTime = time || getCurrentTime();
      const { trackItemsMap } = useStore.getState();
      const targetIds = activeIds.filter((id) => {
        return (
          trackItemsMap[id]?.display.from <= currentTime &&
          trackItemsMap[id]?.display.to >= currentTime
        );
      });
      const currentTargets = targetIds.map((id) => getTargetById(id));
      selection?.setSelectedTargets(currentTargets);
      const selInfo = getSelectionByIds(targetIds);

      setSelectionInfo(selInfo);
      setTargets(selInfo.targets);
    };

    const timer = setTimeout(() => {
      updateTargets();
    });

    const onSeeked = (v) => {
      setTimeout(() => {
        const { fps } = useStore.getState();
        const seekedTime = (v.detail.frame / fps) * 1000;
        updateTargets(seekedTime);
      });
    };
    playerRef?.current?.addEventListener("seeked", onSeeked);

    return () => {
      playerRef?.current?.removeEventListener("seeked", onSeeked);
      clearTimeout(timer);
    };
  }, [activeIds, playerRef, trackItemsMap, isCropping]);

  useEffect(() => {
    if (isCropping) return;

    const selectionInstance = new Selection({
      container: viewerRef.current?.infiniteViewer.getContainer(),
      boundContainer: true,
      hitRate: 0,
      selectableTargets: [".designcombo-scene-item"],
      selectFromInside: false,
      selectByClick: true,
      toggleContinueSelect: "shift",
    })
      .on("select", (e) => {
        const ids = e.selected.map((el) => getIdFromClassName(el.className));
        setTargets(e.selected);

        stateManager.updateState(
          { activeIds: ids },
          { updateHistory: false, kind: "layer:selection" }
        );
      })
      .on("dragStart", (e) => {
        const target = e.inputEvent.target;
        dragStartEnd = false;

        if (targets.includes(target)) {
          e.stop();
        }
        if (
          target &&
          moveableRef?.current?.moveable?.isMoveableElement(target)
        ) {
          e.stop();
        }
      })
      .on("dragEnd", () => {
        dragStartEnd = true;
      })
      .on("selectEnd", (e) => {
        const moveable = moveableRef.current;
        if (e.isDragStart) {
          e.inputEvent.preventDefault();
          setTimeout(() => {
            if (!dragStartEnd) {
              moveable?.moveable.dragStart(e.inputEvent);
            }
          });
        } else {
          const selectedTargets = e.selected;
          const ids = selectedTargets.map((el) => getIdFromClassName(el.className));

          stateManager.updateState(
            { activeIds: ids },
            { updateHistory: false, kind: "layer:selection" }
          );
          setTargets(selectedTargets);
        }
      });

    setSelection(selectionInstance);
    return () => {
      selectionInstance.destroy();
    };
  }, [isCropping]);

  useEffect(() => {
    const activeSelectionSubscription = stateManager.subscribeToActiveIds(
      (newState) => {
        setState(newState);
      }
    );

    return () => {
      activeSelectionSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (moveableRef.current?.moveable) {
      moveableRef.current.moveable.updateRect();
    }
  }, [trackItemsMap]);

  useEffect(() => {
    setSceneMoveableRef(moveableRef);
  }, [moveableRef]);

  return (
    <>
      {isCropping && selectedItem && cropValues && (
        <div
          style={{
            position: "absolute",
            left: (parseFloat(selectedItem.details?.left) || 0) + cropValues.x + cropValues.width / 2,
            top: (parseFloat(selectedItem.details?.top) || 0) + cropValues.y - (55 * (1 / (zoom || 1))),
            transform: `translateX(-50%) scale(${1 / (zoom || 1)})`,
            transformOrigin: "bottom center",
            zIndex: 10001,
            pointerEvents: "auto",
          }}
          className="flex items-center gap-2 bg-zinc-950/95 border-2 border-zinc-600 px-3 py-2 rounded-2xl shadow-2xl"
        >
          <button
            type="button"
            onClick={handleApplyCrop}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 transition-all cursor-pointer shadow-lg active:scale-90"
            title="Confirmar Recorte"
          >
            <Check className="w-6 h-6 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={handleCancelCrop}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-all cursor-pointer shadow-lg active:scale-90"
            title="Cancelar Recorte"
          >
            <RotateCcw className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      )}

      {isCropping && selectedItem && cropValues && (
        <CropOverlay
          item={selectedItem}
          zoom={zoom}
          currentCrop={cropValues}
          setCropValues={setCropValues}
        />
      )}

      {!isCropping && (
        <Moveable
          ref={moveableRef}
          rotationPosition={"bottom"}
          renderDirections={selectionInfo.controls}
          {...selectionInfo.ables}
          origin={false}
          target={targets}
          zoom={1 / zoom}
          className="designcombo-scene-moveable"
          onDrag={({ target, top, left }) => {
            target.style.top = top + "px";
            target.style.left = left + "px";
          }}
          onDragEnd={({ target, isDrag }) => {
            if (!isDrag) return;
            const targetId = getIdFromClassName(target.className);

            dispatch(EDIT_OBJECT, {
              payload: {
                [targetId]: {
                  details: {
                    left: target.style.left,
                    top: target.style.top,
                  },
                },
              },
            });
          }}
          onScale={({ target, transform, direction }) => {
            const [xControl, yControl] = direction;
            const moveX = xControl === -1;
            const moveY = yControl === -1;

            const scaleRegex = /scale\(([^)]+)\)/;
            const match = target.style.transform.match(scaleRegex);

            const [scaleX, scaleY] = match[1]
              .split(",")
              .map((value) => parseFloat(value.trim()));

            const match2 = transform.match(scaleRegex);
            const [newScaleX, newScaleY] = match2[1]
              .split(",")
              .map((value) => parseFloat(value.trim()));

            const currentWidth = target.clientWidth * scaleX;
            const currentHeight = target.clientHeight * scaleY;

            const newWidth = target.clientWidth * newScaleX;
            const newHeight = target.clientHeight * newScaleY;

            target.style.transform = transform;

            const diffX = currentWidth - newWidth;
            let newLeft = parseFloat(target.style.left) - diffX / 2;

            const diffY = currentHeight - newHeight;
            let newTop = parseFloat(target.style.top) - diffY / 2;

            if (moveX) newLeft += diffX;
            if (moveY) newTop += diffY;
            target.style.left = newLeft + "px";
            target.style.top = newTop + "px";
          }}
          onScaleEnd={({ target }) => {
            if (!target.style.transform) return;
            const targetId = getIdFromClassName(target.className);

            dispatch(EDIT_OBJECT, {
              payload: {
                [targetId]: {
                  details: {
                    transform: target.style.transform,
                    left: parseFloat(target.style.left),
                    top: parseFloat(target.style.top),
                  },
                },
              },
            });
          }}
          onRotate={({ target, transform }) => {
            target.style.transform = transform;
          }}
          onRotateEnd={({ target }) => {
            if (!target.style.transform) return;
            const targetId = getIdFromClassName(target.className);
            dispatch(EDIT_OBJECT, {
              payload: {
                [targetId]: {
                  details: {
                    transform: target.style.transform,
                  },
                },
              },
            });
          }}
          onDragGroup={({ events }) => {
            holdGroupPosition = {};
            for (let i = 0; i < events.length; i++) {
              const event = events[i];
              const id = getIdFromClassName(event.target.className);
              const trackItem = trackItemDetailsMap[id];
              const left =
                parseFloat(trackItem?.details.left) + event.beforeTranslate[0];
              const top =
                parseFloat(trackItem?.details.top) + event.beforeTranslate[1];
              event.target.style.left = `${left}px`;
              event.target.style.top = `${top}px`;
              holdGroupPosition[id] = { left, top };
            }
          }}
          onResize={({
            target,
            width: nextWidth,
            height: nextHeight,
            direction,
          }) => {
            if (direction[1] === 1) {
              const currentWidth = target.clientWidth;
              const currentHeight = target.clientHeight;
              const scale = nextHeight / currentHeight;

              target.style.width = `${currentWidth * scale}px`;
              target.style.height = `${currentHeight * scale}px`;

              const animationDiv = target.firstElementChild?.firstElementChild;
              if (animationDiv) {
                animationDiv.style.width = `${currentWidth * scale}px`;
                animationDiv.style.height = `${currentHeight * scale}px`;

                const textDiv = animationDiv.firstElementChild;
                if (textDiv) {
                  const fontSize = parseFloat(getComputedStyle(textDiv).fontSize);
                  textDiv.style.fontSize = `${fontSize * scale}px`;
                  textDiv.style.width = `${currentWidth * scale}px`;
                  textDiv.style.height = `${currentHeight * scale}px`;
                }
              }
            } else {
              target.style.width = nextWidth + "px";
              target.style.height = nextHeight + "px";

              const animationDiv = target.firstElementChild?.firstElementChild;
              if (animationDiv) {
                animationDiv.style.width = `${nextWidth}px`;
                animationDiv.style.height = `${nextHeight}px`;

                const textDiv = animationDiv.firstElementChild;
                if (textDiv) {
                  textDiv.style.width = `${nextWidth}px`;
                  textDiv.style.height = `${nextHeight}px`;
                }
              }
            }
          }}
          onResizeEnd={({ target }) => {
            const targetId = getIdFromClassName(target.className);
            const textDiv =
              target.firstElementChild?.firstElementChild?.firstElementChild;
            dispatch(EDIT_OBJECT, {
              payload: {
                [targetId]: {
                  details: {
                    width: parseFloat(target.style.width),
                    height: parseFloat(target.style.height),
                    fontSize: parseFloat(textDiv?.style.fontSize || 16),
                  },
                },
              },
            });
          }}
          onDragGroupEnd={() => {
            if (holdGroupPosition) {
              const payload = {};
              Object.keys(holdGroupPosition).forEach((id) => {
                const left = holdGroupPosition[id].left;
                const top = holdGroupPosition[id].top;
                payload[id] = {
                  details: {
                    top: `${top}px`,
                    left: `${left}px`,
                  },
                };
              });
              dispatch(EDIT_OBJECT, { payload });
              holdGroupPosition = null;
            }
          }}
        />
      )}
    </>
  );
}

// ==========================================
// 3. ÁREA DE ARRASTE E SOLTURA (DroppableArea)
// ==========================================
const AcceptedDropTypes = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
};

function DroppableArea({
  children,
  className,
  style,
  onDragStateChange,
  id,
}) {
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDrop = useCallback((draggedData) => {
    const payload = { ...draggedData, id: generateId() };
    switch (draggedData.type) {
      case AcceptedDropTypes.IMAGE:
        dispatch(ADD_IMAGE, { payload });
        break;
      case AcceptedDropTypes.VIDEO:
        dispatch(ADD_VIDEO, { payload });
        break;
      case AcceptedDropTypes.AUDIO:
        dispatch(ADD_AUDIO, { payload });
        break;
      default:
        break;
    }
  }, []);

  const onDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      try {
        const draggedDataString = e.dataTransfer?.types[0];
        if (!draggedDataString) return;
        const draggedData = JSON.parse(draggedDataString);

        if (!Object.values(AcceptedDropTypes).includes(draggedData.type)) return;
        setIsDraggingOver(true);
        setIsPointerInside(true);
        onDragStateChange?.(true);
      } catch (error) {
        console.error("Error parsing dragged data:", error);
      }
    },
    [onDragStateChange]
  );

  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      if (isPointerInside) {
        setIsDraggingOver(true);
        onDragStateChange?.(true);
      }
    },
    [isPointerInside, onDragStateChange]
  );

  const onDrop = useCallback(
    (e) => {
      if (!isDraggingOver) return;
      e.preventDefault();
      setIsDraggingOver(false);
      onDragStateChange?.(false);

      try {
        const draggedDataString = e.dataTransfer?.types[0];
        const draggedData = JSON.parse(
          e.dataTransfer.getData(draggedDataString)
        );
        handleDrop(draggedData);
      } catch (error) {
        console.error("Error parsing dropped data:", error);
      }
    },
    [isDraggingOver, onDragStateChange, handleDrop]
  );

  const onDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setIsDraggingOver(false);
        setIsPointerInside(false);
        onDragStateChange?.(false);
      }
    },
    [onDragStateChange]
  );

  return (
    <div
      id={id}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={className}
      style={style}
      role="region"
      aria-label="Droppable area for images, videos, and audio"
    >
      {children}
    </div>
  );
}

// ==========================================
// 4. COMPONENTE DE ESTADO VAZIO (SceneEmpty)
// ==========================================
function SceneEmpty() {
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [desiredSize, setDesiredSize] = useState({ width: 0, height: 0 });
  const { size } = useStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const PADDING = 96;
    const containerHeight = container.clientHeight - PADDING;
    const containerWidth = container.clientWidth - PADDING;
    const { width, height } = size;

    const desiredZoom = Math.min(
      containerWidth / width,
      containerHeight / height
    );
    setDesiredSize({
      width: width * desiredZoom,
      height: height * desiredZoom,
    });
    setIsLoading(false);
  }, [size]);

  return (
    <div ref={containerRef} className="absolute z-50 flex h-full w-full flex-1">
      {!isLoading ? (
        <div className="h-full w-full flex-1 bg-background relative">
          <DroppableArea
            onDragStateChange={setIsDraggingOver}
            className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 transform items-center justify-center border border-dashed text-center transition-colors duration-200 ease-in-out ${
              isDraggingOver ? "border-white bg-white/10" : "border-white/15"
            }`}
            style={{
              width: desiredSize.width,
              height: desiredSize.height,
            }}
          >
            <div className="flex flex-col items-center justify-center gap-4 pb-12">
              <div className="hover:bg-primary-dark cursor-pointer rounded-md border bg-primary p-2 text-secondary transition-colors duration-200">
                <PlusIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-px">
                <p className="text-sm text-muted-foreground">Click to upload</p>
                <p className="text-xs text-muted-foreground/70">
                  Or drag and drop files here
                </p>
              </div>
            </div>
          </DroppableArea>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-background-subtle text-sm text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. PRANCHETA / MESA DE TRABALHO (Board)
// ==========================================
function SceneBoard({ size, children }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  return (
    <DroppableArea
      id="artboard"
      onDragStateChange={setIsDraggingOver}
      style={{
        width: size.width,
        height: size.height,
      }}
      className="pointer-events-auto"
    >
      <div
        style={{
          width: size.width,
          height: size.height,
        }}
        className={`pointer-events-none absolute z-10 border border-white/15 transition-colors duration-200 ease-in-out ${
          isDraggingOver
            ? "border-4 border-dashed border-white bg-white/[0.075]"
            : "bg-transparent"
        } shadow-[0_0_0_5000px_#121213]`}
      />
      {children}
    </DroppableArea>
  );
}

// ==========================================
// 6. REPRODUTOR REMOTION EMBUTIDO (Player)
// ==========================================
function Player() {
  const playerRef = useRef(null);
  const { setPlayerRef, duration, fps, size } = useStore();

  useEffect(() => {
    setPlayerRef(playerRef);
  }, [setPlayerRef]);

  return (
    <RemotionPlayer
      ref={playerRef}
      component={Composition}
      durationInFrames={Math.round((duration / 1000) * fps) || 1}
      compositionWidth={size.width}
      compositionHeight={size.height}
      className="h-full w-full"
      fps={30}
      overflowVisible
    />
  );
}

// ==========================================
// 7. CENA PRINCIPAL COM VIEWER (Scene)
// ==========================================
export default function Scene({ stateManager }) {
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const { size, trackItemIds } = useStore();
  const { zoom, handlePinch } = useZoom(containerRef, viewerRef, size);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        flex: 1,
      }}
      ref={containerRef}
    >
      {trackItemIds.length === 0 && <SceneEmpty />}
      <Viewer
        ref={viewerRef}
        className="player-container bg-sidebar"
        displayHorizontalScroll={false}
        displayVerticalScroll={false}
        zoom={zoom}
        usePinch={true}
        pinchThreshold={50}
        onPinch={handlePinch}
      >
        <SceneBoard size={size}>
          <Player />
          <SceneInteractions
            stateManager={stateManager}
            viewerRef={viewerRef}
            containerRef={containerRef}
            zoom={zoom}
            size={size}
          />
        </SceneBoard>
      </Viewer>
    </div>
  );
}