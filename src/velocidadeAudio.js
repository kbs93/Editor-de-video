import useStore from "./editor-store.js";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";

let currentSelectedSpeed = 1;

// ==========================================
// 1. APLICA A VELOCIDADE EXCLUSIVAMENTE VIA REMOTION
// ==========================================
export function applySpeedToActiveMedia(speedMultiplier) {
  currentSelectedSpeed = speedMultiplier;

  const state = useStore.getState();
  const { activeIds, trackItemIds, trackItemsMap, trackItemDetailsMap, setState } = state;

  // 1. Altera apenas a taxa do relógio mestre do player (sem forçar a tag nativa a dobrar a velocidade)
  setState({ playbackRate: speedMultiplier });

  // 2. Metadados do clipe ativo para salvar no projeto sem alterar a duração da timeline
  let targetId = activeIds && activeIds.length > 0 ? activeIds[0] : null;
  if (!targetId || (trackItemsMap[targetId]?.type !== "video" && trackItemsMap[targetId]?.type !== "audio")) {
    targetId = trackItemIds.find(
      (id) => trackItemsMap[id]?.type === "video" || trackItemsMap[id]?.type === "audio"
    );
  }

  if (targetId) {
    const currentItem = trackItemsMap[targetId] || {};
    const currentDetails = trackItemDetailsMap[targetId] || currentItem.details || {};

    const updatedDetails = {
      ...currentDetails,
      speed: speedMultiplier,
      playbackRate: speedMultiplier,
    };

    setState({
      trackItemDetailsMap: {
        ...trackItemDetailsMap,
        [targetId]: updatedDetails,
      },
    });

    dispatch(EDIT_OBJECT, {
      payload: {
        [targetId]: {
          speed: speedMultiplier,
          playbackRate: speedMultiplier,
          details: updatedDetails,
        },
      },
    });
  }
}

// ==========================================
// 2. INTERFACE VISUAL (PAINEL LATERAL)
// ==========================================
const SPEED_LIST = [
  { label: "0,25x", value: 0.25 },
  { label: "0,5x", value: 0.5 },
  { label: "0,75x", value: 0.75 },
  { label: "Normal", value: 1 },
  { label: "1,25x", value: 1.25 },
  { label: "1,5x", value: 1.5 },
  { label: "2x", value: 2 },
];

export function openSpeedModal(container, onClose) {
  if (!container) return;

  const buttonsHtml = SPEED_LIST.map((item) => {
    const isSelected = item.value === currentSelectedSpeed;
    return `
      <button
        type="button"
        data-speed="${item.value}"
        class="btn-speed-item"
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1.5px solid ${isSelected ? "#7c3aed" : "rgba(39, 39, 42, 0.8)"};
          background-color: ${isSelected ? "#3b1764" : "#18181b"};
          color: ${isSelected ? "#ffffff" : "#d4d4d8"};
          font-size: 13px;
          font-family: sans-serif;
          cursor: pointer;
          outline: none;
          box-sizing: border-box;
          user-select: none;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        "
      >
        <span class="btn-label" style="font-weight: ${isSelected ? "700" : "500"}; pointer-events: none;">${item.label}</span>
        <span class="btn-tag" style="font-size: 11px; color: ${isSelected ? "#c4b5fd" : "#71717a"}; pointer-events: none;">${item.value}x</span>
      </button>
    `;
  }).join("");

  container.innerHTML = `
    <div style="width: 224px; padding: 14px; display: flex; flex-direction: column; height: 100%; border-left: 1px solid rgba(255,255,255,0.1); background-color: #161618; box-sizing: border-box;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #27272a; flex-shrink: 0;">
        <span style="font-size: 13px; font-weight: 600; color: #f4f4f5; font-family: sans-serif;">Velocidade da Mídia</span>
        <button type="button" id="btn-speed-close" style="background: transparent; border: none; color: #a1a1aa; font-size: 14px; cursor: pointer; border-radius: 4px; padding: 2px 4px;">✕</button>
      </div>

      <div id="speed-options-container" style="display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto;">
        ${buttonsHtml}
      </div>
    </div>
  `;

  const btnClose = container.querySelector("#btn-speed-close");
  btnClose?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (typeof onClose === "function") onClose();
  });

  const optionsContainer = container.querySelector("#speed-options-container");
  const allButtons = container.querySelectorAll(".btn-speed-item");

  optionsContainer?.addEventListener("click", (e) => {
    const clickedBtn = e.target.closest(".btn-speed-item");
    if (!clickedBtn) return;

    e.stopPropagation();
    const speed = parseFloat(clickedBtn.getAttribute("data-speed"));
    if (isNaN(speed)) return;

    allButtons.forEach((btn) => {
      btn.style.border = "1.5px solid rgba(39, 39, 42, 0.8)";
      btn.style.backgroundColor = "#18181b";
      btn.style.color = "#d4d4d8";
      const lbl = btn.querySelector(".btn-label");
      const tag = btn.querySelector(".btn-tag");
      if (lbl) lbl.style.fontWeight = "500";
      if (tag) tag.style.color = "#71717a";
    });

    clickedBtn.style.border = "1.5px solid #7c3aed";
    clickedBtn.style.backgroundColor = "#3b1764";
    clickedBtn.style.color = "#ffffff";
    const activeLbl = clickedBtn.querySelector(".btn-label");
    const activeTag = clickedBtn.querySelector(".btn-tag");
    if (activeLbl) activeLbl.style.fontWeight = "700";
    if (activeTag) activeTag.style.color = "#c4b5fd";

    applySpeedToActiveMedia(speed);
  });
}