import { expertInvestigationSchema } from "./expert-form.schema";

const base = {
  expertName: "Jane A. Smith, MD",
  city: "Boston",
  specialty: "Neurology",
};

describe("expert investigation form", () => {
  it("treats the NPI as optional", () => {
    const parsed = expertInvestigationSchema.parse({ ...base, npi: "  " });
    expect(parsed.npi).toBeUndefined();
  });

  it("accepts a valid NPI and removes spaces", () => {
    const parsed = expertInvestigationSchema.parse({
      ...base,
      npi: "1234 567 893",
    });
    expect(parsed.npi).toBe("1234567893");
  });

  it("rejects a wrong length or a mistyped digit", () => {
    const short = expertInvestigationSchema.safeParse({ ...base, npi: "12345" });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toMatch(/exactly 10 digits/);

    const typo = expertInvestigationSchema.safeParse({
      ...base,
      npi: "1234567890",
    });
    expect(typo.success).toBe(false);
    expect(typo.error?.issues[0]?.message).toMatch(/not a valid NPI/);
  });
});
