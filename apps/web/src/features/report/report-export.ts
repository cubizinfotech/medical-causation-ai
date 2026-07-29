import { domToCanvas } from "modern-screenshot";

const PDF_MARGIN_MM = 12;
const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_CONTENT_WIDTH_MM = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
const PDF_CONTENT_HEIGHT_MM = PDF_PAGE_HEIGHT_MM - PDF_MARGIN_MM * 2;
/** A4 content width at 96 DPI — keeps layout stable during capture */
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
}

function canvasHeightMm(canvas: HTMLCanvasElement): number {
  return (canvas.height * PDF_CONTENT_WIDTH_MM) / canvas.width;
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

function appendCanvasToPdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  startYmm: number,
): number {
  const scale = PDF_CONTENT_WIDTH_MM / canvas.width;
  let offsetY = 0;
  let yMm = startYmm;

  while (offsetY < canvas.height) {
    const remainingPageMm = PDF_CONTENT_HEIGHT_MM - yMm;
    if (remainingPageMm < 6) {
      pdf.addPage();
      yMm = 0;
      continue;
    }

    const maxSlicePx = Math.floor(remainingPageMm / scale);
    const slicePx = Math.min(maxSlicePx, canvas.height - offsetY);

    drawCanvasSlice(pdf, canvas, offsetY, slicePx, yMm);

    offsetY += slicePx;
    yMm += slicePx * scale;

    if (offsetY < canvas.height && yMm >= PDF_CONTENT_HEIGHT_MM - 2) {
      pdf.addPage();
      yMm = 0;
    }
  }

  return yMm + 6;
}

async function captureBlock(block: HTMLElement): Promise<HTMLCanvasElement> {
  return domToCanvas(block, {
    scale: 2,
    backgroundColor: "#ffffff",
    width: EXPORT_WIDTH_PX,
    filter: shouldIncludeInPdfExport,
  });
}

export async function downloadReportPdf(
  element: HTMLElement,
  filename?: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  element.classList.add("pdf-export-mode");
  element.style.width = `${EXPORT_WIDTH_PX}px`;

  await waitForPaint();

  try {
    const blocks = Array.from(
      element.querySelectorAll<HTMLElement>(".report-export-block"),
    );

    if (blocks.length === 0) {
      throw new Error("No report sections found for PDF export");
    }

    const pdf = new jsPDF("p", "mm", "a4");
    let yMm = 0;

    for (const block of blocks) {
      const canvas = await captureBlock(block);
      const blockHeightMm = canvasHeightMm(canvas);

      if (yMm > 0 && yMm + blockHeightMm > PDF_CONTENT_HEIGHT_MM) {
        pdf.addPage();
        yMm = 0;
      }

      if (blockHeightMm <= PDF_CONTENT_HEIGHT_MM - yMm) {
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          PDF_MARGIN_MM,
          PDF_MARGIN_MM + yMm,
          PDF_CONTENT_WIDTH_MM,
          blockHeightMm,
        );
        yMm += blockHeightMm + 6;
      } else {
        yMm = appendCanvasToPdf(pdf, canvas, yMm);
      }
    }

    pdf.save(filename ?? `medical-causation-report-${Date.now()}.pdf`);
  } finally {
    element.classList.remove("pdf-export-mode");
    element.style.width = "";
  }
}
