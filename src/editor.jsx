import Timeline from "./timeline";
import useStore from "./use-store";
import { Navbar, Menu } from "./layout-controls";
import { useTimelineEvents } from "./player-hooks";
import Scene from "./scene";
import StateManager from "@designcombo/state";
import { useEffect, useRef } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui-components";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants";
import { loadFonts } from "./fonts";

const stateManager = new StateManager({
  size: {
    width: 1920,
    height: 1080,
  },
});


const Editor = () => {
  const timelinePanelRef = useRef(null);
  const { timeline, playerRef, size } = useStore();

  useTimelineEvents();

  // Sincroniza as alterações de tamanho do useStore com a instância do StateManager
  useEffect(() => {
    if (size?.width && size?.height) {
      stateManager.updateState({
        size: {
          width: size.width,
          height: size.height,
        },
      });
    }
  }, [size]);

  useEffect(() => {
    loadFonts([
      {
        name: SECONDARY_FONT,
        url: SECONDARY_FONT_URL,
      },
    ]);
  }, []);

  useEffect(() => {
    const screenHeight = window.innerHeight;
    const desiredHeight = 300;
    const percentage = (desiredHeight / screenHeight) * 100;
    timelinePanelRef.current?.resize(percentage);
  }, []);

  const handleTimelineResize = () => {
    const timelineContainer = document.getElementById("timeline-container");
    if (!timelineContainer) return;

    timeline?.resize(
      {
        height: timelineContainer.clientHeight - 90,
        width: timelineContainer.clientWidth - 40,
      },
      {
        force: true,
      }
    );
  };

  useEffect(() => {
    const onResize = () => handleTimelineResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [timeline]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Navbar posicionada no topo com z-index prioritário */}
      <header className="relative z-50 shrink-0">
        <Navbar />
      </header>
      <div className="flex flex-1 overflow-hidden relative z-0">
        <ResizablePanelGroup style={{ flex: 1 }} direction="vertical">
          <ResizablePanel className="relative" defaultSize={70}>
            <div className="flex h-full flex-1">
              <Menu />
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <Scene stateManager={stateManager} />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            className="min-h-[50px]"
            ref={timelinePanelRef}
            defaultSize={30}
            onResize={handleTimelineResize}
          >
            {playerRef && <Timeline stateManager={stateManager} />}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Editor;