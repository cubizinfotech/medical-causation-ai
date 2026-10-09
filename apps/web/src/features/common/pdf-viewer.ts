import { apiFetch } from "@/lib/config";

const blobUrls = new Map<string, Promise<string>>();

/**
 * File endpoints need the bearer token, so a plain link cannot open them.
 * Fetch each file once per page load and reuse the object URL.
 */
function pdfBlobUrl(path: string, noun: string): Promise<string> {
  let url = blobUrls.get(path);
  if (!url) {
    url = apiFetch(path).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? `This ${noun} is no longer available.`
            : `Could not open the ${noun} (${response.status}).`,
        );
      }
      return URL.createObjectURL(await response.blob());
    });
    url.catch(() => blobUrls.delete(path));
    blobUrls.set(path, url);
  }
  return url;
}

/**
 * Opens an owner-only PDF at a page in a new tab. Call it from a click
 * handler: the tab is opened right away so the browser does not block it.
 * `noun` names the file in error messages ("record", "CV").
 */
export async function openPdfPage(
  path: string,
  pageNumber: number,
  noun: string,
): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = `${await pdfBlobUrl(path, noun)}#page=${pageNumber}`;
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
  } catch (error) {
    tab?.close();
    throw error;
  }
}
