import html2canvas from "html2canvas";
import { Media } from "@capacitor-community/media";

const BG = "#0a0f1e";

export interface ExportOptions {
  includeRatings?: boolean;
  includePositions?: boolean;
}

/**
 * Captures an element as PNG using a fixed-width off-screen clone so the
 * live UI is never squashed or mutated. Uses toBlob (iOS Safari safe).
 */
export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!element) return;

  const { includeRatings = true, includePositions = true } = options;

  const clone = element.cloneNode(true) as HTMLElement;

  clone.style.width = "1200px";
  clone.style.minWidth = "1200px";
  clone.style.maxWidth = "1200px";
  clone.style.background = BG;
  clone.style.padding = "24px";
  clone.style.borderRadius = "0";
  clone.style.boxSizing = "border-box";
  
  clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.style.maxWidth = "none";
    el.style.flexShrink = "0";
  });

  if (!includeRatings) {
    clone.querySelectorAll<HTMLElement>(".player-rating").forEach((el) => {
      el.style.display = "none";
    });
  }

  if (!includePositions) {
    clone.querySelectorAll<HTMLElement>(".player-position").forEach((el) => {
      el.style.display = "none";
    });
  }
    clone.querySelectorAll<HTMLElement>(".no-export").forEach((el) => {
    el.style.display = "none";
  });

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
  const width = clone.scrollWidth;
  const height = clone.scrollHeight;

  const canvas = await html2canvas(clone, {
    backgroundColor: BG,
    scale: 3,
    width: width,
    height: height,
    windowWidth: width,
    windowHeight: height,
    useCORS: true,
    logging: false
  });

  const dataUrl = canvas.toDataURL("image/png");

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

} finally {
  document.body.removeChild(wrapper);
}
}