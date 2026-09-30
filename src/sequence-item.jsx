import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";
import useStore, {
  calculateContainerStyles,
  calculateMediaStyles,
  calculateTextStyles,
} from "./editor-store.js";


import {
  calculateFrames,
  combineAnimations,
  useAnimation,
} from "./timeline-toolkit";
import { ThreeVideoEffect } from "./three-video-effect";
import { buildTimedSegments } from "./legenda";

// ==========================================
// 1. CAMADA DE TEXTO EDITÁVEL (TextLayer)
// ==========================================
function TextLayer({ id, content, editable, style = {}, onChange, onBlur }) {
  const [data, setData] = useState(content);
  const divRef = useRef(null);

  useEffect(() => {
    if (editable && divRef.current) {
      const element = divRef.current;
      element.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      const selection = window.getSelection();
      selection?.removeAllRanges();
    }
  }, [editable]);

  useEffect(() => {
    if (data !== content) {
      setData(content);
    }
  }, [content, data]);

  const moveCaretToEnd = () => {
    if (divRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(divRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    const selection = window.getSelection();
    const element = divRef.current;

    if (selection?.rangeCount && element) {
      const range = selection.getRangeAt(0);
      if (range.endOffset - range.startOffset === element.textContent?.length) {
        moveCaretToEnd();
      }
    }
  };

  return (
    <div
      data-text-id={id}
      ref={divRef}
      contentEditable={editable}
      onClick={handleClick}
      onInput={(ev) => onChange(id, ev.target.innerText)}
      onBlur={(ev) => onBlur(id, ev.target.innerText)}
      style={{
        height: "100%",
        boxShadow: "none",
        outline: "none",
        ...style,
        pointerEvents: editable ? "auto" : "none",
        whiteSpace: "normal",
        width: "100%",
      }}
      dangerouslySetInnerHTML={{ __html: content }}
      className="designcombo_textLayer"
    />
  );
}

// ==========================================
// 2. COMPONENTES E HELPERS DE ANIMAÇÃO DE TEXTO
// ==========================================
const extractTransformations = (transform) => {
  let translateX = "";
  let translateY = "";
  let scale = "scale(1)";
  let rotation = "";

  const translateXMatch = transform.match(/translateX\([^)]+\)/);
  if (translateXMatch) translateX = translateXMatch[0];

  const translateYMatch = transform.match(/translateY\([^)]+\)/);
  if (translateYMatch) translateY = translateYMatch[0];

  const scaleMatch = transform.match(/scale\([^)]+\)/);
  if (scaleMatch) scale = scaleMatch[0];

  const rotationMatch = transform.match(/rotate\([^)]+\)/);
  if (rotationMatch) rotation = rotationMatch[0];

  return { translateX, translateY, scale, rotation };
};

export const combine = (...animations) => {
  return animations
    .flat()
    .filter((anim) => anim !== undefined)
    .reduce((acc, curr) => {
      const existingAnim = acc.find((a) => a.property === curr.property);
      if (existingAnim) {
        return acc.map((a) =>
          a.property === curr.property
            ? {
                ...a,
                from: Math.min(a.from, curr.from),
                to: Math.max(a.to, curr.to),
                durationInFrames: Math.max(
                  a.durationInFrames,
                  curr.durationInFrames
                ),
                delay: Math.min(a.delay || 0, curr.delay || 0),
                ease: (t) => (a.ease(t) + curr.ease(t)) / 2,
              }
            : a
        );
      } else {
        return [...acc, curr];
      }
    }, []);
};

export const Animated = ({
  animationIn,
  animationOut,
  durationInFrames,
  children,
  style = {},
}) => {
  const inStyle = useAnimation(
    combineAnimations(animationIn),
    durationInFrames,
    false
  );
  const outStyle = useAnimation(
    combineAnimations(animationOut),
    durationInFrames,
    true
  );

  const transformStyle = style?.transform || "";
  const match = transformStyle.match(/rotate\((-?[\d.]+)deg\)/);
  const rotationValue = match ? parseFloat(match[1]) : 0;
  const resetRotationValue = -rotationValue;

  const combinedStyle = React.useMemo(() => {
    const result = { ...inStyle };
    Object.entries(outStyle).forEach(([key, value]) => {
      if (key === "transform") {
        result[key] = `${result[key] || ""} ${value || ""}`.trim();
      } else if (
        key in result &&
        typeof result[key] === "number" &&
        typeof value === "number"
      ) {
        result[key] = result[key] * value;
      } else {
        result[key] = value;
      }
    });
    return result;
  }, [inStyle, outStyle]);

  const animatedTransform = useMemo(() => {
    const combinedTransform = combinedStyle.transform || "";
    const { translateX, translateY, scale, rotation } =
      extractTransformations(combinedTransform);

    return `${translateX} ${translateY} ${scale} ${
      rotation || `rotate(${rotationValue}deg)`
    }`.trim();
  }, [combinedStyle, rotationValue]);

  return (
    <div style={{ transform: `rotate(${resetRotationValue}deg) scale(1)` }}>
      <div
        style={{
          ...style,
          ...combinedStyle,
          transform: animatedTransform,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const splitText = (text, splitBy) => {
  if (splitBy === "word") return text.split(/\s+/);
  return text.split("");
};

const createStaggeredAnimations = (animations, count, overlap = 0) => {
  const animArray = Array.isArray(animations) ? animations : [animations];
  const totalDuration = Math.max(...animArray.map((a) => a.durationInFrames));

  return Array.from({ length: count }, (_, index) => {
    const delay = (index / (count - 1)) * totalDuration * (1 - overlap);
    return animArray.map((anim) => ({
      ...anim,
      delay: anim.delay ? anim.delay + delay : delay,
    }));
  });
};

export const AnimatedText = ({
  children,
  durationInFrames,
  wordAnimation,
  letterAnimation,
  className,
}) => {
  const words = useMemo(() => splitText(children, "word"), [children]);
  const allLetters = useMemo(() => splitText(children, "letter"), [children]);

  const createAnimations = (config, elementCount) =>
    config?.animation
      ? createStaggeredAnimations(
          config.animation,
          elementCount,
          config.overlap || 0
        )
      : Array(elementCount).fill([]);

  const wordAnimations = createAnimations(wordAnimation, words.length);
  const letterAnimations = createAnimations(letterAnimation, allLetters.length);

  let letterIndex = 0;
  const animatedWords = words.map((word, wordIndex) => {
    const letters = splitText(word, "letter");

    const animatedLetters = letters.map((letter) => {
      const wordAnim = wordAnimations[wordIndex];
      const letterAnim = letterAnimations[letterIndex];

      const combinedAnimation = combine(
        ...(wordAnim || []),
        ...(letterAnim || [])
      );

      letterIndex++;

      return (
        <Animated
          key={letterIndex}
          animationIn={combinedAnimation}
          durationInFrames={durationInFrames}
        >
          <span style={{ display: "inline-block" }}>{letter}</span>
        </Animated>
      );
    });

    return (
      <span
        key={wordIndex}
        style={{
          display: "inline-flex",
          marginRight: "0.25em",
        }}
      >
        {animatedLetters}
      </span>
    );
  });

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        fontSize: 40,
        color: "green",
      }}
      className={className}
    >
      {animatedWords}
    </div>
  );
};

// ==========================================
// RENDERIZADOR DE VÍDEO COM THREE.JS
// ==========================================

function VideoWithThreeEffects({ item, options }) {
  const { fps, zIndex } = options;
  const { details, animations } = item;
  const { animationIn, animationOut } = getAnimations(animations);
  const playbackRate = item.playbackRate || 1;
  const { from, durationInFrames } = calculateFrames(
    {
      from: item.display.from / playbackRate,
      to: item.display.to / playbackRate,
    },
    fps
  );

  const hasCrop = details.crop && details.crop.width > 0 && details.crop.height > 0;
  const crop = hasCrop ? details.crop : { x: 0, y: 0, width: details.width, height: details.height };
  const containerW = hasCrop ? crop.width : details.width || "100%";
  const containerH = hasCrop ? crop.height : details.height || "auto";
  const containerStyles = calculateContainerStyles(details, crop);

  const [videoElement, setVideoElement] = useState(null);

  const hasActiveEffects = Boolean(
    details.effects?.greenScreen?.enabled ||
    details.effects?.removeColor?.enabled ||
    details.effects?.vhs?.enabled ||
    details.effects?.diffusion?.enabled
  );

  return (
    <Sequence
      key={item.id}
      from={from}
      durationInFrames={durationInFrames}
      style={{ pointerEvents: "none", zIndex }}
    >
      <div
        data-track-item="transition-element"
        className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
        style={{
          ...containerStyles,
          position: "absolute",
          width: containerW,
          height: containerH,
          overflow: "hidden",
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      >
        <Animated
          style={{ width: "100%", height: "100%", position: "relative" }}
          animationIn={animationIn}
          animationOut={animationOut}
          durationInFrames={durationInFrames}
        >
          <div
            style={{
              position: "absolute",
              top: -crop.y,
              left: -crop.x,
              width: details.width,
              height: details.height,
              pointerEvents: "none",
            }}
          >
            <OffthreadVideo
              ref={(ref) => {
                if (ref && !videoElement) setVideoElement(ref);
              }}
              startFrom={(item.trim?.from / 1000) * fps}
              endAt={(item.trim?.to / 1000) * fps}
              playbackRate={playbackRate}
              src={details.src}
              volume={(details.volume ?? 100) / 100}
              style={{
                pointerEvents: "none",
                width: details.width,
                height: details.height,
                opacity: hasActiveEffects ? 0 : 1,
              }}
            />

            {hasActiveEffects && videoElement && (
              <ThreeVideoEffect
                videoElement={videoElement}
                width={details.width}
                height={details.height}
                effects={details.effects || {}}
              />
            )}
          </div>
        </Animated>
      </div>
    </Sequence>
  );
}


function CaptionRenderer({
  item,
  fps,
  playbackRate,
  segments,
  activeCol,
  normalCol,
  fSize,
  details,
}) {
  const frame = useCurrentFrame();
  const { activeIds, size } = useStore();
  const isSelected = activeIds.includes(item.id);

  const [showFontMenu, setShowFontMenu] = useState(false);

  // Escala para compensar o zoom do canvas e manter a toolbar nítida
  const toolbarScale = Math.max(1.8, (size?.width || 1920) / 900);

  const currentTimeMs = (frame / fps) * 1000 * playbackRate;
  const currentSegment = segments.find(
    (seg) => currentTimeMs >= seg.start && currentTimeMs < seg.end
  );

  // Atualiza propriedades de texto da legenda ativa





























const updateCaptionStyle = (newDetails) => {
    const state = useStore.getState();
    const currentItem = state.trackItemsMap[item.id] || {};
    const updatedDetails = {
      ...(currentItem.details || {}),
      ...newDetails,
    };

    useStore.setState((prev) => ({
      trackItemsMap: {
        ...prev.trackItemsMap,
        [item.id]: {
          ...currentItem,
          details: updatedDetails,
        },
      },
      trackItemDetailsMap: {
        ...prev.trackItemDetailsMap,
        [item.id]: updatedDetails,
      },
    }));

    dispatch(EDIT_OBJECT, {
      payload: {
        [item.id]: {
          details: updatedDetails,
        },
      },
    });

    // Força o Remotion a repintar o frame imediatamente
    if (state.playerRef?.current) {
      const currentFrame = state.playerRef.current.getCurrentFrame();
      state.playerRef.current.seekTo(currentFrame);
    }
  };

  

  const currentFontFamily = details.fontFamily || "Poppins";
  const currentFontWeight = details.fontWeight || "bold";
  const currentFontSize = details.fontSize || fSize || 54;
  const currentFontStyle = details.fontStyle || "normal";
  const currentTextAlign = details.textAlign || "center";

  return (
    <div
      data-track-item="transition-element"
      className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
      style={{
        position: "absolute",
        left: details.left || 0,
        top: details.top || 0,
        width: details.width || 900,
        height: details.height || 90,
        pointerEvents: "auto",
        cursor: "move",
      }}
    >
      {/* 1. TEXTO PRINCIPAL: Primeiro filho absoluto para cálculo do Moveable */}
      <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "none" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: currentTextAlign,
          }}
        >
          {currentSegment && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: currentTextAlign === "left" ? "flex-start" : currentTextAlign === "right" ? "flex-end" : "center",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "2px 8px",
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            >
              {currentSegment.words.map((w, idx) => {
                const isWordActive =
                  currentTimeMs >= w.start && currentTimeMs < w.end;

                return (
                  <span
                    key={idx}
                    style={{
                      fontFamily: currentFontFamily,
                      fontSize: `${currentFontSize}px`,
                      fontWeight: currentFontWeight,
                      fontStyle: currentFontStyle,
                      letterSpacing: "1px",
                      textTransform: details.textTransform || "uppercase",
                      color: isWordActive ? activeCol : normalCol,
                      textShadow:
                        details.boxShadow
                          ? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
                          : isWordActive
                          ? `0 0 18px ${activeCol}, 2px 2px 0 #000`
                          : "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
                      WebkitTextStroke: details.borderWidth
                        ? `${details.borderWidth}px ${details.borderColor}`
                        : "none",
                      display: "inline-block",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. BARRA FLUTUANTE COM O LÁPIS E O T */}
      {isSelected && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: `-${Math.round(52 * toolbarScale)}px`,
            left: "50%",
            transform: `translateX(-50%) scale(${toolbarScale})`,
            transformOrigin: "bottom center",
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            padding: "4px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "14px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
            zIndex: 999999,
            pointerEvents: "auto",
            width: "max-content",
            height: "40px",
            boxSizing: "border-box",
          }}
        >
          {/* Botão Lápis: Abre/Fecha a caixinha flutuante de Fonte */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFontMenu((prev) => !prev);
            }}
            title="Formatar Fonte"
            style={{
              border: "none",
              background: showFontMenu ? "#f4f4f5" : "transparent",
              cursor: "pointer",
              padding: "4px 8px",
              margin: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#18181b",
              borderRadius: "6px",
              transition: "background 0.15s ease",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </button>

          {/* Divisor Vertical */}
          <div
            style={{
              width: "1.5px",
              height: "22px",
              backgroundColor: "#e4e4e7",
            }}
          />

          {/* Botão T: Abre a barra de Estilos de Texto */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("OPEN_SIDEBAR_PANEL", {
                  detail: { panel: "text" },
                })
              );
            }}
            title="Estilos de Texto"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: "4px 8px",
              margin: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "900",
              fontSize: "20px",
              fontFamily: "sans-serif",
              color: "#18181b",
              borderRadius: "6px",
              transition: "background 0.15s ease",
            }}
          >
            T
          </button>
        </div>
      )}

      {/* 3. MENU FLUTUANTE DE FONTE (Exatamente igual à Imagem de Referência) */}










{isSelected && showFontMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: `-${Math.round(220 * toolbarScale)}px`,
            left: "50%",
            transform: `translateX(-50%) scale(${toolbarScale})`,
            transformOrigin: "bottom center",
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            padding: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            zIndex: 1000000,
            pointerEvents: "auto",
            width: "250px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            fontFamily: "sans-serif",
            color: "#18181b",
          }}
        >





          {/* Cabeçalho do Menu */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#18181b" }}>Fonte</span>
            <button
              type="button"
              onClick={() => setShowFontMenu(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                color: "#71717a",
                padding: "2px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Seletor de Família de Fonte (Poppins, Roboto, Impact...) */}
          <select
            value={currentFontFamily}
            onChange={(e) => updateCaptionStyle({ fontFamily: e.target.value })}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "6px",
              border: "1.5px solid #e4e4e7",
              backgroundColor: "#ffffff",
              fontSize: "13px",
              color: "#18181b",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="Poppins">Poppins</option>
            <option value="Roboto">Roboto</option>
            <option value="Impact">Impact</option>
            <option value="Arial">Arial</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Inter">Inter</option>
          </select>

          {/* Linha de Peso (Negrito) e Tamanho */}
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            <select
              value={currentFontWeight}
              onChange={(e) => updateCaptionStyle({ fontWeight: e.target.value })}
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1.5px solid #e4e4e7",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                color: "#18181b",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="normal">Normal</option>
              <option value="600">Médio</option>
              <option value="bold">Negrito</option>
              <option value="900">Extra Negrito</option>
            </select>

        <select
              value={Number(currentFontSize)}
              onChange={(e) => {
                e.stopPropagation();
                updateCaptionStyle({ fontSize: Number(e.target.value) });
              }}
              style={{
                width: "80px",
                padding: "7px 10px",
                borderRadius: "6px",
                border: "1.5px solid #e4e4e7",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                color: "#18181b",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {[24, 32, 40, 48, 54, 60, 72, 84, 96, 110, 130].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          {/* Linha com Alinhamento, Botão Negrito e Itálico */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
            {/* Alinhamento de Texto */}
            <div style={{ display: "flex", gap: "3px" }}>
              <button
                type="button"
                onClick={() => updateCaptionStyle({ textAlign: "left" })}
                style={{
                  background: currentTextAlign === "left" ? "#f4f4f5" : "#ffffff",
                  border: "1.5px solid #e4e4e7",
                  borderRadius: "6px",
                  padding: "5px 7px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                title="Esquerda"
              >
                ≡
              </button>
              <button
                type="button"
                onClick={() => updateCaptionStyle({ textAlign: "center" })}
                style={{
                  background: currentTextAlign === "center" ? "#f4f4f5" : "#ffffff",
                  border: "1.5px solid #e4e4e7",
                  borderRadius: "6px",
                  padding: "5px 7px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                title="Centralizado"
              >
                ≣
              </button>
              <button
                type="button"
                onClick={() => updateCaptionStyle({ textAlign: "right" })}
                style={{
                  background: currentTextAlign === "right" ? "#f4f4f5" : "#ffffff",
                  border: "1.5px solid #e4e4e7",
                  borderRadius: "6px",
                  padding: "5px 7px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                title="Direita"
              >
                ≡
              </button>
            </div>

            {/* Alternadores B (Negrito) e I (Itálico) */}
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() =>
                  updateCaptionStyle({
                    fontWeight: currentFontWeight === "bold" || currentFontWeight === "900" ? "normal" : "bold",
                  })
                }
                style={{
                  background: currentFontWeight === "bold" || currentFontWeight === "900" ? "#e4e4e7" : "#ffffff",
                  border: "1.5px solid #e4e4e7",
                  borderRadius: "6px",
                  width: "32px",
                  height: "30px",
                  cursor: "pointer",
                  fontWeight: "900",
                  fontSize: "14px",
                  color: "#18181b",
                }}
                title="Negrito"
              >
                B
              </button>
              <button
                type="button"
                onClick={() =>
                  updateCaptionStyle({
                    fontStyle: currentFontStyle === "italic" ? "normal" : "italic",
                  })
                }
                style={{
                  background: currentFontStyle === "italic" ? "#e4e4e7" : "#ffffff",
                  border: "1.5px solid #e4e4e7",
                  borderRadius: "6px",
                  width: "32px",
                  height: "30px",
                  cursor: "pointer",
                  fontStyle: "italic",
                  fontSize: "14px",
                  color: "#18181b",
                }}
                title="Itálico"
              >
                I
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}




























// ==========================================
// 3. ORQUESTRADOR DE ITENS DE SEQUÊNCIA
// ==========================================
const getAnimations = (animations) => {
  return {
    animationIn: animations?.in || null,
    animationOut: animations?.out || null,
  };
};

export const SequenceItem = {
text: (item, options) => {
    const { fps = 30, zIndex } = options;
    const { details = {}, animations } = item;
    const { animationIn, animationOut } = getAnimations(animations);
    const playbackRate = item.playbackRate || 1;
    const { from, durationInFrames } = calculateFrames(
      {
        from: (item.display?.from || 0) / playbackRate,
        to: (item.display?.to || 5000) / playbackRate,
      },
      fps
    );

    const textStyles = calculateTextStyles(details);

    return (
      <Sequence
        key={item.id}
        from={from}
        durationInFrames={durationInFrames}
        style={{ pointerEvents: "none", zIndex }}
      >
        <div
          data-track-item="transition-element"
          className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
          style={{
            position: "absolute",
            left: details.left ?? 0,
            top: details.top ?? 0,
            width: details.width ?? 500,
            height: details.height ?? 120,
            pointerEvents: "auto",
            cursor: "move",
            display: "flex",
            alignItems: "center",
            justifyContent: details.textAlign || "center",
            backgroundColor: details.backgroundColor || "transparent",
            borderRadius: details.borderRadius || "0px",
            padding: details.padding || "0px",
            border: details.borderWidth ? `${details.borderWidth}px solid ${details.borderColor}` : "none",
            boxShadow: details.boxShadow
              ? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
              : "none",
          }}
        >
          <Animated
            style={{ width: "100%", height: "100%", position: "relative" }}
            animationIn={animationIn}
            animationOut={animationOut}
            durationInFrames={durationInFrames}
          >
            <div
              style={{
                ...textStyles,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: details.textAlign || "center",
                color: details.color || "#ffffff",
                fontSize: `${details.fontSize || 70}px`,
                fontWeight: details.fontWeight || "800",
                fontFamily: details.fontFamily || "sans-serif",
                textShadow: details.boxShadow
                  ? `${details.boxShadow.x}px ${details.boxShadow.y}px ${details.boxShadow.blur}px ${details.boxShadow.color}`
                  : "none",
                WebkitTextStroke: details.borderWidth
                  ? `${details.borderWidth}px ${details.borderColor}`
                  : "none",
                userSelect: "none",
              }}
            >
              {details.text || item.text || item.name || ""}
            </div>
          </Animated>
        </div>
      </Sequence>
    );
  },
  // RENDERIZAÇÃO DA LEGENDA DINÂMICA INTEGRADA AO MOVEABLE






























caption: (item, options) => {
    const { fps = 30, zIndex } = options;
    const { details = {} } = item;
    const { from, durationInFrames } = calculateFrames(item.display, fps);

    const playbackRate = item.playbackRate || details.playbackRate || 1;
    const totalDurationMs = (durationInFrames / fps) * 1000 * playbackRate;

    const segments =
      details.segments && details.segments.length > 0
        ? details.segments
        : buildTimedSegments(details.text || "", 0, totalDurationMs);

    const activeCol = details.activeColor || "#38bdf8";
    const normalCol = details.textColor || "#ffffff";
    const bgCol = details.backgroundColor || "rgba(0, 0, 0, 0.75)";
    const fSize = details.fontSize || 56;

    return (
      <Sequence
        key={item.id}
        from={from}
        durationInFrames={durationInFrames}
        style={{
          zIndex: zIndex || 9999,
          pointerEvents: "none",
        }}
      >
        <CaptionRenderer
          item={item}
          fps={fps}
          playbackRate={playbackRate}
          segments={segments}
          activeCol={activeCol}
          normalCol={normalCol}
          bgCol={bgCol}
          fSize={fSize}
          details={details}
        />
      </Sequence>
    );
  },









image: (item, options) => {
    const { fps = 30, zIndex } = options;
    const { details = {}, animations } = item;
    const { animationIn, animationOut } = getAnimations(animations);
    const playbackRate = item.playbackRate || 1;
    const { from, durationInFrames } = calculateFrames(
      {
        from: (item.display?.from || 0) / playbackRate,
        to: (item.display?.to || 5000) / playbackRate,
      },
      fps
    );

    const hasCrop = details.crop && details.crop.width > 0 && details.crop.height > 0;
    const crop = hasCrop ? details.crop : { x: 0, y: 0, width: details.width, height: details.height };
    const containerW = hasCrop ? crop.width : details.width || "100%";
    const containerH = hasCrop ? crop.height : details.height || "auto";
    const containerStyles = calculateContainerStyles(details, crop);

    return (
      <Sequence
        key={item.id}
        from={from}
        durationInFrames={durationInFrames}
        style={{ pointerEvents: "none", zIndex }}
      >
        <div
          data-track-item="transition-element"
          className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
          style={{
            ...containerStyles,
            position: "absolute",
            width: containerW,
            height: containerH,
            overflow: "hidden",
            pointerEvents: "auto",
            cursor: "pointer",
          }}
        >
          <Animated
            style={{ width: "100%", height: "100%", position: "relative" }}
            animationIn={animationIn}
            animationOut={animationOut}
            durationInFrames={durationInFrames}
          >
            <div
              style={{
                position: "absolute",
                top: -crop.y,
                left: -crop.x,
                width: details.width,
                height: details.height,
                pointerEvents: "none",
              }}
            >
              <Img
                src={details.src}
                style={{
                  width: details.width,
                  height: details.height,
                  opacity: (details.opacity ?? 100) / 100,
                  objectFit: "fill",
                  pointerEvents: "none",
                }}
              />
            </div>
          </Animated>
        </div>
      </Sequence>
    );
  },


  video: (item, options) => <VideoWithThreeEffects key={item.id} item={item} options={options} />,
audio: (item, options) => {
    const { fps = 30 } = options;
    const { details = {}, trim = {}, display = {} } = item;
    const playbackRate = item.playbackRate || details.playbackRate || 1;

    const { from, durationInFrames } = calculateFrames(
      {
        from: (display.from || 0) / playbackRate,
        to: (display.to || 5000) / playbackRate,
      },
      fps
    );

    const startFromFrames = ((trim.from || 0) / 1000) * fps;
    const endAtFrames = trim.to ? (trim.to / 1000) * fps : undefined;
    const volume = (details.volume ?? 100) / 100;

    return (
      <Sequence
        key={item.id}
        from={from}
        durationInFrames={durationInFrames}
      >
        <Audio
          src={details.src}
          volume={volume}
          playbackRate={playbackRate}
          startFrom={startFromFrames}
          endAt={endAtFrames}
        />
      </Sequence>
    );
  },
};



export default SequenceItem;