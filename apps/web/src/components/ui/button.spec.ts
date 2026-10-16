import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Download } from "lucide-react";
import { isOtherPage } from "@/components/layout/route-progress";
import { Button } from "./button";

function render(props: Record<string, unknown>, ...children: unknown[]) {
  return renderToStaticMarkup(
    createElement(Button, props, ...(children as never[])),
  );
}

describe("Button loading", () => {
  it("shows a spinner, is disabled and busy, and keeps its text", () => {
    const html = render(
      { loading: true },
      createElement(Download, { className: "h-4 w-4" }),
      "Export PDF",
    );

    expect(html).toContain("data-spinner");
    expect(html).toContain("animate-spin");
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('aria-busy="true"');
    // The button's own icon is hidden while the spinner shows.
    expect(html).toContain("[&amp;&gt;svg:not([data-spinner])]:hidden");
    expect(html).toContain("Export PDF");
  });

  it("shows the loading text when one is given", () => {
    const html = render(
      { loading: true, loadingText: "Downloading…" },
      "Download PDF Report",
    );
    expect(html).toContain("Downloading…");
    expect(html).not.toContain("Download PDF Report");
  });

  it("is a plain button when not loading", () => {
    const html = render({ onClick: () => undefined }, "Save");

    expect(html).not.toContain("data-spinner");
    expect(html).not.toMatch(/disabled=""/);
    expect(html).not.toContain("aria-busy");
    expect(html).toContain("Save");
  });

  it("stays disabled when disabled, even without loading", () => {
    expect(render({ disabled: true }, "Save")).toMatch(/disabled=""/);
  });
});

describe("isOtherPage (page progress bar)", () => {
  const current = {
    href: "http://localhost:3000/ewi/histories?page=1",
    origin: "http://localhost:3000",
    pathname: "/ewi/histories",
    search: "?page=1",
  };

  it("starts for another page of the site", () => {
    expect(isOtherPage("/ewi/histories/abc", current)).toBe(true);
    expect(isOtherPage("/ewi/histories?page=2", current)).toBe(true);
    expect(isOtherPage("http://localhost:3000/mca", current)).toBe(true);
  });

  it("does not start for the same page, another site, or other schemes", () => {
    expect(isOtherPage("/ewi/histories?page=1", current)).toBe(false);
    expect(isOtherPage("/ewi/histories?page=1#top", current)).toBe(false);
    expect(isOtherPage("https://pubmed.ncbi.nlm.nih.gov/1/", current)).toBe(
      false,
    );
    expect(isOtherPage("mailto:clerk@example.com", current)).toBe(false);
    expect(isOtherPage("javascript:void(0)", current)).toBe(false);
  });
});
