export const state = {
  videoLoaded: false,
  isPlaying: false,
  duration: 0,
  currentTime: 0,
  aspectRatio: 16 / 9,
  activeEffect: null,
  selectedElement: null, // 'overlay', 'video', 'text' ou null
  videoRect: null,
  overlay: {
    img: null,
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    isDragging: false,
    isResizing: false,
    dragStartX: 0,
    dragStartY: 0
  },
  customText: {
    active: false,
    text: '',
    style: 'plain',
    x: 300,
    y: 300,
    width: 280,
    height: 90,
    isDragging: false,
    isResizing: false,
    dragStartX: 0,
    dragStartY: 0
  },
  subtitle: {
    text: '',
    font: 'Poppins',
    weight: 'bold',
    size: 24,
    align: 'center',
    uppercase: false,
    color: '#ffffff',
    backgroundColor: '#000000',
    noBackground: true
  }
};

export const timelineConfig = {
  pixelsPerSecond: 120,
  trimStart: 0,
  trimEnd: 0
};