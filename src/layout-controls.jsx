import { useRef, useState, useEffect } from "react";
import { Button } from "./ui-components";
import { dispatch } from "@designcombo/events";
import {
  HISTORY_UNDO,
  HISTORY_REDO,
  ADD_AUDIO,
  ADD_IMAGE,
  ADD_TEXT,
  ADD_VIDEO,
  EDIT_OBJECT,
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
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants";
import useStore from "./use-store";

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
  const dropdownRef = useRef(null);

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

    // Altera estritamente o tamanho do ecrã / canvas
    setState({ size: newSize });

    dispatch("CHANGE_CANVAS_SIZE", {
      payload: newSize,
    });
    dispatch("CHANGE_SIZE", {
      payload: newSize,
    });

    // Força a atualização da caixa de seleção visual para não ficar desfasada
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
      {/* Lado Esquerdo */}
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

      {/* Centro: Botão Tamanho + Botão Recortar */}
      <div className="pointer-events-auto flex h-14 items-center justify-center gap-2">
        {/* Dropdown de Proporções */}
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

        {/* Botão Recortar na mesma barra central */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("TOGGLE_CROP_MODE"));
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-zinc-900/90 hover:bg-zinc-800 transition-all text-sm font-medium text-zinc-200 cursor-pointer shadow-sm active:scale-95"
          title="Recortar Mídia"
        >
          <Crop className="h-4 w-4 text-zinc-400" />
          <span>Recortar</span>
        </button>
      </div>

      {/* Lado Direito */}
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

export function Menu() {
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);

const handleAddText = () => {
    const defaultText = "Texto";
    dispatch(ADD_TEXT, {
      payload: {
        id: nanoid(),
        type: "text",
        name: defaultText,
        text: defaultText,
        display: {
          from: 0,
          to: 5000,
        },
        details: {
          text: defaultText,
          fontFamily: SECONDARY_FONT,
          fontUrl: SECONDARY_FONT_URL,
          fontSize: 90,
          width: 600,
          height: 120,
          left: 100,
          top: 100,
          textAlign: "center",
          opacity: 100,
        },
      },
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

      dispatch(ADD_IMAGE, {
        payload: {
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
        },
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
      dispatch(ADD_AUDIO, {
        payload: {
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
        },
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
      // Captura a duração total real do vídeo em milissegundos
      const realDuration = video.duration && !isNaN(video.duration) && isFinite(video.duration)
        ? Math.round(video.duration * 1000)
        : 10000;

      // Gera a miniatura estável no frame 0
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

      // Se o vídeo for maior que a duração atual da timeline, expande a linha do tempo
      if (realDuration > (currentGlobalDuration || 0)) {
        useStore.setState({ duration: realDuration });
        dispatch("CHANGE_DURATION", { payload: { duration: realDuration } });
      }

      dispatch(ADD_VIDEO, {
        payload: {
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
        },
      });
    };

    e.target.value = "";
  };







  return (
    <div className="w-60 bg-sidebar">
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

      <div className="px-4 mt-4 text-muted-foreground">Adicionar itens</div>
      <div className="space-y-2 p-4">
        <Button
          onClick={handleAddText}
          variant="secondary"
          className="w-full cursor-pointer"
        >
          Adicionar texto
        </Button>
        <Button
          onClick={() => imageInputRef.current?.click()}
          variant="secondary"
          className="w-full cursor-pointer"
        >
          Adicionar imagem
        </Button>
        <Button
          onClick={() => audioInputRef.current?.click()}
          variant="secondary"
          className="w-full cursor-pointer"
        >
          Adicionar áudio
        </Button>
        <Button
          onClick={() => videoInputRef.current?.click()}
          variant="secondary"
          className="w-full cursor-pointer"
        >
          Adicionar vídeo
        </Button>
      </div>
    </div>
  );
}

export default { Navbar, Menu };