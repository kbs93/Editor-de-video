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
    word: String(w),
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

      if (totalAnchors > 0 && globalIdx < totalAnchors) {
        wStart = Math.max(totalFromMs, timeAnchors[globalIdx].start);
        wEnd = Math.max(wStart + 150, timeAnchors[globalIdx].end);
      } else {
        wStart = segStart + idx * wordDuration;
        wEnd = idx === chunk.length - 1 ? segEnd : segStart + (idx + 1) * wordDuration;
      }

      return {
      word: String(word),
        start: wStart,
        end: wEnd,
      };
    });

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

async function extractAudioBlobFromUrl(mediaUrl, trimFromMs = 0, trimToMs = null) {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Falha ao obter mídia (${response.statusText})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
  
  const sampleRate = decodedAudio.sampleRate;
  const startSec = Math.max(0, trimFromMs / 1000);
  const endSec = trimToMs ? Math.min(decodedAudio.duration, trimToMs / 1000) : decodedAudio.duration;
  
  const startOffset = Math.floor(startSec * sampleRate);
  const endOffset = Math.floor(endSec * sampleRate);
  const frameCount = Math.max(1, endOffset - startOffset);
  
  const trimmedBuffer = audioCtx.createBuffer(
    decodedAudio.numberOfChannels,
    frameCount,
    sampleRate
  );
  
  for (let channel = 0; channel < decodedAudio.numberOfChannels; channel++) {
    const channelData = decodedAudio.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      trimmedData[i] = channelData[startOffset + i];
    }
  }
  
  audioCtx.close();
  return audioBufferToWavBlob(trimmedBuffer);
}

// ==========================================
// 3. ESTADO E CONTROLOS
// ==========================================
let activeCaptionId = null;
let rawCaptionText = "";
let customWhisperSegments = null;
let animFrameId = null;
let captionOverlayElement = null;
let lastInputText = "";

// Fator de proporção para converter a escala do Clipchamp (pontos de interface) em pixels reais de tela cheia Full HD (1920x1080)
const FONT_SCALE_FACTOR = 2.5;
let captionConfig = {
  activeColor: "#38bdf8",
  textColor: "#ffffff",
  bgColor: "#000000",
  hasBg: true,
  fontFamily: "Poppins",
  fontWeight: "bold",
  displayFontSize: 24,
  fontSize: Math.round(24 * FONT_SCALE_FACTOR),
  fontStyle: "normal",
  textTransform: "uppercase", // "uppercase" ou "none"
  textAlign: "center",
  left: 50,
  top: 72,
};

function startCaptionLoop() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  const oldOverlay = document.getElementById("dynamic-caption-overlay");
  if (oldOverlay) {
    oldOverlay.remove();
  }
  captionOverlayElement = null;
}

// Sincroniza em tempo real com a legenda atualmente selecionada no player
function updateLiveCaption(propertyPatch) {
  const state = useStore.getState();
  const targetId = activeCaptionId || (state.activeIds && state.activeIds[0]);
  if (!targetId) return;

  const currentItem = state.trackItemsMap?.[targetId];
  if (!currentItem || currentItem.type !== "caption") return;

  const updatedDetails = {
    ...(currentItem.details || {}),
    ...propertyPatch,
  };

  useStore.setState((prev) => ({
    trackItemsMap: {
      ...prev.trackItemsMap,
      [targetId]: {
        ...currentItem,
        details: updatedDetails,
      },
    },
    trackItemDetailsMap: {
      ...prev.trackItemDetailsMap,
      [targetId]: updatedDetails,
    },
  }));

  if (state.playerRef?.current) {
    const currentFrame = state.playerRef.current.getCurrentFrame();
    state.playerRef.current.seekTo(currentFrame);
  }
}


// Carrega as fontes do Google Fonts para renderização visual idêntica ao Google Docs / Word
if (!document.getElementById("google-fonts-link")) {
  const link = document.createElement("link");
  link.id = "google-fonts-link";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Comfortaa:wght@700&family=Lobster&family=Montserrat:wght@700&family=Open+Sans:wght@600&family=Oswald:wght@700&family=Pacifico&family=Parisienne&family=Playfair+Display:ital,wght@0,700;1,700&family=Poiret+One&family=Poppins:wght@700&family=Roboto:wght@700&family=Roboto+Mono:wght@600&display=swap";
  document.head.appendChild(link);
}




// ==========================================
// 4. PAINEL GAVETA SOBREPOSTA COM NOVO DESIGN DE FONTE
// ==========================================
export function openCaptionModal(container, onClose) {
  if (!container) return;

  container.innerHTML = `
    <div style="width: 100%; height: 100%; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background-color: #141416; gap: 8px; overflow-y: auto; [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
      
      <!-- Botão Transcrição IA -->
      <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
        <button 
          type="button" 
          id="btn-ai-transcribe" 
          style="width: 100%; background: #1e1e22; border: 1.5px solid #38bdf8; color: #38bdf8; font-weight: 600; font-size: 12px; padding: 8px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;"
        >
         Criar Legenda Dinâmica
        </button>
        <span id="transcribe-status" style="font-size: 11px; color: #a1a1aa; text-align: center; display: none; line-height: 1.2;">Aguarde...</span>
      </div>

      <!-- Caixa de Texto Esticada Verticalmente -->
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-height: 90px;">




        <div style="display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <label style="font-size: 11px; color: #a1a1aa; font-weight: 500; font-family: sans-serif;">
            Texto falado no vídeo:
          </label>
          <button 
            type="button" 
            id="btn-caption-clear" 
            style="background: #982828; border-radius: 5px; color: #f0ebeb; font-size: 12px; cursor: pointer; padding: 2px 6px; font-weight: 600; border: none;" 
            title="Limpar texto"
          >
            Limpar
          </button>
        </div>
        <textarea id="caption-input-text" placeholder="Para criar uma legenda Basta clicar no botao Criar Legenda Dinâmica, o texto aparecer aqui" style="width: 100%; flex: 1; min-height: 80px; background-color: #18181b; border: 1.5px solid #27272a; border-radius: 8px; padding: 8px; font-size: 12px; color: #f4f4f5; outline: none; resize: none; font-family: sans-serif; box-sizing: border-box; line-height: 1.4; scrollbar-width: thin; scrollbar-color: #52525b transparent;">${lastInputText}</textarea>
      </div>

      <!-- Bloco de Aparência da Legenda (Fundo Preto com Controles de Fonte Incorporados) -->
      <div style="background: #09090b; padding: 10px; border-radius: 10px; display: flex; flex-direction: column; gap: 8px; border: 1.5px solid #27272a; flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">APARÊNCIA DA LEGENDA</span>
          <span style="font-size: 10px; color: #71717a;">Fonte & Cores</span>
        </div>

        <!-- Seletor de Família da Fonte -->
      <!-- Seletor de Família da Fonte Padrão Google Docs / Word com Preview Visual -->
        <select id="modal-font-family" style="width: 100%; padding: 7px 10px; border-radius: 6px; border: 1px solid #3f3f46; background: #18181b; font-size: 13px; color: #f4f4f5; outline: none; cursor: pointer; max-height: 260px;">
          <option value="Arial" style="font-family: Arial, sans-serif;" ${captionConfig.fontFamily === "Arial" ? "selected" : ""}>Arial</option>
          <option value="Poppins" style="font-family: 'Poppins', sans-serif;" ${captionConfig.fontFamily === "Poppins" ? "selected" : ""}>Poppins</option>
          <option value="Roboto" style="font-family: 'Roboto', sans-serif;" ${captionConfig.fontFamily === "Roboto" ? "selected" : ""}>Roboto</option>
          <option value="Impact" style="font-family: Impact, sans-serif;" ${captionConfig.fontFamily === "Impact" ? "selected" : ""}>Impact</option>
          <option value="Oswald" style="font-family: 'Oswald', sans-serif;" ${captionConfig.fontFamily === "Oswald" ? "selected" : ""}>Oswald</option>
          <option value="Open Sans" style="font-family: 'Open Sans', sans-serif;" ${captionConfig.fontFamily === "Open Sans" ? "selected" : ""}>Open Sans</option>
          <option value="Pacifico" style="font-family: 'Pacifico', cursive;" ${captionConfig.fontFamily === "Pacifico" ? "selected" : ""}>Pacifico</option>
          <option value="Lobster" style="font-family: 'Lobster', cursive;" ${captionConfig.fontFamily === "Lobster" ? "selected" : ""}>Lobster</option>
          <option value="Caveat" style="font-family: 'Caveat', cursive;" ${captionConfig.fontFamily === "Caveat" ? "selected" : ""}>Caveat</option>
          <option value="Comfortaa" style="font-family: 'Comfortaa', cursive;" ${captionConfig.fontFamily === "Comfortaa" ? "selected" : ""}>Comfortaa</option>
          <option value="Parisienne" style="font-family: 'Parisienne', cursive;" ${captionConfig.fontFamily === "Parisienne" ? "selected" : ""}>Parisienne</option>
          <option value="Poiret One" style="font-family: 'Poiret One', cursive;" ${captionConfig.fontFamily === "Poiret One" ? "selected" : ""}>Poiret One</option>
          <option value="Montserrat" style="font-family: 'Montserrat', sans-serif;" ${captionConfig.fontFamily === "Montserrat" ? "selected" : ""}>Montserrat</option>
          <option value="Playfair Display" style="font-family: 'Playfair Display', serif;" ${captionConfig.fontFamily === "Playfair Display" ? "selected" : ""}>Playfair Display</option>
          <option value="Roboto Mono" style="font-family: 'Roboto Mono', monospace;" ${captionConfig.fontFamily === "Roboto Mono" ? "selected" : ""}>Roboto Mono</option>
          <option value="Georgia" style="font-family: Georgia, serif;" ${captionConfig.fontFamily === "Georgia" ? "selected" : ""}>Georgia</option>
          <option value="Times New Roman" style="font-family: 'Times New Roman', serif;" ${captionConfig.fontFamily === "Times New Roman" ? "selected" : ""}>Times New Roman</option>
          <option value="Verdana" style="font-family: Verdana, sans-serif;" ${captionConfig.fontFamily === "Verdana" ? "selected" : ""}>Verdana</option>
        </select>

        <!-- Linha: Peso da Fonte e Tamanho Numérico -->
        <div style="display: flex; gap: 6px; width: 100%;">
          <select id="modal-font-weight" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #3f3f46; background: #18181b; font-size: 12px; color: #f4f4f5; outline: none; cursor: pointer;">
            <option value="normal" ${captionConfig.fontWeight === "normal" ? "selected" : ""}>Normal</option>
            <option value="600" ${captionConfig.fontWeight === "600" ? "selected" : ""}>Médio</option>
            <option value="bold" ${captionConfig.fontWeight === "bold" ? "selected" : ""}>Negrito</option>
            <option value="900" ${captionConfig.fontWeight === "900" ? "selected" : ""}>Extra Negrito</option>
          </select>
      <!-- Escala Idêntica ao Clipchamp -->
          <select id="modal-font-size" style="width: 75px; padding: 6px 8px; border-radius: 6px; border: 1px solid #3f3f46; background: #18181b; font-size: 12px; color: #f4f4f5; outline: none; cursor: pointer; max-height: 200px;">
            ${[12, 14, 16, 20, 24, 28, 32, 40, 48, 64, 88]
              .map((sz) => `<option value="${sz}" ${captionConfig.displayFontSize === sz ? "selected" : ""}>${sz}</option>`)
              .join("")}
          </select>
         
        </div>

        <!-- Linha: Alinhamento e Botões B e I -->
      <!-- Linha: Alinhamento, Botão Maiúscula/Minúscula (Aa) e Botao B e I -->
        
      <!-- Barra de Formatação com botões de tamanho simétrico e distribuição uniforme -->
        <div style="display: flex; align-items: center; gap: 4px; border-bottom: 1px solid #27272a; padding-bottom: 8px; width: 100%;">
          
          <!-- Grupo: Alinhamento -->
          <div style="display: flex; gap: 4px; flex: 3;">
            <button type="button" data-align="left" class="btn-caption-align" style="flex: 1; height: 28px; background: ${captionConfig.textAlign === "left" ? "#27272a" : "#18181b"}; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer; font-size: 18px; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 0;" title="Esquerda">≡</button>
            <button type="button" data-align="center" class="btn-caption-align" style="flex: 1; height: 28px; background: ${captionConfig.textAlign === "center" ? "#27272a" : "#18181b"}; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer; font-size: 18px; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 0;" title="Centralizado">≣</button>
            <button type="button" data-align="right" class="btn-caption-align" style="flex: 1; height: 28px; background: ${captionConfig.textAlign === "right" ? "#27272a" : "#18181b"}; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer; font-size: 18px; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 0;" title="Direita">≡</button>
          </div>

          <!-- Separador -->
          <div style="width: 1px; height: 18px; background-color: #27272a; margin: 0 1px;"></div>

          <!-- Grupo: Caixa Alta/Baixa (Aa) -->
          <div style="display: flex; flex: 1;">
            <button type="button" id="btn-modal-case" style="width: 100%; height: 28px; background: ${captionConfig.textTransform === "uppercase" ? "#3f3f46" : "#18181b"}; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 18px; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 0;" title="Alternar Maiúsculas/Minúsculas">
              Aa
            </button>
          </div>

          <!-- Separador -->
          <div style="width: 1px; height: 18px; background-color: #27272a; margin: 0 1px;"></div>

          <!-- Grupo: Estilos Negrito e Itálico -->
          <div style="display: flex; gap: 4px; flex: 2;">
            <button type="button" id="btn-modal-bold" style="flex: 1; height: 28px; background: ${captionConfig.fontWeight === "bold" || captionConfig.fontWeight === "900" ? "#3f3f46" : "#18181b"}; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer; font-weight: 900; font-size: 12px; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 0;" title="Negrito">B</button>
            <button type="button" id="btn-modal-italic" style="flex: 1; height: 28px; background: ${captionConfig.fontStyle === "italic" ? "#3f3f46" : "#18181b"}; border: 1px solid #3f3f46; border-radius: 6px; cursor: pointer; font-style: italic; font-size: 12px; color: #f4f4f5; display: flex; align-items: center; justify-content: center; padding: 0;" title="Itálico">I</button>
          </div>

        </div>
   
        
        <!-- Cores e Fundo -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">(Palavra Ativa):</label>
          <input type="color" id="picker-active-color" value="${captionConfig.activeColor}" style="cursor: pointer; background: transparent; border: none; width: 26px; height: 26px;" />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">Texto normal:</label>
          <input type="color" id="picker-text-color" value="${captionConfig.textColor}" style="cursor: pointer; background: transparent; border: none; width: 26px; height: 26px;" />
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="font-size: 11px; color: #d4d4d8; font-family: sans-serif;">Cor do Fundo:</label>
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="color" id="picker-bg-color" value="${captionConfig.bgColor}" ${!captionConfig.hasBg ? "disabled" : ""} style="cursor: pointer; background: transparent; border: none; width: 26px; height: 26px; opacity: ${captionConfig.hasBg ? '1' : '0.4'};" />
            <label style="font-size: 10px; color: #a1a1aa; display: flex; align-items: center; gap: 4px; cursor: pointer;">
              <input type="checkbox" id="check-no-bg" ${!captionConfig.hasBg ? "checked" : ""} style="accent-color: #8b5cf6;" />
              Sem Fundo
            </label>
          </div>
        </div>
      </div>

      <!-- Base: Botão Aplicar -->
      <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">
        <button type="button" id="btn-caption-submit" style="width: 100%; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; font-weight: 700; font-size: 12px; padding: 10px; border-radius: 8px; cursor: pointer; border: none; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); transition: transform 0.1s ease;">
        Aplicar Legenda no Vídeo</button>
        <span id="caption-feedback" style="font-size: 11px; color: #4ade80; text-align: center; display: none; font-weight: 500;">Legenda aplicada com sucesso!</span>
      </div>
    </div>
  `;

  const btnClose = container.querySelector("#btn-caption-close");
  const btnSubmit = container.querySelector("#btn-caption-submit");
  const btnClear = container.querySelector("#btn-caption-clear");
  const btnAi = container.querySelector("#btn-ai-transcribe");
  const transcribeStatus = container.querySelector("#transcribe-status");
  const textarea = container.querySelector("#caption-input-text");
  const feedback = container.querySelector("#caption-feedback");

  const fontSelect = container.querySelector("#modal-font-family");
  const weightSelect = container.querySelector("#modal-font-weight");
  const sizeSelect = container.querySelector("#modal-font-size");
  const alignBtns = container.querySelectorAll(".btn-caption-align");
  const btnBold = container.querySelector("#btn-modal-bold");
  const btnItalic = container.querySelector("#btn-modal-italic");

  const pickerActive = container.querySelector("#picker-active-color");
  const pickerText = container.querySelector("#picker-text-color");
  const pickerBg = container.querySelector("#picker-bg-color");
  const checkNoBg = container.querySelector("#check-no-bg");

  // Listeners dos controles de fonte
  fontSelect?.addEventListener("change", (e) => {
    captionConfig.fontFamily = e.target.value;
    updateLiveCaption({ fontFamily: e.target.value });
  });

  weightSelect?.addEventListener("change", (e) => {
    captionConfig.fontWeight = e.target.value;
    updateLiveCaption({ fontWeight: e.target.value });
    if (btnBold) {
      const isBold = e.target.value === "bold" || e.target.value === "900";
      btnBold.style.background = isBold ? "#3f3f46" : "#18181b";
    }
  });
sizeSelect?.addEventListener("change", (e) => {
    const selectedSize = Number(e.target.value);
    const scaledPixelSize = Math.round(selectedSize * FONT_SCALE_FACTOR);
    
    captionConfig.displayFontSize = selectedSize;
    captionConfig.fontSize = scaledPixelSize;
    
    updateLiveCaption({ fontSize: scaledPixelSize });
  });
 

  alignBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const align = btn.getAttribute("data-align");
      captionConfig.textAlign = align;
      updateLiveCaption({ textAlign: align });
      alignBtns.forEach((b) => {
        b.style.background = b.getAttribute("data-align") === align ? "#27272a" : "#18181b";
      });
    });
  });

  btnBold?.addEventListener("click", () => {
    const isBold = captionConfig.fontWeight === "bold" || captionConfig.fontWeight === "900";
    captionConfig.fontWeight = isBold ? "normal" : "bold";
    if (weightSelect) weightSelect.value = captionConfig.fontWeight;
    btnBold.style.background = !isBold ? "#3f3f46" : "#18181b";
    updateLiveCaption({ fontWeight: captionConfig.fontWeight });
  });

  btnItalic?.addEventListener("click", () => {
    const isItalic = captionConfig.fontStyle === "italic";
    captionConfig.fontStyle = isItalic ? "normal" : "italic";
    btnItalic.style.background = !isItalic ? "#3f3f46" : "#18181b";
    updateLiveCaption({ fontStyle: captionConfig.fontStyle });
  });

  // Listeners de cores
  pickerActive?.addEventListener("input", (e) => {
    captionConfig.activeColor = e.target.value;
    updateLiveCaption({ activeColor: e.target.value });
  });

  pickerText?.addEventListener("input", (e) => {
    captionConfig.textColor = e.target.value;
    updateLiveCaption({ textColor: e.target.value });
  });

  pickerBg?.addEventListener("input", (e) => {
    captionConfig.bgColor = e.target.value;
    if (captionConfig.hasBg) {
      updateLiveCaption({ backgroundColor: e.target.value });
    }
  });

  checkNoBg?.addEventListener("change", (e) => {
    captionConfig.hasBg = !e.target.checked;
    if (pickerBg) {
      pickerBg.style.opacity = captionConfig.hasBg ? "1" : "0.4";
      pickerBg.disabled = !captionConfig.hasBg;
    }
    updateLiveCaption({ backgroundColor: captionConfig.hasBg ? captionConfig.bgColor : "transparent" });
  });

  btnClear?.addEventListener("click", () => {
    if (textarea) {
      textarea.value = "";
      lastInputText = "";
      rawCaptionText = "";
      customWhisperSegments = null;
      textarea.focus();
    }
  });

  textarea?.addEventListener("input", (e) => {
    lastInputText = e.target.value;
  });

  textarea?.addEventListener("keydown", (e) => e.stopPropagation());
  textarea?.addEventListener("keyup", (e) => e.stopPropagation());
  textarea?.addEventListener("keypress", (e) => e.stopPropagation());
  textarea?.addEventListener("mousedown", (e) => e.stopPropagation());
  textarea?.addEventListener("click", (e) => e.stopPropagation());

  btnClose?.addEventListener("click", () => {
    if (typeof onClose === "function") onClose();
  });



const btnCase = container.querySelector("#btn-modal-case");

  btnCase?.addEventListener("click", () => {
    const isUpper = captionConfig.textTransform === "uppercase";
    captionConfig.textTransform = isUpper ? "none" : "uppercase";
    btnCase.style.background = !isUpper ? "#3f3f46" : "#18181b";
    updateLiveCaption({ textTransform: captionConfig.textTransform });
  });




  // Whisper / Transcrição
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
      btnAi.innerText = " Extraindo áudio...";
      if (transcribeStatus) {
        transcribeStatus.style.display = "block";
        transcribeStatus.style.color = "#38bdf8";
        transcribeStatus.innerText = "Processando com o Whisper... aguarde.";
      }

      const trimFrom = mediaItem.trim?.from ?? 0;
      const trimTo = mediaItem.trim?.to ?? null;
      const mediaBlob = await extractAudioBlobFromUrl(mediaItem.details.src, trimFrom, trimTo);

      btnAi.innerText = " Transcrevendo...";

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
        btnAi.innerText = "Criar Legenda Dinâmica";
      }, 3500);
    }
  });

  // Ação de Aplicar
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

    customWhisperSegments = finalSegments;
    const canvasWidth = state.size?.width || 1920;
    const canvasHeight = state.size?.height || 1080;
    const boxWidth = Math.round(canvasWidth * 0.7);
    const boxHeight = 160;

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
        fontFamily: captionConfig.fontFamily,
        fontWeight: captionConfig.fontWeight,
        fontSize: captionConfig.fontSize,
        fontStyle: captionConfig.fontStyle,
        textAlign: captionConfig.textAlign,
        textTransform: captionConfig.textTransform, // <-- ADICIONADO AQUI
        width: boxWidth,
        height: boxHeight,
        left: (canvasWidth - boxWidth) / 2,
        top: canvasHeight - boxHeight - 120,
      },
    };

    useStore.setState((prev) => ({
      trackItemIds: prev.trackItemIds?.includes(captionId) ? prev.trackItemIds : [...(prev.trackItemIds || []), captionId],
      activeIds: [captionId],
      trackItemsMap: {
        ...prev.trackItemsMap,
        [captionId]: payload,
      },
      trackItemDetailsMap: {
        ...prev.trackItemDetailsMap,
        [captionId]: payload.details,
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