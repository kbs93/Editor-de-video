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

// Componente para a moldura de corte ajustável com linha tracejada e alças brancas
function CropOverlay({ item, zoom, currentCrop, setCropValues }) {
  const handlePointerDown = (handle, e) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startCrop = { ...currentCrop };

    const onPointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;

      let nextX = startCrop.x;
      let nextY = startCrop.y;
      let nextWidth = startCrop.width;
      let nextHeight = startCrop.height;

      if (handle.includes("w")) {
        nextX = Math.max(0, Math.min(startCrop.x + dx, startCrop.x + startCrop.width - 50));
        nextWidth = startCrop.width - (nextX - startCrop.x);
      }
      if (handle.includes("e")) {
        nextWidth = Math.max(50, Math.min(startCrop.width + dx, item.details.width - startCrop.x));
      }
      if (handle.includes("n")) {
        nextY = Math.max(0, Math.min(startCrop.y + dy, startCrop.y + startCrop.height - 50));
        nextHeight = startCrop.height - (nextY - startCrop.y);
      }
      if (handle.includes("s")) {
        nextHeight = Math.max(50, Math.min(startCrop.height + dy, item.details.height - startCrop.y));
      }

      setCropValues({
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: item.details.left || 0,
        top: item.details.top || 0,
        width: item.details.width,
        height: item.details.height,
        pointerEvents: "none",
        zIndex: 9998,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: currentCrop.x,
          top: currentCrop.y,
          width: currentCrop.width,
          height: currentCrop.height,
          border: "2px dashed #a855f7",
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
          pointerEvents: "auto",
        }}
      >
        {/* Cantos brancos interativos */}
        <div
          onPointerDown={(e) => handlePointerDown("nw", e)}
          className="absolute -left-1.5 -top-1.5 w-4 h-4 border-l-4 border-t-4 border-white cursor-nwse-resize"
        />
        <div
          onPointerDown={(e) => handlePointerDown("ne", e)}
          className="absolute -right-1.5 -top-1.5 w-4 h-4 border-r-4 border-t-4 border-white cursor-nesw-resize"
        />
        <div
          onPointerDown={(e) => handlePointerDown("sw", e)}
          className="absolute -left-1.5 -bottom-1.5 w-4 h-4 border-l-4 border-b-4 border-white cursor-nesw-resize"
        />
        <div
          onPointerDown={(e) => handlePointerDown("se", e)}
          className="absolute -right-1.5 -bottom-1.5 w-4 h-4 border-r-4 border-b-4 border-white cursor-nwse-resize"
        />

        {/* Alças centrais */}
        <div
          onPointerDown={(e) => handlePointerDown("n", e)}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-1.5 bg-white rounded-sm cursor-ns-resize"
        />
        <div
          onPointerDown={(e) => handlePointerDown("s", e)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-1.5 bg-white rounded-sm cursor-ns-resize"
        />
        <div
          onPointerDown={(e) => handlePointerDown("w", e)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-4 bg-white rounded-sm cursor-ew-resize"
        />
        <div
          onPointerDown={(e) => handlePointerDown("e", e)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-4 bg-white rounded-sm cursor-ew-resize"
        />
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

  // Estados locais do modo de recorte
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
    const initialCrop = selectedItem.details.crop || {
      x: 0,
      y: 0,
      width: selectedItem.details.width,
      height: selectedItem.details.height,
    };
    setBackupCrop({ ...initialCrop });
    setCropValues({ ...initialCrop });
    setIsCropping(true);
  };

  const handleApplyCrop = () => {
    if (!selectedItem || !cropValues) return;
    dispatch(EDIT_OBJECT, {
      payload: {
        [selectedItem.id]: {
          details: {
            crop: cropValues,
          },
        },
      },
    });
    setIsCropping(false);
    setCropValues(null);
    setBackupCrop(null);
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCropValues(null);
    setBackupCrop(null);
  };

  // Escuta o clique do botão "Recortar" localizado na barra do topo
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

  // Atualização dos alvos selecionados no Moveable
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
      const targets = targetIds.map((id) => getTargetById(id));
      selection?.setSelectedTargets(targets);
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

  // Configuração do gerenciador de seleção do @interactify/toolkit
  useEffect(() => {
    const selection = new Selection({
      container: viewerRef.current?.infiniteViewer.getContainer(),
      boundContainer: true,
      hitRate: 0,
      selectableTargets: [".designcombo-scene-item"],
      selectFromInside: false,
      selectByClick: true,
      toggleContinueSelect: "shift",
    })
      .on("select", (e) => {
        if (isCropping) return;
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
        if (isCropping) {
          e.stop();
          return;
        }
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
        if (isCropping) return;
        const moveable = moveableRef.current;
        if (e.isDragStart) {
          e.inputEvent.preventDefault();
          setTimeout(() => {
            if (!dragStartEnd) {
              moveable?.moveable.dragStart(e.inputEvent);
            }
          });
        } else {
          const targets = e.selected;
          const ids = targets.map((el) => getIdFromClassName(el.className));

          stateManager.updateState(
            {
              activeIds: ids,
            },
            {
              updateHistory: false,
              kind: "layer:selection",
            }
          );
          setTargets(targets);
        }
      });

    setSelection(selection);
    return () => {
      selection.destroy();
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
      {/* Botões suspensos de confirmação/cancelamento exibidos quando o recorte está ativo */}
      {isCropping && selectedItem && (
        <div
          style={{
            position: "absolute",
            left: (parseFloat(selectedItem.details.left) || 0) + (parseFloat(selectedItem.details.width) || 300) / 2,
            top: (parseFloat(selectedItem.details.top) || 0) - 46,
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "auto",
          }}
          className="flex items-center gap-1 bg-white text-zinc-900 px-2 py-1 rounded-lg shadow-xl border border-zinc-200"
        >
          <button
            type="button"
            onClick={handleApplyCrop}
            className="p-1 hover:bg-zinc-100 rounded text-emerald-600 transition-colors cursor-pointer"
            title="Confirmar Recorte"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelCrop}
            className="p-1 hover:bg-zinc-100 rounded text-zinc-600 transition-colors cursor-pointer"
            title="Cancelar Recorte"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Renderização da moldura tracejada ajustável */}
      {isCropping && selectedItem && cropValues && (
        <CropOverlay
          item={selectedItem}
          zoom={zoom}
          currentCrop={cropValues}
          setCropValues={setCropValues}
        />
      )}

      {/* Moveable padrão mantido exatamente com sua lógica original */}
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

            if (moveX) {
              newLeft += diffX;
            }
            if (moveY) {
              newTop += diffY;
            }
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

              const scaleY = nextHeight / currentHeight;
              const scale = scaleY;

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