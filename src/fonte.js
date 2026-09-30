import useStore from "./editor-store.js";
import { dispatch } from "@designcombo/events";
import { EDIT_OBJECT } from "@designcombo/state";

let fontToolbarElement = null;
let currentActiveId = null;

// Função que atualiza o estilo da legenda na store e no editor
function updateCaptionStyle(newDetails) {
  if (!currentActiveId) return;

  const state = useStore.getState();
  const item = state.trackItemsMap[currentActiveId] || {};
  const updatedDetails = {
    ...(item.details || {}),
    ...newDetails,
  };

  // 1. Atualiza a store global usada pelo Remotion e UI
  useStore.setState((prev) => ({
    trackItemsMap: {
      ...prev.trackItemsMap,
      [currentActiveId]: {
        ...item,
        details: updatedDetails,
      },
    },
    trackItemDetailsMap: {
      ...prev.trackItemDetailsMap,
      [currentActiveId]: updatedDetails,
    },
  }));

  // 2. Dispara EDIT_OBJECT de forma segura
  try {
    dispatch(EDIT_OBJECT, {
      payload: {
        id: currentActiveId,
        details: updatedDetails,
        trackItems: [
          {
            id: currentActiveId,
            details: updatedDetails,
          },
        ],
      },
    });
  } catch (err) {
    console.warn("EDIT_OBJECT ignorado:", err);
  }

  // 3. Atualiza Moveable e força o Remotion a redesenhar o frame
  if (state.sceneMoveableRef?.current?.moveable) {
    state.sceneMoveableRef.current.moveable.updateRect();
  }

  if (state.playerRef?.current) {
    const currentFrame = state.playerRef.current.getCurrentFrame();
    state.playerRef.current.seekTo(currentFrame);
  }
}

// Cria e injeta o elemento no DOM
function createToolbarDOM() {
  const existing = document.getElementById("floating-font-toolbar");
  if (existing) return existing;

  const el = document.createElement("div");
  el.id = "floating-font-toolbar";
  el.style.position = "fixed";
  el.style.display = "none";
  el.style.backgroundColor = "#ffffff";
  el.style.borderRadius = "10px";
  el.style.padding = "12px";
  el.style.boxShadow = "0 12px 32px rgba(0,0,0,0.35)";
  el.style.zIndex = "99999999";
  el.style.width = "250px";
  el.style.boxSizing = "border-box";
  el.style.flexDirection = "column";
  el.style.gap = "10px";
  el.style.fontFamily = "sans-serif";
  el.style.color = "#18181b";
  el.style.userSelect = "none";
  el.style.pointerEvents = "auto";

  el.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 14px; font-weight: 700; color: #18181b;">Fonte</span>
      <button type="button" id="font-close-btn" style="background: transparent; border: none; cursor: pointer; font-size: 14px; color: #71717a;">✕</button>
    </div>

    <select id="font-family-select" style="width: 100%; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #e4e4e7; background: #fff; font-size: 13px; color: #18181b; outline: none; cursor: pointer;">
      <option value="Poppins">Poppins</option>
      <option value="Roboto">Roboto</option>
      <option value="Impact">Impact</option>
      <option value="Arial">Arial</option>
      <option value="Montserrat">Montserrat</option>
      <option value="Inter">Inter</option>
    </select>

    <div style="display: flex; gap: 8px; width: 100%;">
      <select id="font-weight-select" style="flex: 1; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #e4e4e7; background: #fff; font-size: 13px; color: #18181b; outline: none; cursor: pointer;">
        <option value="normal">Normal</option>
        <option value="600">Médio</option>
        <option value="bold">Negrito</option>
        <option value="900">Extra Negrito</option>
      </select>

      <select id="font-size-select" style="width: 80px; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #e4e4e7; background: #fff; font-size: 13px; color: #18181b; outline: none; cursor: pointer;">
        <option value="24">24</option>
        <option value="32">32</option>
        <option value="40">40</option>
        <option value="48">48</option>
        <option value="54">54</option>
        <option value="60">60</option>
        <option value="72">72</option>
        <option value="84">84</option>
        <option value="96">96</option>
        <option value="110">110</option>
        <option value="130">130</option>
      </select>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
      <div style="display: flex; gap: 3px;">
        <button type="button" data-align="left" class="btn-align" style="background: #fff; border: 1.5px solid #e4e4e7; border-radius: 6px; padding: 5px 7px; cursor: pointer; font-size: 12px;" title="Esquerda">≡</button>
        <button type="button" data-align="center" class="btn-align" style="background: #fff; border: 1.5px solid #e4e4e7; border-radius: 6px; padding: 5px 7px; cursor: pointer; font-size: 12px;" title="Centralizado">≣</button>
        <button type="button" data-align="right" class="btn-align" style="background: #fff; border: 1.5px solid #e4e4e7; border-radius: 6px; padding: 5px 7px; cursor: pointer; font-size: 12px;" title="Direita">≡</button>
      </div>

      <div style="display: flex; gap: 6px;">
        <button type="button" id="btn-toggle-bold" style="background: #fff; border: 1.5px solid #e4e4e7; border-radius: 6px; width: 32px; height: 30px; cursor: pointer; font-weight: 900; font-size: 14px; color: #18181b;" title="Negrito">B</button>
        <button type="button" id="btn-toggle-italic" style="background: #fff; border: 1.5px solid #e4e4e7; border-radius: 6px; width: 32px; height: 30px; cursor: pointer; font-style: italic; font-size: 14px; color: #18181b;" title="Itálico">I</button>
      </div>
    </div>
  `;

  el.addEventListener("mousedown", (e) => e.stopPropagation());
  el.addEventListener("click", (e) => e.stopPropagation());

  el.querySelector("#font-close-btn")?.addEventListener("click", () => {
    el.style.display = "none";
  });

  el.querySelector("#font-family-select")?.addEventListener("change", (e) => {
    updateCaptionStyle({ fontFamily: e.target.value });
  });

  el.querySelector("#font-weight-select")?.addEventListener("change", (e) => {
    updateCaptionStyle({ fontWeight: e.target.value });
  });

  el.querySelector("#font-size-select")?.addEventListener("change", (e) => {
    updateCaptionStyle({ fontSize: Number(e.target.value) });
  });

  el.querySelectorAll(".btn-align").forEach((btn) => {
    btn.addEventListener("click", () => {
      const align = btn.getAttribute("data-align");
      updateCaptionStyle({ textAlign: align });
      syncToolbarValues();
    });
  });

  el.querySelector("#btn-toggle-bold")?.addEventListener("click", () => {
    const state = useStore.getState();
    const item = state.trackItemsMap[currentActiveId];
    const weight = item?.details?.fontWeight;
    const isBold = weight === "bold" || weight === "900";
    updateCaptionStyle({ fontWeight: isBold ? "normal" : "bold" });
    syncToolbarValues();
  });

  el.querySelector("#btn-toggle-italic")?.addEventListener("click", () => {
    const state = useStore.getState();
    const item = state.trackItemsMap[currentActiveId];
    const isItalic = item?.details?.fontStyle === "italic";
    updateCaptionStyle({ fontStyle: isItalic ? "normal" : "italic" });
    syncToolbarValues();
  });

  document.body.appendChild(el);
  return el;
}

// Sincroniza os selects e botões com os valores da legenda selecionada
function syncToolbarValues() {
  if (!fontToolbarElement || !currentActiveId) return;
  const state = useStore.getState();
  const item = state.trackItemsMap[currentActiveId];
  if (!item) return;

  const d = item.details || {};
  const familySelect = fontToolbarElement.querySelector("#font-family-select");
  const weightSelect = fontToolbarElement.querySelector("#font-weight-select");
  const sizeSelect = fontToolbarElement.querySelector("#font-size-select");
  const btnBold = fontToolbarElement.querySelector("#btn-toggle-bold");
  const btnItalic = fontToolbarElement.querySelector("#btn-toggle-italic");
  const alignBtns = fontToolbarElement.querySelectorAll(".btn-align");

  if (familySelect) familySelect.value = d.fontFamily || "Poppins";
  if (weightSelect) weightSelect.value = d.fontWeight || "bold";
  if (sizeSelect) sizeSelect.value = String(d.fontSize || 54);

  if (btnBold) {
    const isBold = d.fontWeight === "bold" || d.fontWeight === "900";
    btnBold.style.background = isBold ? "#e4e4e7" : "#fff";
  }

  if (btnItalic) {
    btnItalic.style.background = d.fontStyle === "italic" ? "#e4e4e7" : "#fff";
  }

  alignBtns.forEach((b) => {
    const a = b.getAttribute("data-align");
    b.style.background = (d.textAlign || "center") === a ? "#f4f4f5" : "#fff";
  });
}

// Reposiciona o menu sobre a legenda de forma segura
function updatePosition() {
  if (!fontToolbarElement) return;

  const targetEl = currentActiveId
    ? document.querySelector(`.id-${currentActiveId}`) || document.querySelector(`.designcombo-scene-item.id-${currentActiveId}`)
    : null;

  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const top = Math.max(70, rect.top - 210);
      const left = rect.left + rect.width / 2;
      fontToolbarElement.style.top = `${top}px`;
      fontToolbarElement.style.left = `${left}px`;
      fontToolbarElement.style.transform = "translateX(-50%)";
      return;
    }
  }

  // Posição padrão visível no centro superior se a busca falhar
  fontToolbarElement.style.top = "100px";
  fontToolbarElement.style.left = "50%";
  fontToolbarElement.style.transform = "translateX(-50%)";
}

// Inicializador
export function initFontToolbar() {
  fontToolbarElement = createToolbarDOM();

  // Escuta o disparo do botão lápis
  window.addEventListener("TOGGLE_FONT_TOOLBAR", (e) => {
    const state = useStore.getState();
    const activeId = e.detail?.id || (state.activeIds && state.activeIds.length > 0 ? state.activeIds[0] : null);

    if (activeId) {
      currentActiveId = activeId;
    }

    if (fontToolbarElement.style.display === "flex") {
      fontToolbarElement.style.display = "none";
    } else {
      syncToolbarValues();
      updatePosition();
      fontToolbarElement.style.display = "flex";
    }
  });

  window.addEventListener("resize", () => {
    if (fontToolbarElement && fontToolbarElement.style.display === "flex") {
      updatePosition();
    }
  });
}