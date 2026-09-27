import { Caption as CaptionBase } from "@designcombo/timeline";
import { SECONDARY_FONT } from "./constants";
import { createResizeControls } from "./timeline-canvas-controls";

class Text extends CaptionBase {
  static type = "Text";

  static createControls() {
    return { controls: createResizeControls() };
  }

  constructor(props) {
    super(props);
    this.itemType = "text";
    this.fill = "#2e2e48";
    this.name = props.name || props.details?.text || props.text || "Texto";
    this.text = this.name;
  }

  set(key, value) {
    super.set(key, value);
    if (key === "name" || key === "text") {
      this.name = value;
      this.text = value;
      this.canvas?.requestRenderAll();
    } else if (key === "details" && value?.text) {
      this.name = value.text;
      this.text = value.text;
      this.canvas?.requestRenderAll();
    }
    return this;
  }

  _render(ctx) {
    super._render(ctx);
    this.drawTextIdentity(ctx);
    this.updateSelected(ctx);
  }

  drawTextIdentity(ctx) {
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.font = `600 12px ${SECONDARY_FONT || "sans-serif"}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const label = this.name || this.text || this.details?.text || "Texto";
    const availableWidth = Math.max(10, this.width - 24);

    let displayText = label;
    if (ctx.measureText(displayText).width > availableWidth) {
      while (
        ctx.measureText(displayText + "...").width > availableWidth &&
        displayText.length > 0
      ) {
        displayText = displayText.slice(0, -1);
      }
      displayText += "...";
    }

    ctx.fillText(displayText, 12, this.height / 2);
    ctx.restore();
  }

  updateSelected(ctx) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255, 1.0)"
      : "rgba(255, 255, 255, 0.15)";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
      6
    );
    ctx.lineWidth = 1;
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();
  }
}

export default Text;
const onTextBlur = (id, _) => {
    const elRef = document.querySelector(`.id-${id}`);
    if (!elRef) return;

    const textDiv =
      elRef.querySelector(".designcombo_textLayer") ||
      elRef.firstElementChild?.firstElementChild?.firstElementChild ||
      elRef;

    const currentText = textDiv.innerText?.trim() || "";
    if (!currentText) return;

    const {
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      textShadow,
      webkitTextStroke,
    } = textDiv.style;
    const { width } = elRef.style;

    const newHeight = calculateTextHeight({
      family: fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      text: currentText,
      textShadow: textShadow,
      webkitTextStroke,
      width,
      id: id,
    });

    // 1. Atualiza o estado global da aplicação
    dispatch(EDIT_OBJECT, {
      payload: {
        [id]: {
          name: currentText,
          text: currentText,
          details: {
            text: currentText,
            height: newHeight,
          },
        },
      },
    });

    // 2. Atualiza diretamente o item ativo no Canvas da Timeline e redesenha a barra
    const { timeline } = useStore.getState();
    if (timeline) {
      // Localiza o objeto de texto no canvas da linha do tempo
      const fabricObjects = timeline.getObjects ? timeline.getObjects() : [];
      const itemNode = fabricObjects.find((obj) => obj.id === id);

      if (itemNode) {
        itemNode.text = currentText;
        if (itemNode.details) {
          itemNode.details.text = currentText;
        }
        itemNode.name = currentText;
      }

      // Força a renderização imediata do canvas da timeline
      timeline.requestRenderAll?.();
    }
  };