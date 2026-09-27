import { useEffect, useState } from "react";
import { dispatch, filter, subject } from "@designcombo/events";
import {
  EDIT_OBJECT,
  EDIT_TEMPLATE_ITEM,
  ENTER_EDIT_MODE,
} from "@designcombo/state";
import { merge } from "lodash";

import useStore, { calculateTextHeight } from "./editor-store.js";
import { groupTrackItems } from "./timeline-toolkit.js";
import { SequenceItem } from "./sequence-item.jsx";

const Composition = () => {
  const [editableTextId, setEditableTextId] = useState(null);
  const {
    trackItemIds,
    trackItemsMap,
    fps,
    trackItemDetailsMap,
    sceneMoveableRef,
    transitionsMap,
  } = useStore();

  const mergedTrackItemsDetailsMap = merge(trackItemsMap, trackItemDetailsMap);
  const groupedItems = groupTrackItems({
    trackItemIds,
    transitionsMap,
    trackItemsMap: mergedTrackItemsDetailsMap,
  });

  const handleTextChange = (id) => {
    const elRef = document.querySelector(`.id-${id}`);
    const textDiv =
      elRef?.firstElementChild?.firstElementChild?.firstElementChild;
    if (!elRef || !textDiv || !elRef.innerText) return;

    const {
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      textShadow,
      webkitTextStroke,
    } = textDiv.style;
    const { width } = elRef.style;

    const newHeight = calculateTextHeight({
      family: fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      text: elRef.innerText,
      textShadow,
      webkitTextStroke,
      width,
      id,
    });

    elRef.style.height = `${newHeight}px`;
    sceneMoveableRef?.current?.moveable.updateRect();
    sceneMoveableRef?.current?.moveable.forceUpdate();
  };

  const onTextBlur = (id) => {
    const elRef = document.querySelector(`.id-${id}`);
    const textDiv =
      elRef?.firstElementChild?.firstElementChild?.firstElementChild;
    if (!elRef || !textDiv || !elRef.innerText) return;

    const {
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      textShadow,
      webkitTextStroke,
    } = textDiv.style;
    const { width } = elRef.style;

    const newHeight = calculateTextHeight({
      family: fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      text: elRef.innerText,
      textShadow,
      webkitTextStroke,
      width,
      id,
    });

    dispatch(EDIT_OBJECT, {
      payload: {
        [id]: {
          details: {
            height: newHeight,
          },
        },
      },
    });
  };

  useEffect(() => {
    const stateEvents = subject.pipe(
      filter(({ key }) => key.startsWith(ENTER_EDIT_MODE))
    );

    const subscription = stateEvents.subscribe((obj) => {
      if (obj.key === ENTER_EDIT_MODE) {
        if (editableTextId) {
          const element = document.querySelector(
            `[data-text-id="${editableTextId}"]`
          );
          if (trackItemIds.includes(editableTextId)) {
            dispatch(EDIT_OBJECT, {
              payload: {
                [editableTextId]: {
                  details: {
                    text: element?.innerHTML || "",
                  },
                },
              },
            });
          } else {
            dispatch(EDIT_TEMPLATE_ITEM, {
              payload: {
                [editableTextId]: {
                  details: {
                    text: element?.textContent || "",
                  },
                },
              },
            });
          }
        }
        setEditableTextId(obj.value?.payload.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [editableTextId, trackItemIds]);

  return (
    <>
      {groupedItems.map((group) => {
        if (group.length === 1) {
          const item = mergedTrackItemsDetailsMap[group[0].id];
          return SequenceItem[item.type]?.(item, {
            fps,
            handleTextChange,
            onTextBlur,
            editableTextId,
          });
        }
        return null;
      })}
    </>
  );
};

export default Composition;