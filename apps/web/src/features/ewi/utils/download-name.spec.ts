import { reportDownloadName } from "./download-name";

describe("reportDownloadName", () => {
  it("uses the server's name from Content-Disposition", () => {
    expect(
      reportDownloadName(
        `attachment; filename="ewi-jane-o_neil-report.pdf"; filename*=UTF-8''ewi-jane-o%E2%80%99neil-report.pdf`,
        "ewi-old-report.docx",
        "application/pdf",
      ),
    ).toBe("ewi-jane-o’neil-report.pdf");
    expect(
      reportDownloadName(
        'attachment; filename="ewi-jane-doe-report.pdf"',
        "ewi-old-report.docx",
        "application/pdf",
      ),
    ).toBe("ewi-jane-doe-report.pdf");
  });

  it("gives an old Word name the PDF extension when the header is hidden", () => {
    // Cross-origin responses do not expose Content-Disposition.
    expect(
      reportDownloadName(null, "ewi-jane-doe-report.docx", "application/pdf"),
    ).toBe("ewi-jane-doe-report.pdf");
    expect(reportDownloadName(null, "", "application/pdf")).toBe(
      "ewi-report.pdf",
    );
  });

  it("keeps a saved Word report's name when the file is still Word", () => {
    expect(
      reportDownloadName(
        null,
        "ewi-jane-doe-report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("ewi-jane-doe-report.docx");
  });

  it("removes path separators", () => {
    expect(
      reportDownloadName('attachment; filename="../x/report.pdf"', "", "application/pdf"),
    ).toBe(".._x_report.pdf");
  });
});
