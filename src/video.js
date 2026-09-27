import { Image as ImageBase, Pattern, util } from "@designcombo/timeline";
import { createMediaControls } from "./timeline-canvas-controls";

class Video extends ImageBase {
  static type = "Video";

  static createControls() {
    return { controls: createMediaControls() };
  }

  constructor(props) {
    super(props);
    this.itemType = "video";
    this.previewUrl = props.metadata?.previewUrl || props.src;
    this.loadVideoThumbnail();
  }

  loadVideoThumbnail() {
    const sourceImg = this.previewUrl || this.src;
    if (!sourceImg) return;

    util.loadImage(sourceImg).then((img) => {
      const imgHeight = img.height || 40;
      const rectHeight = this.height || 40;
      const scaleY = rectHeight / imgHeight;
      const pattern = new Pattern({
        source: img,
        repeat: "repeat-x",
        patternTransform: [scaleY, 0, 0, scaleY, 0, 0],
      });
      this.set("fill", pattern);
      this.canvas?.requestRenderAll();
    }).catch(() => {
      // Caso não consiga carregar a imagem de prévia, mantém preenchimento suave
      this.set("fill", "#27272a");
      this.canvas?.requestRenderAll();
    });
  }

  _render(ctx) {
    super._render(ctx);
    // Desenha o badge/ícone "Video" sobre a miniatura
    this.drawVideoBadge(ctx);
    this.updateSelected(ctx);
  }

  drawVideoBadge(ctx) {
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(4, 4, 42, 18);
    ctx.font = "600 10px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("VÍDEO", 8, 17);
    ctx.restore();
  }

  setSrc(src) {
    this.src = src;
    this.previewUrl = src;
    this.loadVideoThumbnail();
    this.canvas?.requestRenderAll();
  }
}

export default Video;