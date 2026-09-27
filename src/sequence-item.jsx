import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence } from "remotion";
import TextLayer from "./editable-text";
import { calculateFrames } from "./timeline-utils";
import { Animated } from "./animated-text-bundle";
import {
  calculateContainerStyles,
  calculateMediaStyles,
  calculateTextStyles,
} from "./scene-utils";

const getAnimations = (animations, item) => {
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
    const { animationIn, animationOut } = getAnimations(animations, item);
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
    const { animationIn, animationOut } = getAnimations(animations, item);
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
    const { animationIn, animationOut } = getAnimations(animations, item);
    const playbackRate = item.playbackRate || 1;
    const { from, durationInFrames } = calculateFrames(
      {
        from: item.display.from / playbackRate,
        to: item.display.to / playbackRate,
      },
      fps
    );

    const hasCrop = details.crop && details.crop.width > 0 && details.crop.height > 0;
    const crop = hasCrop
      ? details.crop
      : {
          x: 0,
          y: 0,
          width: details.width,
          height: details.height,
        };

    const containerW = hasCrop ? crop.width : (details.width || "100%");
    const containerH = hasCrop ? crop.height : (details.height || "auto");

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
            ...calculateContainerStyles(details, crop),
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