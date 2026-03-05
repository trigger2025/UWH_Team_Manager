import html2canvas from "html2canvas";

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
  clone.style.width = "800px";
  clone.style.maxWidth = "800px";
  clone.style.background = BG;
  clone.style.padding = "16px";
  clone.style.borderRadius = "0";

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

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
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
