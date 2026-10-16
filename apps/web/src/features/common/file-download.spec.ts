import { downloadFileName } from "./file-download";

const WORD =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("downloadFileName", () => {
  it("uses the server's name from Content-Disposition", () => {
    expect(
      downloadFileName(
        `attachment; filename="ewi-jane-o_neil-report.pdf"; filename*=UTF-8''ewi-jane-o%E2%80%99neil-report.pdf`,
        "ewi-old-report.docx",
        "application/pdf",
      ),
    ).toBe("ewi-jane-o’neil-report.pdf");
    expect(
      downloadFileName(
        'attachment; filename="medical-causation-report-2026-10-16.docx"',
        "fallback.docx",
        WORD,
      ),
    ).toBe("medical-causation-report-2026-10-16.docx");
  });

  it("gives an old Word name the PDF extension when the header is hidden", () => {
    // Cross-origin responses do not expose Content-Disposition.
    expect(
      downloadFileName(null, "ewi-jane-doe-report.docx", "application/pdf"),
    ).toBe("ewi-jane-doe-report.pdf");
    expect(downloadFileName(null, "", "application/pdf")).toBe("report.pdf");
  });

  it("gives a Word file the .docx extension", () => {
    expect(downloadFileName(null, "ewi-jane-doe-report.pdf", WORD)).toBe(
      "ewi-jane-doe-report.docx",
    );
    expect(downloadFileName(null, "ewi-jane-doe-report.docx", WORD)).toBe(
      "ewi-jane-doe-report.docx",
    );
  });

  it("removes path separators", () => {
    expect(
      downloadFileName('attachment; filename="../x/report.pdf"', "", "application/pdf"),
    ).toBe(".._x_report.pdf");
  });
});
