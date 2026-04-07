import html2canvas from "html2canvas";
import { Media } from "@capacitor-community/media";

const BG = "#0a0f1e";

export interface ExportOptions {
  includeRatings?: boolean;
  includePositions?: boolean;
}

/**
 * Fully inlines ALL computed styles into the clone.
 * This is the only 100% reliable method for iOS PWAs.
 */
export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!element) return;

  const { includeRatings = true, includePositions = true } = options;

  const rect = element.getBoundingClientRect();

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;

  // Recursively inline computed styles
  function inlineStyles(source: HTMLElement, target: HTMLElement) {
    const computed = window.getComputedStyle(source);

    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      target.style.setProperty(prop, computed.getPropertyValue(prop));
    }

    // Recurse through children
    const sourceChildren = Array.from(source.children) as HTMLElement[];
    const targetChildren = Array.from(target.children) as HTMLElement[];

    sourceChildren.forEach((srcChild, i) => {
      inlineStyles(srcChild, targetChildren[i] as HTMLElement);
    });
  }

  inlineStyles(element, clone);

  // Apply export-specific overrides
  clone.style.width = `${rect.width}px`;
  clone.style.minWidth = `${rect.width}px`;
  clone.style.maxWidth = `${rect.width}px`;
  clone.style.background = BG;
  clone.style.padding = "24px";
  clone.style.boxSizing = "border-box";

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

  // Wrapper to hold the clone
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

    // Try saving to camera roll (fails in PWA → fallback)
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
