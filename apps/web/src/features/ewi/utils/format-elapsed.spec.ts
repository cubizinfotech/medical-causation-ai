import { formatElapsed } from "./format-elapsed";

describe("formatElapsed", () => {
  it("shows minutes and seconds under an hour", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65.9)).toBe("01:05");
    expect(formatElapsed(599)).toBe("09:59");
  });

  it("adds hours past 60 minutes", () => {
    expect(formatElapsed(3600)).toBe("1:00:00");
    expect(formatElapsed(3725)).toBe("1:02:05");
  });

  it("never goes negative", () => {
    expect(formatElapsed(-5)).toBe("00:00");
  });
});
