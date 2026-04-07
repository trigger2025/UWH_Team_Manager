import html2canvas from "html2canvas";
import { Media } from "@capacitor-community/media";

const BG = "#0a0f1e";

export interface ExportOptions {
  includeRatings?: boolean;
  includePositions?: boolean;
}

/**
 * Captures an element as PNG using an off-screen clone.
 * - Preserves Tailwind CSS (fixes clipping/squashing)
 * - Matches real element width
 * - Hides .no-export elements
 * - Supports includeRatings / includePositions
 * - Attempts camera roll save (fallback to download in PWA)
 */
export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!element) return;

  const { includeRatings = true, includePositions = true } = options;

  // Measure the real element
  const rect = element.getBoundingClientRect();

  // Clone the element
  const clone = element.cloneNode(true) as HTMLElement;

  // Wrapper to hold clone + CSS
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

  // Copy global CSS (Tailwind + your styles)
  document
    .querySelectorAll("style, link[rel='stylesheet']")
    .forEach((node) => {
      wrapper.appendChild(node.cloneNode(true));
    });

  // Style the clone to match the real UI
  clone.style.width = `${rect.width}px`;
  clone.style.minWidth = `${rect.width}px`;
  clone.style.maxWidth = `${rect.width}px`;
  clone.style.display = "block";
  clone.style.overflow = "hidden";
  clone.style.background = BG;
  clone.style.padding = "24px";
  clone.style.boxSizing = "border-box";

  // Fix vertical clipping by enforcing a safe line-height
  clone.style.lineHeight = "1.25";

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

  // Hide elements marked as no-export
  clone.querySelectorAll<HTMLElement>(".no-export").forEach((el) => {
    el.style.display = "none";
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Allow layout to settle
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

    // Try saving to camera roll (will fail silently in PWA)
    try {
      await Media.savePhoto({
        path: dataUrl,
        album: "Team Generator",
      });
    } catch {
      // Fallback: download
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
