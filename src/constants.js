// Configurações gerais da Timeline
export const PREVIEW_FRAME_WIDTH = 188;
export const DEFAULT_FRAMERATE = 60;
export const FRAME_INTERVAL = 1000 / DEFAULT_FRAMERATE;
export const TIMELINE_OFFSET_X = 40;
export const TIMELINE_OFFSET_CANVAS_LEFT = 16;
export const TIMELINE_OFFSET_CANVAS_RIGHT = 80;

// Tipografia
export const DEFAULT_FONT = "Roboto";
export const DEFAULT_WEIGHT = "Regular";
export const SECONDARY_FONT_URL =
  "https://fonts.gstatic.com/s/roboto/v29/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf";
export const SECONDARY_FONT = "Roboto";

export const LARGER_FONT_SIZE = 30;
export const LARGE_FONT_SIZE = 24;
export const NORMAL_FONT_SIZE = 16;
export const SMALL_FONT_SIZE = 12;

// Eventos do Player (antigo events.js)
export const PLAYER_PREFIX = "player";
export const PLAYER_PLAY = `${PLAYER_PREFIX}:play`;
export const PLAYER_PAUSE = `${PLAYER_PREFIX}:pause`;
export const PLAYER_SEEK = `${PLAYER_PREFIX}:seek`;
export const PLAYER_SEEK_TO = `${PLAYER_PREFIX}:seekTo`;
export const PLAYER_SEEK_BY = `${PLAYER_PREFIX}:seekBy`;
export const PLAYER_TOGGLE_PLAY = `${PLAYER_PREFIX}:togglePlay`;