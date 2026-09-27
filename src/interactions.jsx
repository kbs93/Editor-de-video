import { useEffect, useRef, useState } from "react";
import { Moveable, Selection } from "@interactify/toolkit";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import { Check, RotateCcw } from "lucide-react";
import {
  getIdFromClassName,
  emptySelection,
  getSelectionByIds,
  getTargetById,
} from "./scene-utils";
import useStore from "./use-store";
import { getCurrentTime } from "./timeline-math";

let holdGroupPosition = null;
let dragStartEnd = false;

// Overlay de corte dinâmico, livre e com área de toque aumentada
// Overlay de corte dinâmico ajustável a qualquer tamanho na tela toda






function CropOverlay({ item, zoom, currentCrop, setCropValues }) {
  const safeZoom = zoom && zoom > 0 ? zoom : 1;
  const { size } = useStore.getState();

  // Dimensões absolutas reais do vídeo original
  const fullMediaWidth = item.details?.width || size?.width || 1920;
  const fullMediaHeight = item.details?.height || size?.height || 1080;

  // A posição top e left originais do objeto
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

      // Puxar borda Oeste (Esquerda): permite abrir para a esquerda até 0
      if (handle.includes("w")) {
        const requestedX = startCrop.x + dx;
        const clampedX = Math.max(0, Math.min(requestedX, startCrop.x + startCrop.width - 30));
        nextWidth = startCrop.width + (startCrop.x - clampedX);
        nextX = clampedX;
      }

      // Puxar borda Leste (Direita): permite abrir para a direita até à borda total do vídeo
      if (handle.includes("e")) {
        const requestedWidth = startCrop.width + dx;
        nextWidth = Math.max(30, Math.min(requestedWidth, fullMediaWidth - startCrop.x));
      }

      // Puxar borda Norte (Cima): permite abrir para cima até 0
      if (handle.includes("n")) {
        const requestedY = startCrop.y + dy;
        const clampedY = Math.max(0, Math.min(requestedY, startCrop.y + startCrop.height - 30));
        nextHeight = startCrop.height + (startCrop.y - clampedY);
        nextY = clampedY;
      }

      // Puxar borda Sul (Baixo): permite abrir para baixo até à altura total do vídeo
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
      {/* Moldura tracejada ajustável */}
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
        {/* Cantos */}
        <div
          onMouseDown={(e) => onHandleStart("nw", e)}
          className="absolute -left-3 -top-3 w-10 h-10 flex items-start justify-start cursor-nwse-resize p-1 z-30 select-none"
        >
          <div className="w-6 h-6 border-l-4 border-t-4 border-white shadow-lg pointer-events-none" />
        </div>
        <div
          onMouseDown={(e) => onHandleStart("ne", e)}
          className="absolute -right-3 -top-3 w-10 h-10 flex items-start justify-end cursor-nesw-resize p-1 z-30 select-none"
        >
          <div className="w-6 h-6 border-r-4 border-t-4 border-white shadow-lg pointer-events-none" />
        </div>
        <div
          onMouseDown={(e) => onHandleStart("sw", e)}
          className="absolute -left-3 -bottom-3 w-10 h-10 flex items-end justify-start cursor-nesw-resize p-1 z-30 select-none"
        >
          <div className="w-6 h-6 border-l-4 border-b-4 border-white shadow-lg pointer-events-none" />
        </div>
        <div
          onMouseDown={(e) => onHandleStart("se", e)}
          className="absolute -right-3 -bottom-3 w-10 h-10 flex items-end justify-end cursor-nwse-resize p-1 z-30 select-none"
        >
          <div className="w-6 h-6 border-r-4 border-b-4 border-white shadow-lg pointer-events-none" />
        </div>

        {/* Alças das Bordas */}
        <div
          onMouseDown={(e) => onHandleStart("n", e)}
          className="absolute top-0 left-0 w-full h-10 -translate-y-1/2 flex items-center justify-center cursor-ns-resize z-20 select-none"
        >
          <div className="w-16 h-3 bg-white rounded shadow-lg pointer-events-none" />
        </div>
        <div
          onMouseDown={(e) => onHandleStart("s", e)}
          className="absolute bottom-0 left-0 w-full h-10 translate-y-1/2 flex items-center justify-center cursor-ns-resize z-20 select-none"
        >
          <div className="w-16 h-3 bg-white rounded shadow-lg pointer-events-none" />
        </div>
        <div
          onMouseDown={(e) => onHandleStart("w", e)}
          className="absolute left-0 top-0 h-full w-10 -translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 select-none"
        >
          <div className="w-3 h-16 bg-white rounded shadow-lg pointer-events-none" />
        </div>
        <div
          onMouseDown={(e) => onHandleStart("e", e)}
          className="absolute right-0 top-0 h-full w-10 translate-x-1/2 flex items-center justify-center cursor-ew-resize z-20 select-none"
        >
          <div className="w-3 h-16 bg-white rounded shadow-lg pointer-events-none" />
        </div>
      </div>
    </div>
  );
}












































export function SceneInteractions({ stateManager, viewerRef, zoom }) {
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

    // Se já existe um recorte válido menor que o vídeo, abre nele; caso contrário, cobre 100% da área (linha vermelha)
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

  // Se já havia um crop anterior, calculamos a diferença; se não, usamos o x/y direto
  const prevCropX = selectedItem.details?.crop?.x || 0;
  const prevCropY = selectedItem.details?.crop?.y || 0;

  const deltaX = cropValues.x - prevCropX;
  const deltaY = cropValues.y - prevCropY;

  // Ajusta o container (left e top) para o início do novo retângulo cortado
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
          {
            activeIds: ids,
          },
          {
            updateHistory: false,
            kind: "layer:selection",
          }
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
            {
              activeIds: ids,
            },
            {
              updateHistory: false,
              kind: "layer:selection",
            }
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
    {/* Botões de Ação com compensação de zoom real para ficarem grandes e visíveis */}
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

      {/* Renderização da moldura tracejada com alças ajustáveis */}
      {isCropping && selectedItem && cropValues && (
        <CropOverlay
          item={selectedItem}
          zoom={zoom}
          currentCrop={cropValues}
          setCropValues={setCropValues}
        />
      )}

      {/* Moveable padrão */}
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
              holdGroupPosition[id] = {
                left: left,
                top: top,
              };
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
              dispatch(EDIT_OBJECT, {
                payload: payload,
              });
              holdGroupPosition = null;
            }
          }}
        />
      )}
    </>
  );
}