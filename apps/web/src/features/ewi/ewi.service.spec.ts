import { apiFetch } from "@/lib/config";
import { saveBlob } from "@/features/common/file-download";
import { ApiError } from "@/features/common/api";
import { EwiClient } from "./ewi.service";

jest.mock("@/lib/config", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/features/common/file-download", () => ({
  downloadFileName: jest.fn(
    (_header: string | null, fallback: string) => fallback,
  ),
  saveBlob: jest.fn(),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("EwiClient source-links download", () => {
  const client = new EwiClient();

  beforeEach(() => {
    mockedFetch.mockReset();
    (saveBlob as jest.Mock).mockReset();
  });

  it("requests the source-links route and saves the PDF", async () => {
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["%PDF"], { type: "application/pdf" }),
      headers: {
        get: (name: string) =>
          name === "Content-Disposition"
            ? 'attachment; filename="ewi-jane-doe-source-links.pdf"'
            : name === "Content-Type"
              ? "application/pdf"
              : null,
      },
    } as unknown as Response);

    const saved = await client.downloadSourceLinksReport(
      "inv-1",
      "ewi-report-source-links.pdf",
    );

    expect(mockedFetch).toHaveBeenCalledWith("/ewi/histories/inv-1/report/links");
    expect(saveBlob).toHaveBeenCalled();
    expect(saved).toBe("ewi-report-source-links.pdf");
  });

  it("does not save a file when the API rejects the session", async () => {
    mockedFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Authentication is required." }),
    } as unknown as Response);

    await expect(
      client.downloadSourceLinksReport("inv-1", "links.pdf"),
    ).rejects.toBeInstanceOf(ApiError);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});
