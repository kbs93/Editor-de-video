import { dispatch } from "@designcombo/events";
import { ADD_TEXT } from "@designcombo/state";
import { nanoid } from "nanoid";
import useStore, { SECONDARY_FONT } from "./editor-store.js";

// ==========================================
// 1. DIVISÃO EM BLOCOS (FALLBACK E WHISPER REAL)
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
    const segStart = Math.round(segIndex * timePerSegment);
    const segEnd = Math.round((segIndex + 1) * timePerSegment);
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

export function groupWhisperWordsIntoSegments(whisperWords, maxWordsPerSegment = 3) {
  if (!whisperWords || whisperWords.length === 0) return [];

  const segments = [];
  for (let i = 0; i < whisperWords.length; i += maxWordsPerSegment) {
    const chunk = whisperWords.slice(i, i + maxWordsPerSegment);
    const segStart = chunk[0].start;
    const segEnd = chunk[chunk.length - 1].end;

    segments.push({
      start: segStart,
      end: segEnd,
      words: chunk,
    });
  }
  return segments;
}
export function reconcileSegmentsWithText(rawText, baseSegments, totalFromMs, totalToMs) {
  const userWords = String(rawText || "").trim().split(/\s+/).filter(Boolean);
  if (userWords.length === 0) return [];
  if (!baseSegments || baseSegments.length === 0) {
    return buildTimedSegments(rawText, totalFromMs, totalToMs);
  }

  let userWordIndex = 0;
  const updatedSegments = [];

// Achata todas as palavras temporizadas da IA para servir de âncora de tempo pura
  const timeAnchors = [];
  for (const seg of baseSegments) {
    if (Array.isArray(seg.words)) {
      for (const w of seg.words) {
        timeAnchors.push({ start: w.start, end: w.end });
      }
    }
  }


const wordsPerSegment = 3;
  const totalUserWords = userWords.length;
  const totalAnchors = timeAnchors.length;
  const latencyOffsetMs = 80;




for (let i = 0; i < totalUserWords; i += wordsPerSegment) {
    const chunk = userWords.slice(i, i + wordsPerSegment);

    let segStart, segEnd;

    if (totalAnchors > 0) {
      const startAnchorIdx = Math.min(
        totalAnchors - 1,
        Math.floor((i / totalUserWords) * totalAnchors)
      );
      const endAnchorIdx = Math.min(
        totalAnchors - 1,
        Math.max(startAnchorIdx, Math.floor(((i + chunk.length) / totalUserWords) * totalAnchors) - 1)
      );

      // Garante que o bloco começa no início exato da primeira palavra daquele bloco
      segStart = Math.max(totalFromMs, timeAnchors[startAnchorIdx].start);
      segEnd = Math.max(segStart + chunk.length * 250, timeAnchors[endAnchorIdx].end);
    } else {
      const duration = Math.max(totalToMs - totalFromMs, 1000);
      segStart = Math.round(totalFromMs + (i / totalUserWords) * duration);
      segEnd = Math.round(totalFromMs + ((i + chunk.length) / totalUserWords) * duration);
    }

    const chunkDuration = Math.max(segEnd - segStart, chunk.length * 200);
    const wordDuration = Math.round(chunkDuration / chunk.length);

    const timedWords = chunk.map((word, idx) => {
      const globalIdx = i + idx;
      let wStart, wEnd;

      // Se temos as âncoras reais de som para cada palavra específica, respeita o carimbo individual
      if (totalAnchors > 0 && globalIdx < totalAnchors) {
        wStart = Math.max(totalFromMs, timeAnchors[globalIdx].start);
        wEnd = Math.max(wStart + 150, timeAnchors[globalIdx].end);
      } else {
        wStart = segStart + idx * wordDuration;
        wEnd = idx === chunk.length - 1 ? segEnd : segStart + (idx + 1) * wordDuration;
      }

      return {
        word: String(word).toUpperCase(),
        start: wStart,
        end: wEnd,
      };
    });

    // O bloco pai se ajusta do início da primeira palavra até o fim da última
    updatedSegments.push({
      start: timedWords[0].start,
      end: timedWords[timedWords.length - 1].end,
      words: timedWords,
    });
  }














  userWordIndex = totalUserWords;

  if (userWordIndex < userWords.length) {
    const remainingWords = userWords.slice(userWordIndex);
    const lastSegEnd = updatedSegments.length > 0 ? updatedSegments[updatedSegments.length - 1].end : totalFromMs;
    const remainingDuration = Math.max(totalToMs - lastSegEnd, remainingWords.length * 300);
    const additionalSegments = buildTimedSegments(remainingWords.join(" "), lastSegEnd, lastSegEnd + remainingDuration);
    updatedSegments.push(...additionalSegments);
  }

  return updatedSegments;
}





// ==========================================
// 2. EXTRAÇÃO E CONVERSÃO DE ÁUDIO NO BROWSER
// ==========================================
function audioBufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);          // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: "audio/wav" });
}
async function extractAudioBlobFromUrl(mediaUrl) {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Falha ao obter mídia (${response.statusText})`);
  }
  return await response.blob();
}

// ==========================================
// 3. ESTADO E CONTROLOS DO OVERLAY
// ==========================================
let activeCaptionId = null;
let rawCaptionText = "";
let customWhisperSegments = null;
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
// 4. MOTOR DE SINCRONIZAÇÃO
// ==========================================
function startCaptionLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  function update() {
    const overlay = ensureOverlayElement();
    const state = useStore.getState();
    const playerRef = state.playerRef?.current;

    const captionItem = activeCaptionId ? state.trackItemsMap?.[activeCaptionId] : null;

    if (captionItem && captionItem.display && rawCaptionText) {
      const currentFrame = playerRef?.getCurrentFrame ? playerRef.getCurrentFrame() : 0;
      const fps = state.fps || 30;
      const currentTimeMs = (currentFrame / fps) * 1000;

      const fromMs = captionItem.display.from;
      const toMs = captionItem.display.to;

      if (currentTimeMs >= fromMs && currentTimeMs < toMs) {
        const segments =
          captionItem.details?.segments ||
          customWhisperSegments ||
          buildTimedSegments(rawCaptionText, fromMs, toMs);

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
              const scale = isWordActive ? "scale(1.12)" : "scale(1)";
              const textShadow = isWordActive
                ? `0 0 18px ${captionConfig.activeColor}, 3px 3px 0 #000`
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
                  margin: 0 8px;
                  white-space: nowrap;
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
// 5. PAINEL LATERAL COM BOTÃO WHISPER
// ==========================================
// ==========================================
// 5. PAINEL GAVETA SOBREPOSTA (DRAWER COMPLETO)
// ==========================================
export function openCaptionModal(container, onClose) {
  if (!container) return;

  container.innerHTML = `
    <div style="width: 100%; height: 100%; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background-color: #141416; gap: 10px; overflow: hidden;">
      
      <!-- Topo: Título e Botão Fechar -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #27272a; flex-shrink: 0;">
        <span style="font-size: 13px; font-weight: 700; color: #f4f4f5; font-family: sans-serif;">Criar Legenda Dinâmica</span>
        <button type="button" id="btn-caption-close" style="background: transparent; border: none; color: #71717a; font-size: 15px; cursor: pointer; border-radius: 4px; padding: 2px 6px;" title="Fechar">✕</button>
      </div>

      <!-- Botão Transcrição IA -->
      <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
        <button 
          type="button" 
          id="btn-ai-transcribe" 
          style="width: 100%; background: #1e1e22; border: 1.5px solid #38bdf8; color: #38bdf8; font-weight: 600; font-size: 12px; padding: 9px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;"
        >
          Transcrever o Vídeo (IA)
        </button>
        <span id="transcribe-status" style="font-size: 11px; color: #a1a1aa; text-align: center; display: none; line-height: 1.2;">Aguarde...</span>
      </div>

      <!-- Caixa de Texto Esticada Verticalmente -->
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-height: 0;">
        <label style="font-size: 11px; color: #a1a1aa; font-weight: 500; font-family: sans-serif; flex-shrink: 0;">
          Texto falado no vídeo:
        </label>
        <textarea id="caption-input-text" placeholder="Cole aqui ou clique no botão acima para transcrever..." style="width: 100%; flex: 1; height: 100%; background-color: #18181b; border: 1.5px solid #27272a; border-radius: 8px; padding: 10px; font-size: 12px; color: #f4f4f5; outline: none; resize: none; font-family: sans-serif; box-sizing: border-box; line-height: 1.45; scrollbar-width: thin; scrollbar-color: #52525b transparent;">${lastInputText}</textarea>
      </div>

      <!-- Bloco de Aparência da Legenda -->
      <div style="background: #18181b; padding: 10px 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 8px; border: 1px solid #27272a; flex-shrink: 0;">
        <span style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">APARÊNCIA DA LEGENDA</span>
        
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">(Palavra Ativa):</label>
          <input type="color" id="picker-active-color" value="${captionConfig.activeColor}" style="cursor: pointer; background: transparent; border: none; width: 28px; height: 28px;" />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">Texto normal:</label>
          <input type="color" id="picker-text-color" value="${captionConfig.textColor}" style="cursor: pointer; background: transparent; border: none; width: 28px; height: 28px;" />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">Cor do Fundo:</label>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="color" id="picker-bg-color" value="${captionConfig.bgColor}" ${!captionConfig.hasBg ? "disabled" : ""} style="cursor: pointer; background: transparent; border: none; width: 28px; height: 28px; opacity: ${captionConfig.hasBg ? '1' : '0.4'};" />
            <label style="font-size: 10px; color: #a1a1aa; display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="check-no-bg" ${!captionConfig.hasBg ? "checked" : ""} style="accent-color: #8b5cf6;" />
              Sem Fundo
            </label>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">Tamanho da Fonte:</label>
          <input type="range" id="picker-font-size" min="30" max="80" value="${captionConfig.fontSize}" style="width: 85px; accent-color: #8b5cf6; cursor: pointer;" />
        </div>
      </div>

      <!-- Base: Botão Aplicar -->
      <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
        <button type="button" id="btn-caption-submit" style="width: 100%; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; font-weight: 700; font-size: 13px; padding: 11px; border-radius: 8px; cursor: pointer; border: none; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); transition: transform 0.1s ease;">
        Aplicar Legenda no Vídeo</button>
        <span id="caption-feedback" style="font-size: 11px; color: #4ade80; text-align: center; display: none; font-weight: 500;">Legenda aplicada com sucesso!</span>
      </div>
    </div>
  `;

  const btnClose = container.querySelector("#btn-caption-close");
  const btnSubmit = container.querySelector("#btn-caption-submit");
  const btnAi = container.querySelector("#btn-ai-transcribe");
  const transcribeStatus = container.querySelector("#transcribe-status");
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

  // Impede que o editor/canvas roube o foco, o cursor e as teclas digitadas
  textarea?.addEventListener("keydown", (e) => {
    e.stopPropagation();
  });
  textarea?.addEventListener("keyup", (e) => {
    e.stopPropagation();
  });
  textarea?.addEventListener("keypress", (e) => {
    e.stopPropagation();
  });
  textarea?.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  textarea?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  btnClose?.addEventListener("click", () => {
    if (typeof onClose === "function") onClose();
  });

  // AÇÃO DO BOTÃO WHISPER: INJETA O TEXTO NO CAMPO
  btnAi?.addEventListener("click", async () => {
    const state = useStore.getState();
    const activeVideoId = state.trackItemIds?.find(
      (id) => state.trackItemsMap[id]?.type === "video" || state.trackItemsMap[id]?.type === "audio"
    );
    const mediaItem = activeVideoId ? state.trackItemsMap[activeVideoId] : null;

    if (!mediaItem || !mediaItem.details?.src) {
      alert("Por favor, adicione um vídeo ou áudio à timeline antes de transcrever!");
      return;
    }

    try {
      btnAi.disabled = true;
      btnAi.style.opacity = "0.7";
      btnAi.style.cursor = "wait";
      btnAi.style.backgroundColor = "#1e293b";
      btnAi.innerText = "⏳ Extraindo áudio...";

      if (transcribeStatus) {
        transcribeStatus.style.display = "block";
        transcribeStatus.style.color = "#38bdf8";
        transcribeStatus.innerText = "Processando com o Whisper... aguarde.";
      }

      const mediaBlob = await extractAudioBlobFromUrl(mediaItem.details.src);

      btnAi.innerText = "⏳ Transcrevendo...";

      const formData = new FormData();
      formData.append("audio", mediaBlob, "media.mp4");

      const response = await fetch("http://localhost:3001/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro do servidor Node: ${response.status}`);
      }

      const data = await response.json();

      const activeTextarea = document.querySelector("#caption-input-text") || container.querySelector("#caption-input-text");
      if (activeTextarea) {
        activeTextarea.value = data.text;
        activeTextarea.focus();
        activeTextarea.dispatchEvent(new Event("input", { bubbles: true }));
        activeTextarea.dispatchEvent(new Event("change", { bubbles: true }));
      }

      lastInputText = data.text;
      rawCaptionText = data.text;
      customWhisperSegments = groupWhisperWordsIntoSegments(data.words, 3);

      btnAi.innerText = " Transcrição Concluída!";
      if (transcribeStatus) {
        transcribeStatus.style.color = "#4ade80";
        transcribeStatus.innerText = "Texto inserido abaixo! Faça suas correções e clique em Aplicar.";
      }
    } catch (err) {
      console.error("Falha detalhada ao transcrever:", err);
      btnAi.innerText = "❌ Erro na Transcrição";
      if (transcribeStatus) {
        transcribeStatus.style.color = "#ef4444";
        transcribeStatus.innerText = "Erro ao transcrever. Verifique se o servidor está ativo na porta 3001.";
      }
    } finally {
      setTimeout(() => {
        btnAi.disabled = false;
        btnAi.style.opacity = "1";
        btnAi.style.cursor = "pointer";
        btnAi.style.backgroundColor = "#1e1e22";
        btnAi.innerText = "Transcrever o Vídeo (IA)";
      }, 3500);
    }
  });

  // AÇÃO DO BOTÃO APLICAR: ENVIA O TEXTO CORRIGIDO PELO UTILIZADOR
  btnSubmit?.addEventListener("click", () => {
    const targetTextarea = container.querySelector("#caption-input-text") || textarea;
    const rawText = (targetTextarea ? targetTextarea.value : "").trim();
    if (!rawText) return;

    lastInputText = rawText;
    rawCaptionText = rawText;

    const state = useStore.getState();
    const { duration, trackItemsMap, trackItemIds } = state;

    const firstVideoId = trackItemIds?.find(
      (id) => trackItemsMap[id]?.type === "video" || trackItemsMap[id]?.type === "audio"
    );
    const videoItem = firstVideoId ? trackItemsMap[firstVideoId] : null;

    const totalDurationMs = videoItem?.display
      ? videoItem.display.to - videoItem.display.from
      : duration && duration > 0
      ? duration
      : 6000;

    const captionId = nanoid();
    activeCaptionId = captionId;

    const videoStartMs = videoItem?.display?.from ?? 0;
    const videoEndMs = videoItem?.display?.to ?? totalDurationMs;
    const currentRate = videoItem?.playbackRate || videoItem?.details?.playbackRate || 1;

    const finalSegments = reconcileSegmentsWithText(
      rawText,
      customWhisperSegments,
      videoStartMs,
      videoEndMs
    );

    // Atualiza a memória ativa para o texto corrigido não ser sobrescrito pelo cache antigo
    customWhisperSegments = finalSegments;

    const payload = {
      id: captionId,
      type: "caption",
      name: "Legenda Dinâmica",
      playbackRate: currentRate,
      display: {
        from: videoStartMs,
        to: videoEndMs,
      },

      details: {
        text: rawText,
        playbackRate: currentRate,
        segments: finalSegments,
        activeColor: captionConfig.activeColor,
        textColor: captionConfig.textColor,
        backgroundColor: captionConfig.hasBg ? captionConfig.bgColor : "transparent",
        fontSize: captionConfig.fontSize,
      },
    };
// Atualiza a store global para o motor de legenda sem criar o bloco físico na timeline
    useStore.setState((prev) => ({
      trackItemsMap: {
        ...prev.trackItemsMap,
        [captionId]: payload,
      },
    }));

    startCaptionLoop();

    if (feedback) {
      feedback.style.display = "block";
      setTimeout(() => {
        feedback.style.display = "none";
      }, 3500);
    }
  });
}



