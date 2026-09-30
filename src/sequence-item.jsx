import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame } from "remotion";
import {
  calculateContainerStyles,
  calculateMediaStyles,
  calculateTextStyles,
} from "./editor-store";
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
  const { fps = 30 } = options;
  const { details = {} } = item;
  const { from, durationInFrames } = calculateFrames(item.display, fps);

  const playbackRate = item.playbackRate || details.playbackRate || 1;
  const frame = useCurrentFrame();
  
  // Multiplica o tempo do frame pela velocidade para sincronizar com o vídeo
  const currentTimeMs = (frame / fps) * 1000 * playbackRate;
  const totalDurationMs = (durationInFrames / fps) * 1000 * playbackRate;

  const segments =
    details.segments && details.segments.length > 0
      ? details.segments
      : buildTimedSegments(details.text || "", 0, totalDurationMs);

  let currentSegment = segments.find(
    (seg) => currentTimeMs >= seg.start && currentTimeMs < seg.end
  );


  // Se o vídeo estiver pausado no início ou fim, exibe o primeiro bloco
// Se o vídeo estiver em silêncio ou fora do tempo da fala, não exibe nada
  if (!currentSegment) {
    return null;
  }

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
        zIndex: 9999, // FORÇA A LEGENDA A FICAR ACIMA DO VÍDEO E DO THREE.JS
        pointerEvents: "none",
      }}
    >
      <div
        data-track-item="transition-element"
        className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
        style={{
          position: "absolute",
          left: details.left || 0,
          top: details.top || 0,
          width: details.width || 900,
          height: details.height || 160,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "auto",
          cursor: "move",
        }}
      >
        {currentSegment && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: "14px",
              padding: "12px 28px",
              backgroundColor: bgCol,
              borderRadius: "16px",
              border: bgCol !== "transparent" ? "2px solid rgba(255, 255, 255, 0.2)" : "none",
              boxShadow: bgCol !== "transparent" ? "0 10px 35px rgba(0,0,0,0.85)" : "none",
            }}
          >
            {currentSegment.words.map((w, idx) => {
              const isWordActive =
                currentTimeMs >= w.start && currentTimeMs < w.end;

              return (
                <span
                  key={idx}
                  style={{
                    fontFamily: details.fontFamily || "Impact, sans-serif",
                    fontSize: `${fSize}px`,
                    fontWeight: "900",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: isWordActive ? activeCol : normalCol,
                    transform: isWordActive ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.05s ease, color 0.05s ease",
                    textShadow: isWordActive
                      ? `0 0 22px ${activeCol}, 3px 3px 0 #000`
                      : "3px 3px 0 #000",
                    display: "inline-block",
                    pointerEvents: "none",
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        )}
      </div>
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