import html2canvas from "html2canvas";
import { Media } from "@capacitor-community/media";

const BG = "#0a0f1e";

export interface ExportOptions {
  includeRatings?: boolean;
  includePositions?: boolean;
}

export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!element) return;

  const { includeRatings = true, includePositions = true } = options;

  const rect = element.getBoundingClientRect();
  const clone = element.cloneNode(true) as HTMLElement;

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";
  wrapper.style.width = `${rect.width}px`;
  wrapper.style.height = "auto";
  wrapper.style.overflow = "hidden";

  // Copy ALL CSS (Vite, Tailwind, Google Fonts, etc.)
  document.querySelectorAll(`
    link[rel='stylesheet'],
    link[href*='assets'],
    link[href*='index'],
    style,
    style[data-vite-dev-id],
    style[id*='vite'],
    style[id*='twind'],
    style[data-twind]
  `).forEach((node) => {
    wrapper.appendChild(node.cloneNode(true));
  });

  // Style the clone
  clone.style.width = `${rect.width}px`;
  clone.style.minWidth = `${rect.width}px`;
  clone.style.maxWidth = `${rect.width}px`;
  clone.style.display = "block";
  clone.style.overflow = "hidden";
  clone.style.background = BG;
  clone.style.padding = "24px";
  clone.style.boxSizing = "border-box";

  // Fix vertical clipping
  clone.style.lineHeight = "1.3";
  clone.querySelectorAll("*").forEach((el) => {
    (el as HTMLElement).style.lineHeight = "1.3";
  });

  // Hide ratings if needed
  if (!includeRatings) {
    clone.querySelectorAll<HTMLElement>(".player-rating").forEach((el) => {
      el.style.display = "none";
    });
  }

  // Hide positions if needed
  if (!includePositions) {
    clone.querySelectorAll<HTMLElement>(".player-position").forEach((el) => {
      el.style.display = "none";
    });
  }

  // Hide .no-export elements
  clone.querySelectorAll<HTMLElement>(".no-export").forEach((el) => {
    el.style.display = "none";
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const width = rect.width;
    const height = clone.offsetHeight;

    const canvas = await html2canvas(clone, {
      backgroundColor: BG,
      scale: 3,
      width,
      height,
      useCORS: true,
      logging: false,
    });

    const dataUrl = canvas.toDataURL("image/png");

    try {
      await Media.savePhoto({
        path: dataUrl,
        album: "Team Generator",
      });
    } catch {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } finally {
    document.body.removeChild(wrapper);
  }
}
