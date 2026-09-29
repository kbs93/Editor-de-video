import { dispatch } from "@designcombo/events";
import { ADD_TEXT } from "@designcombo/state";
import { nanoid } from "nanoid";
import useStore, { SECONDARY_FONT } from "./editor-store.js";

// ==========================================
// 1. DIVISÃO EM BLOCOS DE 3 PALAVRAS COM BASE NO INTERVALO REAL
// ==========================================
export function buildTimedSegments(rawText, fromMs, toMs) {
  const words = String(rawText || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  const segments = [];
  const wordsPerSegment = 3;

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    segments.push(words.slice(i, i + wordsPerSegment));
  }

  const duration = Math.max(toMs - fromMs, 1000);
  const timePerSegment = duration / segments.length;

  return segments.map((chunk, segIndex) => {
    const segStart = Math.round(fromMs + segIndex * timePerSegment);
    const segEnd = Math.round(fromMs + (segIndex + 1) * timePerSegment);
    const wordDuration = (segEnd - segStart) / chunk.length;

    const timedWords = chunk.map((w, wIndex) => ({
      word: w.toUpperCase(),
      start: Math.round(segStart + wIndex * wordDuration),
      end: Math.round(segStart + (wIndex + 1) * wordDuration),
    }));

    return {
      start: segStart,
      end: segEnd,
      words: timedWords,
    };
  });
}

// ==========================================
// 2. CONFIGURAÇÕES E ESTADO DO OVERLAY
// ==========================================
let activeCaptionId = null;
let rawCaptionText = "";
let animFrameId = null;
let captionOverlayElement = null;
let lastInputText = "";

let captionConfig = {
  activeColor: "#38bdf8",
  textColor: "#ffffff",
  bgColor: "#000000",
  hasBg: true,
  fontSize: 54,
  left: 50,
  top: 72,
};

function ensureOverlayElement() {
  if (captionOverlayElement && document.body.contains(captionOverlayElement)) {
    return captionOverlayElement;
  }

  const screenContainer =
    document.querySelector(".__remotion-player") ||
    document.querySelector("#designcombo-scene-item") ||
    document.querySelector(".scene-container") ||
    document.querySelector("div[style*='position: relative'] > div") ||
    document.body;

  let el = document.getElementById("dynamic-caption-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "dynamic-caption-overlay";
    el.style.position = "absolute";
    el.style.left = `${captionConfig.left}%`;
    el.style.top = `${captionConfig.top}%`;
    el.style.transform = "translate(-50%, -50%)";
    el.style.zIndex = "99999";
    el.style.cursor = "move";
    el.style.userSelect = "none";
    el.style.display = "flex";
    el.style.justifyContent = "center";
    el.style.alignItems = "center";
    el.style.border = "1.5px dashed rgba(56, 189, 248, 0.8)";
    el.style.borderRadius = "12px";
    el.style.padding = "4px";
    el.style.boxSizing = "border-box";
    el.title = "Arraste pelo centro ou use os pontos nos cantos para redimensionar";

    // Alças de redimensionamento nos 4 cantos
    const handles = ["nw", "ne", "sw", "se"];
    handles.forEach((pos) => {
      const handle = document.createElement("div");
      handle.className = `caption-resize-handle handle-${pos}`;
      handle.style.position = "absolute";
      handle.style.width = "10px";
      handle.style.height = "10px";
      handle.style.backgroundColor = "#ffffff";
      handle.style.border = "2px solid #38bdf8";
      handle.style.borderRadius = "2px";
      handle.style.boxShadow = "0 1px 4px rgba(0,0,0,0.5)";
      handle.style.zIndex = "100000";

      if (pos.includes("n")) handle.style.top = "-6px";
      if (pos.includes("s")) handle.style.bottom = "-6px";
      if (pos.includes("w")) handle.style.left = "-6px";
      if (pos.includes("e")) handle.style.right = "-6px";

      handle.style.cursor = pos === "nw" || pos === "se" ? "nwse-resize" : "nesw-resize";

      handle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const startFontSize = captionConfig.fontSize;

        function onResizeMove(moveEvent) {
          const dx = moveEvent.clientX - startX;
          const factor = pos.includes("e") ? dx : -dx;
          const newSize = Math.max(24, Math.min(120, startFontSize + factor * 0.4));
          captionConfig.fontSize = Math.round(newSize);

          const fontInput = document.querySelector("#picker-font-size");
          if (fontInput) fontInput.value = captionConfig.fontSize;
        }

        function onResizeUp() {
          window.removeEventListener("mousemove", onResizeMove);
          window.removeEventListener("mouseup", onResizeUp);
        }

        window.addEventListener("mousemove", onResizeMove);
        window.addEventListener("mouseup", onResizeUp);
      });

      el.appendChild(handle);
    });

    // Deslocar a legenda pelo ecrã
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    el.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("caption-resize-handle")) return;

      e.stopPropagation();
      e.preventDefault();

      isDragging = true;
      el.style.cursor = "grabbing";
      startX = e.clientX;
      startY = e.clientY;

      const parentRect = el.parentElement.getBoundingClientRect();
      const rect = el.getBoundingClientRect();

      initialLeft = rect.left - parentRect.left + rect.width / 2;
      initialTop = rect.top - parentRect.top + rect.height / 2;

      function onMouseMove(moveEvent) {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        captionConfig.left = ((initialLeft + dx) / parentRect.width) * 100;
        captionConfig.top = ((initialTop + dy) / parentRect.height) * 100;

        el.style.left = `${captionConfig.left}%`;
        el.style.top = `${captionConfig.top}%`;
      }

      function onMouseUp() {
        isDragging = false;
        el.style.cursor = "move";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      }

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    screenContainer.appendChild(el);
  }

  captionOverlayElement = el;
  return captionOverlayElement;
}

// ==========================================
// 3. MOTOR DE SINCRONIZAÇÃO RIGOROSO COM A LINHA DO TEMPO
// ==========================================
function startCaptionLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  function update() {
    const overlay = ensureOverlayElement();
    const state = useStore.getState();
    const playerRef = state.playerRef?.current;

    // Obtém o item da legenda a partir do estado para saber a posição exata da barra
    const captionItem = activeCaptionId ? state.trackItemsMap?.[activeCaptionId] : null;

    if (captionItem && captionItem.display && rawCaptionText) {
      const currentFrame = playerRef?.getCurrentFrame ? playerRef.getCurrentFrame() : 0;
      const fps = state.fps || 30;
      const currentTimeMs = (currentFrame / fps) * 1000;

      const fromMs = captionItem.display.from;
      const toMs = captionItem.display.to;

      // SÓ ENTRA SE A BARRA ESTIVER EXATAMENTE SOBRE O BLOCO DA LEGENDA
      if (currentTimeMs >= fromMs && currentTimeMs < toMs) {
        const segments = buildTimedSegments(rawCaptionText, fromMs, toMs);

        let currentSegment = segments.find(
          (seg) => currentTimeMs >= seg.start && currentTimeMs < seg.end
        );

        if (currentSegment) {
          overlay.style.display = "flex";

          const bg = captionConfig.hasBg ? captionConfig.bgColor : "transparent";
          const border = captionConfig.hasBg ? "2px solid rgba(255, 255, 255, 0.2)" : "none";
          const shadow = captionConfig.hasBg ? "0 10px 35px rgba(0,0,0,0.85)" : "none";

          const wordsHtml = currentSegment.words
            .map((w) => {
              const isWordActive = currentTimeMs >= w.start && currentTimeMs < w.end;
              const color = isWordActive ? captionConfig.activeColor : captionConfig.textColor;
              const scale = isWordActive ? "scale(1.15)" : "scale(1)";
              const textShadow = isWordActive
                ? `0 0 20px ${captionConfig.activeColor}, 3px 3px 0 #000`
                : "3px 3px 0 #000";

              return `
                <span style="
                  font-family: Impact, sans-serif;
                  font-size: ${captionConfig.fontSize}px;
                  font-weight: 900;
                  letter-spacing: 2px;
                  text-transform: uppercase;
                  color: ${color};
                  transform: ${scale};
                  transition: transform 0.05s ease, color 0.05s ease;
                  text-shadow: ${textShadow};
                  display: inline-block;
                  pointer-events: none;
                ">${w.word}</span>
              `;
            })
            .join("");

          overlay.innerHTML = `
            <div style="
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              align-items: center;
              gap: 14px;
              padding: 12px 28px;
              background-color: ${bg};
              border-radius: 16px;
              border: ${border};
              box-shadow: ${shadow};
            ">
              ${wordsHtml}
            </div>
          `;
        } else {
          overlay.innerHTML = "";
          overlay.style.display = "none";
        }
      } else {
        // Se a barra estiver antes ou depois da legenda, limpa e esconde
        overlay.innerHTML = "";
        overlay.style.display = "none";
      }
    } else {
      overlay.innerHTML = "";
      overlay.style.display = "none";
    }

    animFrameId = requestAnimationFrame(update);
  }

  animFrameId = requestAnimationFrame(update);
}

// ==========================================
// 4. PAINEL DE CONTROLO
// ==========================================
export function openCaptionModal(container, onClose) {
  if (!container) return;

  container.innerHTML = `
    <div style="width: 320px; padding: 16px; display: flex; flex-direction: column; height: 100%; border-left: 1px solid rgba(255,255,255,0.1); background-color: #161618; box-sizing: border-box;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #27272a; flex-shrink: 0;">
        <span style="font-size: 14px; font-weight: 600; color: #f4f4f5; font-family: sans-serif;">Criar Legenda Dinâmica</span>
        <button type="button" id="btn-caption-close" style="background: transparent; border: none; color: #a1a1aa; font-size: 16px; cursor: pointer; border-radius: 4px;" title="Fechar">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0;">
        <label style="font-size: 12px; color: #d4d4d8; font-weight: 500; font-family: sans-serif; flex-shrink: 0;">
          Texto falado no vídeo:
        </label>
        <textarea id="caption-input-text" placeholder="Cole aqui o texto falado..." style="width: 100%; flex: 1; min-height: 120px; background-color: #18181b; border: 1px solid #3f3f46; border-radius: 12px; padding: 12px; font-size: 13px; color: #f4f4f5; outline: none; resize: none; font-family: sans-serif; box-sizing: border-box; line-height: 1.5;">${lastInputText}</textarea>

        <div style="background: #1e1e22; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; border: 1px solid #2d2d32; flex-shrink: 0;">
          <span style="font-size: 11px; font-weight: 600; color: #a1a1aa; text-transform: uppercase;">Aparência da Legenda</span>
          
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 12px; color: #e4e4e7; font-family: sans-serif;">Destaque (Palavra ativa):</label>
            <input type="color" id="picker-active-color" value="${captionConfig.activeColor}" style="cursor: pointer; background: transparent; border: none; width: 32px; height: 32px;" />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 12px; color: #e4e4e7; font-family: sans-serif;">Texto normal:</label>
            <input type="color" id="picker-text-color" value="${captionConfig.textColor}" style="cursor: pointer; background: transparent; border: none; width: 32px; height: 32px;" />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 12px; color: #e4e4e7; font-family: sans-serif;">Cor do Fundo:</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="color" id="picker-bg-color" value="${captionConfig.bgColor}" ${!captionConfig.hasBg ? "disabled" : ""} style="cursor: pointer; background: transparent; border: none; width: 32px; height: 32px; opacity: ${captionConfig.hasBg ? '1' : '0.4'};" />
              <label style="font-size: 11px; color: #a1a1aa; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input type="checkbox" id="check-no-bg" ${!captionConfig.hasBg ? "checked" : ""} style="accent-color: #8b5cf6;" />
                Sem Fundo
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 12px; color: #e4e4e7; font-family: sans-serif;">Tamanho da Fonte:</label>
            <input type="range" id="picker-font-size" min="30" max="80" value="${captionConfig.fontSize}" style="width: 100px; accent-color: #8b5cf6;" />
          </div>
        </div>

        <button type="button" id="btn-caption-submit" style="width: 100%; background-color: #7c3aed; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px; border-radius: 12px; cursor: pointer; border: none; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); flex-shrink: 0;">✨ Aplicar Legenda no Vídeo</button>
        <span id="caption-feedback" style="font-size: 11px; color: #4ade80; text-align: center; display: none; font-weight: 500; flex-shrink: 0;">Legenda ativa! Só será visível quando a barra passar sobre o bloco.</span>
      </div>
    </div>
  `;

  const btnClose = container.querySelector("#btn-caption-close");
  const btnSubmit = container.querySelector("#btn-caption-submit");
  const textarea = container.querySelector("#caption-input-text");
  const feedback = container.querySelector("#caption-feedback");

  const pickerActive = container.querySelector("#picker-active-color");
  const pickerText = container.querySelector("#picker-text-color");
  const pickerBg = container.querySelector("#picker-bg-color");
  const checkNoBg = container.querySelector("#check-no-bg");
  const pickerFont = container.querySelector("#picker-font-size");

  pickerActive?.addEventListener("input", (e) => {
    captionConfig.activeColor = e.target.value;
  });
  pickerText?.addEventListener("input", (e) => {
    captionConfig.textColor = e.target.value;
  });
  pickerBg?.addEventListener("input", (e) => {
    captionConfig.bgColor = e.target.value;
  });
  checkNoBg?.addEventListener("change", (e) => {
    captionConfig.hasBg = !e.target.checked;
    if (pickerBg) {
      pickerBg.style.opacity = captionConfig.hasBg ? "1" : "0.4";
      pickerBg.disabled = !captionConfig.hasBg;
    }
  });
  pickerFont?.addEventListener("input", (e) => {
    captionConfig.fontSize = Number(e.target.value);
  });
  textarea?.addEventListener("input", (e) => {
    lastInputText = e.target.value;
  });

  btnClose?.addEventListener("click", () => {
    if (typeof onClose === "function") onClose();
  });

  btnSubmit?.addEventListener("click", () => {
    const rawText = textarea.value.trim();
    if (!rawText) return;

    lastInputText = rawText;
    rawCaptionText = rawText;

    const state = useStore.getState();
    const { duration, trackItemsMap, trackItemIds } = state;

    const firstVideoId = trackItemIds?.find(
      (id) => trackItemsMap[id]?.type === "video"
    );
    const videoItem = firstVideoId ? trackItemsMap[firstVideoId] : null;

    const totalDurationMs = videoItem?.display
      ? videoItem.display.to - videoItem.display.from
      : duration && duration > 0
      ? duration
      : 6000;

    const captionId = nanoid();
    activeCaptionId = captionId;

    // Adiciona o bloco na linha do tempo
    const payload = {
      id: captionId,
      type: "caption",
      name: "Legenda Dinâmica",
      display: {
        from: 0,
        to: totalDurationMs,
      },
      details: {
        text: rawText,
      },
    };
    dispatch(ADD_TEXT, { payload });

    // Inicia o motor de verificação de tempo
    startCaptionLoop();

    if (feedback) {
      feedback.style.display = "block";
      setTimeout(() => {
        feedback.style.display = "none";
      }, 3500);
    }
  });
}