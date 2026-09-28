import { useRef, useState, useEffect } from "react";
import { Button } from "./ui-components.jsx";
import { dispatch } from "@designcombo/events";
import {
  HISTORY_UNDO,
  HISTORY_REDO,
  ADD_AUDIO,
  ADD_IMAGE,
  ADD_TEXT,
  ADD_VIDEO,
} from "@designcombo/state";
import {
  MenuIcon,
  ShareIcon,
  UndoIcon,
  RedoIcon,
  ChevronDown,
  Check,
  Maximize2,
  Crop,
} from "lucide-react";
import { nanoid } from "nanoid";
import useStore, { SECONDARY_FONT, SECONDARY_FONT_URL } from "./editor-store.js";

const ASPECT_RATIOS = [
  {
    label: "Largo 16:9",
    sublabel: "YouTube e sites de streaming",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    iconWidth: "w-5 h-3",
  },
  {
    label: "Vertical 9:16",
    sublabel: "Reels do Instagram e TikTok",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    iconWidth: "w-3 h-5",
  },
  {
    label: "Quadrado 1:1",
    sublabel: "Postagens no Instagram",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    iconWidth: "w-4 h-4",
  },
  {
    label: "Clássico 4:3",
    sublabel: "Monitores antigos e retro",
    width: 1440,
    height: 1080,
    ratio: "4:3",
    iconWidth: "w-4 h-3",
  },
  {
    label: "Redes Sociais 4:5",
    sublabel: "Feed do Instagram vertical",
    width: 1080,
    height: 1350,
    ratio: "4:5",
    iconWidth: "w-3.5 h-4.5",
  },
  {
    label: "Cinema 21:9",
    sublabel: "Ultrawide e tela de cinema",
    width: 2560,
    height: 1080,
    ratio: "21:9",
    iconWidth: "w-6 h-2.5",
  },
  {
    label: "Retrato 2:3",
    sublabel: "Fotografia vertical e Pinterest",
    width: 1080,
    height: 1620,
    ratio: "2:3",
    iconWidth: "w-3 h-4.5",
  },
];


export function Navbar() {
  const { size, setState } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleStatus = (e) => {
      setIsCropping(Boolean(e.detail?.isCropping));
    };
    window.addEventListener("CROP_STATUS_UPDATED", handleStatus);
    return () => window.removeEventListener("CROP_STATUS_UPDATED", handleStatus);
  }, []);

  const handleUndo = () => {
    dispatch(HISTORY_UNDO);
  };

  const handleRedo = () => {
    dispatch(HISTORY_REDO);
  };

  const handleSelectRatio = (item) => {
    const newSize = {
      width: item.width,
      height: item.height,
    };

    setState({ size: newSize });

    dispatch("CHANGE_CANVAS_SIZE", {
      payload: newSize,
    });
    dispatch("CHANGE_SIZE", {
      payload: newSize,
    });

    const { sceneMoveableRef } = useStore.getState();
    setTimeout(() => {
      sceneMoveableRef?.current?.moveable?.updateRect();
    }, 50);

    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentRatio =
    ASPECT_RATIOS.find(
      (r) => r.width === size?.width && r.height === size?.height
    ) || { label: "Tamanho", ratio: "" };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 320px",
      }}
      className="bg-sidebar pointer-events-none flex h-[58px] items-center border-b border-border/80 px-2 relative z-50 select-none"
    >
      <div className="flex items-center gap-2">
        <div className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-md text-zinc-200">
          <div className="hover:bg-background-subtle flex h-8 w-8 items-center justify-center cursor-pointer">
            <MenuIcon className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center px-1.5">
          <Button
            onClick={handleUndo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <UndoIcon width={20} />
          </Button>
          <Button
            onClick={handleRedo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <RedoIcon width={20} />
          </Button>
        </div>
      </div>

      <div className="pointer-events-auto flex h-14 items-center justify-center gap-2">
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-zinc-900/90 hover:bg-zinc-800 transition-all text-sm font-medium text-zinc-200 cursor-pointer shadow-sm active:scale-95"
          >
            <Maximize2 className="h-4 w-4 text-zinc-400" />
            <span>Tamanho</span>
            <span className="text-xs text-zinc-400 font-normal">
              {currentRatio.ratio ? `(${currentRatio.ratio})` : ""}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-400 ml-0.5 transition-transform duration-150 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isOpen && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md">
              <div className="px-2.5 py-1 text-xs font-semibold text-zinc-400 border-b border-zinc-800/60 pb-1.5">
                Proporção da Tela
              </div>
              <div className="max-h-72 overflow-y-auto flex flex-col gap-0.5 py-1">
                {ASPECT_RATIOS.map((item) => {
                  const isSelected =
                    size?.width === item.width && size?.height === item.height;

                  return (
                    <button
                      type="button"
                      key={item.label}
                      onClick={() => handleSelectRatio(item)}
                      className={`flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-zinc-800 text-white font-medium"
                          : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 flex items-center justify-center">
                          <div
                            className={`border border-zinc-500 rounded-xs bg-zinc-700/40 ${item.iconWidth}`}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-medium leading-none">
                            {item.label}
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-1 leading-none">
                            {item.sublabel}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-white ml-2 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

 
          {!isCropping ? (
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("START_CROP_MODE"));
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-zinc-900/90 hover:bg-zinc-800 transition-all text-sm font-medium text-zinc-200 cursor-pointer shadow-sm active:scale-95"
            title="Recortar Mídia"
          >
            <Crop className="h-4 w-4 text-zinc-400" />
            <span>Recortar</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900/95 shadow-md">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("APPLY_CROP_MODE"));
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Confirmar Recorte"
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Concluir</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("CANCEL_CROP_MODE"));
              }}
              className="flex items-center justify-center p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer active:scale-95"
              title="Cancelar Recorte"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="flex h-14 items-center justify-end gap-2">
        <div className="bg-sidebar pointer-events-auto flex h-12 items-center gap-2 rounded-md px-2.5">
          <Button
            className="flex h-8 gap-1 border border-border"
            variant="outline"
          >
            <ShareIcon width={18} /> Share
          </Button>
          <Button
            className="flex h-8 gap-1 border border-border"
            variant="default"
            onClick={() => {
              window.open("https://discord.gg/jrZs3wZyM5", "_blank");
            }}
          >
            Discord
          </Button>
        </div>
      </div>
    </div>
  );
}

// Catálogo de estilos de texto pré-definidos
const TEXT_PRESETS = [
  {
    id: "creator",
    label: "Creator",
    previewText: "CREATOR",
    details: {
      color: "#ffffff",
      fontSize: 85,
      fontWeight: "900",
      borderWidth: 3,
      borderColor: "#000000",
      boxShadow: { x: 4, y: 4, blur: 0, color: "#18181b" },
    },
  },
  {
    id: "caixa_texto",
    label: "Caixa de texto",
    previewText: "Caixa de texto",
    details: {
      color: "#ffffff",
      fontSize: 65,
      fontWeight: "700",
      backgroundColor: "#000000",
      borderWidth: 0,
      borderColor: "transparent",
    },
  },
  {
    id: "orgulho",
    label: "Orgulho",
    previewText: "Orgulho",
    details: {
      color: "#ffffff",
      fontSize: 85,
      fontWeight: "900",
      borderWidth: 2,
      borderColor: "#3b82f6",
      boxShadow: { x: 3, y: 3, blur: 0, color: "#f97316" },
    },
  },
  {
    id: "botao",
    label: "Botão",
    previewText: "Botão",
    details: {
      color: "#18181b",
      fontSize: 65,
      fontWeight: "700",
      backgroundColor: "#f4f4f5",
      borderWidth: 1,
      borderColor: "#d4d4d8",
      boxShadow: { x: 0, y: 3, blur: 6, color: "rgba(0,0,0,0.3)" },
    },
  },
  {
    id: "bolha",
    label: "Bolha",
    previewText: "Bolha",
    details: {
      color: "#a3e635",
      fontSize: 85,
      fontWeight: "900",
      borderWidth: 3,
      borderColor: "#4d7c0f",
      boxShadow: { x: 3, y: 3, blur: 0, color: "#365314" },
    },
  },
  {
    id: "retro",
    label: "Retrô",
    previewText: "Retrô",
    details: {
      color: "#f59e0b",
      fontSize: 85,
      fontWeight: "900",
      borderWidth: 2,
      borderColor: "#b45309",
      boxShadow: { x: 4, y: 4, blur: 0, color: "#dc2626" },
    },
  },
  {
    id: "neon",
    label: "Neon",
    previewText: "Neon",
    details: {
      color: "#f472b6",
      fontSize: 85,
      fontWeight: "800",
      borderWidth: 2,
      borderColor: "#ec4899",
      boxShadow: { x: 0, y: 0, blur: 16, color: "#ec4899" },
    },
  },
  {
    id: "marca",
    label: "Marca",
    previewText: "Marca",
    details: {
      color: "#000000",
      fontSize: 75,
      fontWeight: "900",
      backgroundColor: "#ffffff",
      borderWidth: 2,
      borderColor: "#ef4444",
    },
  },
  {
    id: "censura",
    label: "Censura",
    previewText: "CENSURA",
    details: {
      color: "#ffffff",
      fontSize: 70,
      fontWeight: "800",
      backgroundColor: "#000000",
      borderWidth: 0,
      borderColor: "transparent",
    },
  },
  {
    id: "assinar",
    label: "Assinar",
    previewText: "ASSINAR",
    details: {
      color: "#ffffff",
      fontSize: 70,
      fontWeight: "800",
      backgroundColor: "#ef4444",
      borderWidth: 2,
      borderColor: "#000000",
      boxShadow: { x: 3, y: 3, blur: 0, color: "#000000" },
    },
  },
  {
    id: "basico",
    label: "Básico",
    previewText: "Básico",
    details: {
      color: "#ffffff",
      fontSize: 80,
      fontWeight: "700",
      borderWidth: 1,
      borderColor: "#000000",
      boxShadow: { x: 2, y: 2, blur: 4, color: "rgba(0,0,0,0.6)" },
    },
  },
  {
    id: "classico",
    label: "Clássico",
    previewText: "Clássico",
    details: {
      color: "#facc15",
      fontSize: 80,
      fontWeight: "800",
      borderWidth: 2,
      borderColor: "#000000",
      boxShadow: { x: 3, y: 3, blur: 0, color: "#000000" },
    },
  },
  {
    id: "mono",
    label: "Mono",
    previewText: "Mono",
    details: {
      color: "#facc15",
      fontSize: 75,
      fontWeight: "900",
      backgroundColor: "#27272a",
      borderWidth: 0,
      borderColor: "transparent",
    },
  },
  {
    id: "arredondado",
    label: "Arredondado",
    previewText: "Arredondado",
    details: {
      color: "#ffffff",
      fontSize: 65,
      fontWeight: "700",
      backgroundColor: "#a855f7",
      borderWidth: 0,
      borderColor: "transparent",
    },
  },
  {
    id: "legenda",
    label: "Realce de legenda",
    previewText: "Realce",
    details: {
      color: "#000000",
      fontSize: 70,
      fontWeight: "800",
      backgroundColor: "#facc15",
      borderWidth: 0,
      borderColor: "transparent",
    },
  },
  {
    id: "oferta",
    label: "Oferta",
    previewText: "OFERTA",
    details: {
      color: "#fde047",
      fontSize: 85,
      fontWeight: "900",
      borderWidth: 2,
      borderColor: "#ca8a04",
      boxShadow: { x: 3, y: 3, blur: 0, color: "#000000" },
    },
  },
];

export function Menu() {
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Alterna a exibição da gaveta intermediária de estilos
  const [showTextStyles, setShowTextStyles] = useState(false);

  const [slots, setSlots] = useState([
    { id: 1, type: null, data: null, preview: null, textContent: null },
    { id: 2, type: null, data: null, preview: null, textContent: null },
    { id: 3, type: null, data: null, preview: null, textContent: null },
  ]);

  const addMediaToFirstFreeSlot = (item) => {
    setSlots((prev) => {
      const freeIndex = prev.findIndex((s) => !s.data);
      const targetIndex = freeIndex !== -1 ? freeIndex : 0;
      const updated = [...prev];
      updated[targetIndex] = { ...updated[targetIndex], ...item };
      return updated;
    });
  };

  const handleClearSlot = (slotId, e) => {
    e.stopPropagation();
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? { id: slotId, type: null, data: null, preview: null, textContent: null }
          : s
      )
    );
  };

  const handleDragStart = (e, slot) => {
    if (!slot.data) return;
    const dragPayload = JSON.stringify(slot.data);
    e.dataTransfer.setData("application/json", dragPayload);
    e.dataTransfer.setData("text/plain", dragPayload);
    e.dataTransfer.effectAllowed = "copyMove";
  };



const handleSelectTextPreset = (preset) => {
    const { size } = useStore.getState();
    const canvasWidth = size?.width || 1920;
    const canvasHeight = size?.height || 1080;
    const itemWidth = 500;
    const itemHeight = 120;

    const textVal = preset.previewText || "Texto";
    const payload = {
      id: nanoid(),
      type: "text",
      name: textVal,
      text: textVal,
      display: {
        from: 0,
        to: 5000,
      },
      details: {
        text: textVal,
        fontFamily: SECONDARY_FONT,
        fontUrl: SECONDARY_FONT_URL,
        fontSize: preset.details.fontSize || 80,
        width: itemWidth,
        height: itemHeight,
        left: (canvasWidth - itemWidth) / 2,
        top: (canvasHeight - itemHeight) / 2,
        textAlign: "center",
        opacity: 100,
        color: preset.details.color || "#ffffff",
        fontWeight: preset.details.fontWeight || "800",
        borderWidth: preset.details.borderWidth || 0,
        borderColor: preset.details.borderColor || "transparent",
        boxShadow: preset.details.boxShadow || null,
        backgroundColor: preset.details.backgroundColor || "transparent",
        borderRadius: preset.details.backgroundColor ? "10px" : "0px",
        padding: preset.details.backgroundColor ? "10px 20px" : "0px",
      },
    };





    addMediaToFirstFreeSlot({
      type: "text",
      data: payload,
      textContent: textVal,
      styleDetails: preset.details,
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const src = URL.createObjectURL(file);
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const width = img.naturalWidth || 800;
      const height = img.naturalHeight || 600;

      const payload = {
        id: nanoid(),
        type: "image",
        display: {
          from: 0,
          to: 5000,
        },
        details: {
          src,
          width,
          height,
          left: 0,
          top: 0,
          opacity: 100,
          crop: {
            x: 0,
            y: 0,
            width,
            height,
          },
        },
      };

      addMediaToFirstFreeSlot({
        type: "image",
        data: payload,
        preview: src,
      });
    };
    e.target.value = "";
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const src = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = src;
    audio.onloadedmetadata = () => {
      const durationMs = Math.round(audio.duration * 1000) || 5000;
      const payload = {
        id: nanoid(),
        type: "audio",
        duration: durationMs,
        display: {
          from: 0,
          to: durationMs,
        },
        trim: {
          from: 0,
          to: durationMs,
        },
        details: {
          src,
          volume: 100,
          left: 0,
          top: 0,
          width: 0,
          height: 0,
        },
      };

      addMediaToFirstFreeSlot({
        type: "audio",
        data: payload,
        preview: null,
      });
    };
    e.target.value = "";
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.onloadeddata = () => {
      const realDuration =
        video.duration && !isNaN(video.duration) && isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : 10000;

      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (err) {}
      const previewUrl = canvas.toDataURL("image/jpeg", 0.7);

      const { size, duration: currentGlobalDuration } = useStore.getState();
      const canvasW = size?.width || 1920;
      const canvasH = size?.height || 1080;

      if (realDuration > (currentGlobalDuration || 0)) {
        useStore.setState({ duration: realDuration });
        dispatch("CHANGE_DURATION", { payload: { duration: realDuration } });
      }

      const payload = {
        id: nanoid(),
        type: "video",
        duration: realDuration,
        display: {
          from: 0,
          to: realDuration,
        },
        trim: {
          from: 0,
          to: realDuration,
        },
        metadata: {
          previewUrl,
          naturalWidth: video.videoWidth || 1920,
          naturalHeight: video.videoHeight || 1080,
        },
        details: {
          src,
          width: canvasW,
          height: canvasH,
          left: 0,
          top: 0,
          volume: 100,
          opacity: 100,
          crop: {
            x: 0,
            y: 0,
            width: canvasW,
            height: canvasH,
          },
        },
      };

      addMediaToFirstFreeSlot({
        type: "video",
        data: payload,
        preview: previewUrl,
      });
    };

    e.target.value = "";
  };

  return (

<div className="flex h-full bg-sidebar border-r border-border/60 select-none shrink-0 overflow-visible">
   
      {/* 1. BARRA DE BOTÕES (itens) */}
      <div className="w-36 p-3 flex flex-col justify-start shrink-0">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioUpload}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoUpload}
        />

        <div className="mb-3 text-xs font-medium text-zinc-400">itens</div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setShowTextStyles((prev) => !prev)}
            variant="secondary"
            className={`w-full justify-center text-xs py-1.5 h-8 cursor-pointer transition-all ${
              showTextStyles
                ? "bg-zinc-700 text-white font-semibold ring-1 ring-zinc-500"
                : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
            }`}
          >
            texto
          </Button>
          <Button
            onClick={() => {
              setShowTextStyles(false);
              imageInputRef.current?.click();
            }}
            variant="secondary"
            className="w-full justify-center bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs py-1.5 h-8 cursor-pointer"
          >
            imagem
          </Button>
          <Button
            onClick={() => {
              setShowTextStyles(false);
              audioInputRef.current?.click();
            }}
            variant="secondary"
            className="w-full justify-center bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs py-1.5 h-8 cursor-pointer"
          >
            áudio
          </Button>
          <Button
            onClick={() => {
              setShowTextStyles(false);
              videoInputRef.current?.click();
            }}
            variant="secondary"
            className="w-full justify-center bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs py-1.5 h-8 cursor-pointer"
          >
            vídeo
          </Button>
        </div>
      </div>

      {/* 2. PAINEL DE ESTILOS DE TEXTO COM SCROLLBAR (ABRE AO LADO) */}
      {showTextStyles && (
        <div className="w-56 p-3 flex flex-col h-full border-l border-border/50 bg-[#161618] shrink-0">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-300">Estilos de texto</span>
            <button
              type="button"
              onClick={() => setShowTextStyles(false)}
              className="text-zinc-500 hover:text-white text-xs cursor-pointer px-1 rounded"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          {/* Grelha com rolagem personalizada */}
          <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
            
            {TEXT_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                onClick={() => handleSelectTextPreset(preset)}
                className="flex flex-col items-center justify-center h-20 rounded-lg border border-zinc-800/90 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-500 transition-all p-2 cursor-pointer group shadow-xs active:scale-95"
              >
                <span
                  style={{
                    color: preset.details.color,
                    fontWeight: preset.details.fontWeight,
                    WebkitTextStroke: preset.details.borderWidth
                      ? `${preset.details.borderWidth}px ${preset.details.borderColor}`
                      : "none",
                    textShadow: preset.details.boxShadow
                      ? `${preset.details.boxShadow.x}px ${preset.details.boxShadow.y}px ${preset.details.boxShadow.blur}px ${preset.details.boxShadow.color}`
                      : "none",
                    backgroundColor: preset.details.backgroundColor || "transparent",
                    padding: preset.details.backgroundColor ? "2px 6px" : "0",
                    borderRadius: preset.details.backgroundColor ? "4px" : "0",
                  }}
                  className="text-xs truncate max-w-full tracking-wider"
                >
                  {preset.previewText}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. OS 3 CAMPOS DE RASCUNHO (PERMANECEM À DIREITA) */}
      <div className="flex flex-col justify-between w-60 p-3 border-l border-border/50 bg-[#121214] shrink-0">
        {slots.map((slot) => (
          <div
            key={slot.id}
            draggable={!!slot.data}
            onDragStart={(e) => handleDragStart(e, slot)}
            className={`relative flex items-center justify-center h-[30%] w-full rounded border border-zinc-700/60 transition-all overflow-hidden ${
              slot.data
                ? "bg-zinc-900 border-zinc-500 cursor-grab active:cursor-grabbing shadow-md"
                : "bg-transparent text-zinc-600"
            }`}
          >
            {slot.data ? (
              <>
                <button
                  type="button"
                  onClick={(e) => handleClearSlot(slot.id, e)}
                  className="absolute top-1 right-1 z-20 h-4 w-4 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                  title="Remover"
                >
                  ✕
                </button>
                <div className="absolute bottom-1 left-1 z-20 px-1 py-0.5 rounded bg-black/80 text-[8px] text-zinc-300 font-bold uppercase">
                  {slot.type}
                </div>
                {slot.type === "image" && (
                  <img src={slot.preview} alt="" className="w-full h-full object-cover" />
                )}
                {slot.type === "video" && (
                  <img src={slot.preview} alt="" className="w-full h-full object-cover" />
                )}
                {slot.type === "audio" && (
                  <span className="text-xs text-zinc-300 font-medium">🎵 Áudio</span>
                )}
                {slot.type === "text" && (
                  <div
                    style={{
                      color: slot.styleDetails?.color || "#ffffff",
                      WebkitTextStroke: slot.styleDetails?.borderWidth
                        ? `${slot.styleDetails.borderWidth}px ${slot.styleDetails.borderColor}`
                        : "none",
                      textShadow: slot.styleDetails?.boxShadow
                        ? `${slot.styleDetails.boxShadow.x}px ${slot.styleDetails.boxShadow.y}px ${slot.styleDetails.boxShadow.blur}px ${slot.styleDetails.boxShadow.color}`
                        : "none",
                      backgroundColor: slot.styleDetails?.backgroundColor || "transparent",
                    }}
                    className="p-2 text-center text-xs font-semibold line-clamp-3"
                  >
                    "{slot.textContent}"
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-8 w-8 rounded border border-zinc-700 bg-zinc-800/40 text-zinc-400 text-sm">
                +
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default { Navbar, Menu };