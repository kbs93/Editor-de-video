import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence } from "remotion";
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
    const { handleTextChange, onTextBlur, fps, editableTextId, zIndex } =
      options;
    const { id, details, animations } = item;
    const { from, durationInFrames } = calculateFrames(item.display, fps);
    const { animationIn, animationOut } = getAnimations(animations);
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
            ...calculateContainerStyles(details),
            position: "absolute",
            width: details.width || 300,
            height: details.height || "auto",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <Animated
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
            animationIn={editableTextId === id ? null : animationIn}
            animationOut={editableTextId === id ? null : animationOut}
            durationInFrames={durationInFrames}
          >
            <TextLayer
              key={id}
              id={id}
              content={details.text}
              editable={editableTextId === id}
              onChange={handleTextChange}
              onBlur={onTextBlur}
              style={{
                ...calculateTextStyles(details),
                width: "100%",
                height: "100%",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                boxSizing: "border-box",
              }}
            />
          </Animated>
        </div>
      </Sequence>
    );
  },

  image: (item, options) => {
    const { fps, zIndex } = options;
    const { details, animations } = item;
    const { from, durationInFrames } = calculateFrames(item.display, fps);
    const { animationIn, animationOut } = getAnimations(animations);
    const crop = details.crop || {
      x: 0,
      y: 0,
      width: item.details.width,
      height: item.details.height,
    };
    return (
      <Sequence
        key={item.id}
        from={from}
        durationInFrames={durationInFrames}
        style={{ pointerEvents: "none", zIndex }}
      >
        <AbsoluteFill
          data-track-item="transition-element"
          className={`designcombo-scene-item id-${item.id} designcombo-scene-item-type-${item.type}`}
          style={{
            ...calculateContainerStyles(details, crop),
            pointerEvents: "auto",
            cursor: "pointer",
          }}
        >
          <Animated
            style={calculateContainerStyles(details, crop, {
              overflow: "hidden",
            })}
            animationIn={animationIn}
            animationOut={animationOut}
            durationInFrames={durationInFrames}
          >
            <div
              style={{
                ...calculateMediaStyles(details, crop),
                pointerEvents: "none",
              }}
            >
              <Img
                data-id={item.id}
                src={details.src}
                style={{ pointerEvents: "none" }}
              />
            </div>
          </Animated>
        </AbsoluteFill>
      </Sequence>
    );
  },


















  


video: (item, options) => {
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

    const hasCrop =
      details.crop && details.crop.width > 0 && details.crop.height > 0;
    const crop = hasCrop
      ? details.crop
      : {
          x: 0,
          y: 0,
          width: details.width,
          height: details.height,
        };

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
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
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
                startFrom={(item.trim?.from / 1000) * fps}
                endAt={(item.trim?.to / 1000) * fps}
                playbackRate={playbackRate}
                src={details.src}
                volume={(details.volume ?? 100) / 100}
                style={{
                  pointerEvents: "none",
                  width: details.width,
                  height: details.height,
                  filter: calculateContainerStyles(details, crop).filter,
                  mixBlendMode: calculateContainerStyles(details, crop).mixBlendMode,
                }}
      



              />
            </div>
          </Animated>
        </div>
      </Sequence>
    );
  },










  audio: (item, options) => {
    const { fps, zIndex } = options;
    const { details } = item;
    const playbackRate = item.playbackRate || 1;
    const { from, durationInFrames } = calculateFrames(
      {
        from: item.display.from / playbackRate,
        to: item.display.to / playbackRate,
      },
      fps
    );
    return (
      <Sequence
        key={item.id}
        from={from}
        durationInFrames={durationInFrames}
        style={{
          userSelect: "none",
          pointerEvents: "none",
          zIndex,
        }}
      >
        <AbsoluteFill>
          <Audio
            startFrom={(item.trim?.from / 1000) * fps}
            endAt={(item.trim?.to / 1000) * fps}
            playbackRate={playbackRate}
            src={details.src}
            volume={details.volume / 100}
          />
        </AbsoluteFill>
      </Sequence>
    );
  },
};

export default SequenceItem;