import { analysisFailureMessage } from "./failure-message";

describe("analysisFailureMessage", () => {
  it("shows the server's plain message as it is", () => {
    const message =
      "The AI service is busy right now, so the analysis could not finish. Please try again in a few minutes.";
    expect(analysisFailureMessage(message)).toBe(message);
  });

  it("uses the first message that is present", () => {
    expect(analysisFailureMessage(undefined, "", "Saved message.")).toBe(
      "Saved message.",
    );
  });

  it("hides raw server internals saved by older versions", () => {
    for (const raw of [
      "No retrieved evidence available. Analysis cannot proceed without knowledge base context.",
      'AI provider "gemini" is unavailable: {"error":{"code":503}}',
      "LLM referenced unknown chunkId \"doc:9\" — possible hallucinated citation",
      "Invalid `this.prisma.analysisCase.update()` invocation",
    ]) {
      const shown = analysisFailureMessage(raw);
      expect(shown).toMatch(/did not complete\. Please try again/);
      expect(shown).not.toContain("gemini");
    }
  });

  it("explains network failures in plain words", () => {
    expect(analysisFailureMessage("Failed to fetch")).toMatch(/network problem/);
  });

  it("falls back to a generic message", () => {
    expect(analysisFailureMessage(null, undefined)).toMatch(/did not complete/);
  });
});
