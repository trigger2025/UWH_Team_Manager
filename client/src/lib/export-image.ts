import html2canvas from "html2canvas";

const BG = "#0a0f1e";

export interface ExportOptions {
  includeRatings?: boolean;
  includePositions?: boolean;
}

/**
 * Captures an element as PNG using a fixed-width (1000px) off-screen clone.
 *
 * Key behaviours:
 * - Hard-resets every flex/grid responsive constraint so mobile Safari can't
 *   compress the layout before capture.
 * - Never mutates the live DOM — only the off-screen clone is modified.
 * - Uses canvas.toBlob() (iOS Safari safe) instead of toDataURL.
 */
export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!element) return;

  const { includeRatings = true, includePositions = true } = options;

  const clone = element.cloneNode(true) as HTMLElement;

  // Hard-reset the clone's own box model
  clone.style.width = "1000px";
  clone.style.minWidth = "1000px";
  clone.style.maxWidth = "1000px";
  clone.style.flex = "none";
  clone.style.transform = "none";
  clone.style.zoom = "1";
  clone.style.margin = "0";
  clone.style.padding = "24px";
  clone.style.boxSizing = "border-box";
  clone.style.background = BG;

  // Strip all responsive constraints from every descendant
  clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.style.maxWidth = "none";
    el.style.minWidth = "0";
    el.style.flexShrink = "0";
  });

  // Apply rating/position visibility toggles to the clone
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

  // Mount the clone in a fixed offscreen wrapper so it renders at full width
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "-99999px";
  wrapper.style.width = "1000px";
  wrapper.style.background = BG;
  wrapper.style.pointerEvents = "none";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: BG,
      scale: 2,
      useCORS: true,
      logging: false,
    });

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("toBlob returned null")); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}
