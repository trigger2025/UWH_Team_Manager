import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import TeamsExportLayout, { ExportSectionData } from "@/components/export/TeamsExportLayout";

const BG = "#0a0f1e";

export interface ExportOptions {
  includeRatings?: boolean;
  includePositions?: boolean;
}

/**
 * Renders a brand-new React tree off-screen at a fixed 1000px width,
 * then captures it with html2canvas. This completely avoids viewport
 * scaling and flex-shrink issues that plague DOM-clone approaches on
 * mobile Safari.
 */
export async function exportTeamSections(
  sections: ExportSectionData[],
  filename: string,
  options: ExportOptions = {},
  title?: string
): Promise<void> {
  const { includeRatings = true, includePositions = true } = options;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-10000px";
  container.style.width = "1000px";
  container.style.transform = "scale(1)";
  container.style.transformOrigin = "top left";
  container.style.background = BG;
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    createElement(TeamsExportLayout, { sections, includeRatings, includePositions, title })
  );

  // Wait for React to flush and fonts/layout to settle
  await new Promise<void>((resolve) => setTimeout(resolve, 200));

  try {
    const canvas = await html2canvas(container, {
      backgroundColor: BG,
      scale: 3,
      useCORS: true,
      logging: false,
      windowWidth: 1000,
      width: 1000,
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
    root.unmount();
    document.body.removeChild(container);
  }
}

/**
 * Fallback DOM-clone export — used for schedule (table layout) and
 * any element without structured team data. Uses fixed-width clone
 * with all flex constraints stripped.
 */
export async function exportElementAsImage(
  element: HTMLElement | null,
  filename: string,
  options: ExportOptions = {}
): Promise<void> {
  if (!element) return;

  const { includeRatings = true, includePositions = true } = options;

  const clone = element.cloneNode(true) as HTMLElement;

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

  clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
    el.style.maxWidth = "none";
    el.style.minWidth = "0";
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

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "-10000px";
  wrapper.style.width = "1000px";
  wrapper.style.transform = "scale(1)";
  wrapper.style.transformOrigin = "top left";
  wrapper.style.background = BG;
  wrapper.style.pointerEvents = "none";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: BG,
      scale: 3,
      useCORS: true,
      logging: false,
      windowWidth: 1000,
      width: 1000,
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
