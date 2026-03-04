import html2canvas from "html2canvas";

const BG = "#0a0f1e";

/**
 * Captures an element as PNG and triggers download.
 * Uses toBlob (iOS Safari safe) rather than toDataURL.
 */
export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string
): Promise<void> {
  if (!element) return;

  const canvas = await html2canvas(element, {
    backgroundColor: BG,
    scale: 2,
    useCORS: true,
    logging: false,
  });

  return new Promise<void>((resolve, reject) => {
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
}
