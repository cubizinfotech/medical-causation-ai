import { domToCanvas } from "modern-screenshot";

const PDF_MARGIN_MM = 10;
const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_CONTENT_WIDTH_MM = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
const PDF_CONTENT_HEIGHT_MM = PDF_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
/** Full A4 content width at 96 DPI */
const EXPORT_WIDTH_PX = 794;

function shouldIncludeInPdfExport(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    return true;
  }
  return !node.classList.contains("no-print");
}

async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
}

function drawCanvasSlice(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  offsetY: number,
  sliceHeightPx: number,
  yMm: number,
): void {
  const scale = PDF_CONTENT_WIDTH_MM / canvas.width;
  const sliceMm = sliceHeightPx * scale;

  const slice = document.createElement("canvas");
  slice.width = canvas.width;
  slice.height = sliceHeightPx;
  const ctx = slice.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(
    canvas,
    0,
    offsetY,
    canvas.width,
    sliceHeightPx,
    0,
    0,
    canvas.width,
    sliceHeightPx,
  );

  pdf.addImage(
    slice.toDataURL("image/png"),
    "PNG",
    PDF_MARGIN_MM,
    PDF_MARGIN_MM + yMm,
    PDF_CONTENT_WIDTH_MM,
    sliceMm,
  );
}

function renderFullCanvasToPdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
): void {
  const scale = PDF_CONTENT_WIDTH_MM / canvas.width;
  let offsetY = 0;
  let yMm = 0;
  let isFirstSlice = true;

  while (offsetY < canvas.height) {
    const remainingPageMm = PDF_CONTENT_HEIGHT_MM - yMm;
    if (!isFirstSlice && remainingPageMm < 8) {
      pdf.addPage();
      yMm = 0;
      continue;
    }

    const maxSlicePx = Math.floor(
      (PDF_CONTENT_HEIGHT_MM - yMm) / scale,
    );
    const slicePx = Math.min(maxSlicePx, canvas.height - offsetY);
    if (slicePx <= 0) {
      pdf.addPage();
      yMm = 0;
      continue;
    }

    drawCanvasSlice(pdf, canvas, offsetY, slicePx, yMm);

    offsetY += slicePx;
    yMm += slicePx * scale;
    isFirstSlice = false;

    if (offsetY < canvas.height && yMm >= PDF_CONTENT_HEIGHT_MM - 4) {
      pdf.addPage();
      yMm = 0;
    }
  }
}

export async function downloadReportPdf(
  element: HTMLElement,
  filename?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add("pdf-export-mode");
  clone.style.width = `${EXPORT_WIDTH_PX}px`;
  clone.style.maxWidth = `${EXPORT_WIDTH_PX}px`;
  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.zIndex = "-1";
  clone.style.background = "#ffffff";
  document.body.appendChild(clone);

  await waitForPaint();

  try {
    const canvas = await domToCanvas(clone, {
      scale: 2,
      backgroundColor: "#ffffff",
      width: EXPORT_WIDTH_PX,
      filter: shouldIncludeInPdfExport,
      style: {
        width: `${EXPORT_WIDTH_PX}px`,
        maxWidth: `${EXPORT_WIDTH_PX}px`,
        backgroundColor: "#ffffff",
      },
    });

    const pdf = new jsPDF("p", "mm", "a4");
    renderFullCanvasToPdf(pdf, canvas);
    pdf.save(filename ?? `medical-causation-report-${Date.now()}.pdf`);
  } finally {
    document.body.removeChild(clone);
  }
}
