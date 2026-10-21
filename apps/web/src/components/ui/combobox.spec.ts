import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Combobox } from "./combobox";

describe("Combobox", () => {
  it("renders a text input, not a select, and hides suggestions until the user types", () => {
    const html = renderToStaticMarkup(
      createElement(Combobox, {
        id: "specialty",
        value: "",
        onValueChange: () => undefined,
        options: ["Attorney", "Cardiology"],
        placeholder: "Type a profession",
      }),
    );
    expect(html).toContain("<input");
    expect(html).toContain('role="combobox"');
    expect(html).toContain('type="text"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Attorney");
    expect(html).not.toContain("Cardiology");
  });
});
