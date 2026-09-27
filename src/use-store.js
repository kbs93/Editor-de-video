import { create } from "zustand";

export const useDataState = create((set) => ({
  fonts: [],
  compactFonts: [],
  setFonts: (fonts) => set({ fonts }),
  setCompactFonts: (compactFonts) => set({ compactFonts }),
}));

const useStore = create((set) => ({
  size: {
    width: 1920,
    height: 1080,
  },

  timeline: null,
  duration: 1000,
  fps: 30,
  scale: {
    index: 7,
    unit: 300,
    zoom: 1 / 300,
    segments: 5,
  },
  scroll: {
    left: 0,
    top: 0,
  },
  playerRef: null,
  trackItemDetailsMap: {},
  activeIds: [],
  targetIds: [],
  tracks: [],
  trackItemIds: [],
  transitionIds: [],
  transitionsMap: {},
  trackItemsMap: {},
  sceneMoveableRef: null,

  // Estados específicos para o modo de corte (Crop)
  cropState: {
    activeId: null,
    crop: null,
    backupCrop: null,
  },
  setCropState: (cropState) =>
    set((state) => ({
      cropState:
        typeof cropState === "function"
          ? cropState(state.cropState)
          : { ...state.cropState, ...cropState },
    })),

  setTimeline: (timeline) =>
    set(() => ({
      timeline: timeline,
    })),
  setScale: (scale) =>
    set(() => ({
      scale: scale,
    })),
  setScroll: (scroll) =>
    set(() => ({
      scroll: scroll,
    })),
  setState: async (state) => {
    return set({ ...state });
  },
  setPlayerRef: (playerRef) => set({ playerRef }),
  setSceneMoveableRef: (ref) => set({ sceneMoveableRef: ref }),
}));

export default useStore;