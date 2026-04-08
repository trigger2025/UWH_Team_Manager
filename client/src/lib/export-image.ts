import html2canvas from "html2canvas";
import { Media } from "@capacitor-community/media";

const BG = "#0a0f1e";
const VIEWPORT_WIDTH = 408; // your real CSS width in portrait

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

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;

  // Inline ONLY typography styles (Option B)
  function inlineTypography(source: HTMLElement, target: HTMLElement) {
    const computed = window.getComputedStyle(source);

    const props = [
      "font-size",
      "font-family",
      "font-weight",
      "line-height",
      "letter-spacing",
      "text-transform",
      "font-style",
      "white-space"
    ];

    props.forEach((prop) => {
      target.style.setProperty(prop, computed.getPropertyValue(prop));
    });

    const sourceChildren = Array.from(source.children) as HTMLElement[];
    const targetChildren = Array.from(target.children) as HTMLElement[];

    sourceChildren.forEach((srcChild, i) => {
      inlineTypography(srcChild, targetChildren[i] as HTMLElement);
    });
  }

  inlineTypography(element, clone);

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

  // Create a fixed 408px virtual viewport
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = `${VIEWPORT_WIDTH}px`;
  wrapper.style.minWidth = `${VIEWPORT_WIDTH}px`;
  wrapper.style.maxWidth = `${VIEWPORT_WIDTH}px`;
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.zIndex = "-1";
  wrapper.style.background = BG;
  wrapper.style.padding = "24px";
  wrapper.style.boxSizing = "border-box";

  // Copy Tailwind + global CSS
  document.querySelectorAll("link[rel='stylesheet'], style").forEach((node) => {
    wrapper.appendChild(node.cloneNode(true));
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const height = clone.offsetHeight;

    const canvas = await html2canvas(clone, {
      backgroundColor: BG,
      scale: 3,
      width: VIEWPORT_WIDTH,
      height,
      useCORS: true,
      logging: false
    });

    const dataUrl = canvas.toDataURL("image/png");

    try {
      await Media.savePhoto({
        path: dataUrl,
        album: "Team Generator"
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
