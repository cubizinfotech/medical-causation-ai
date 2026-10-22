import { expertInvestigationSchema } from "./expert-form.schema";

const base = {
  expertName: "Jane A. Smith, MD",
  city: "Boston",
  specialty: "Neurology",
};

describe("expert investigation form", () => {
  it("requires the name and the specialty or profession", () => {
    const noName = expertInvestigationSchema.safeParse({ ...base, expertName: " " });
    expect(noName.success).toBe(false);
    const noSpecialty = expertInvestigationSchema.safeParse({
      ...base,
      specialty: "",
    });
    expect(noSpecialty.success).toBe(false);
    expect(noSpecialty.error?.issues[0]?.message).toMatch(
      /specialty or profession is required/i,
    );
  });

  it("accepts any profession, not only medical specialties", () => {
    expect(
      expertInvestigationSchema.parse({
        ...base,
        specialty: "Licensed electrician",
      }).specialty,
    ).toBe("Licensed electrician");
    expect(
      expertInvestigationSchema.parse({
        ...base,
        specialty: "Attorney",
      }).specialty,
    ).toBe("Attorney");
    expect(
      expertInvestigationSchema.parse({
        ...base,
        specialty: "Marine surveyor extraordinaire",
      }).specialty,
    ).toBe("Marine surveyor extraordinaire");
  });

  it("treats the city as optional", () => {
    expect(expertInvestigationSchema.parse({ ...base, city: "" }).city).toBe("");
    expect(
      expertInvestigationSchema.parse({ ...base, city: "  " }).city,
    ).toBe("");
    expect(expertInvestigationSchema.safeParse({ ...base, city: "B" }).success).toBe(
      false,
    );
  });

  it("keeps multiline additional context and drops it when blank", () => {
    const parsed = expertInvestigationSchema.parse({
      ...base,
      additionalContext: "  Also known as J. Smith\nWorked at Acme Clinic  ",
    });
    expect(parsed.additionalContext).toBe(
      "Also known as J. Smith\nWorked at Acme Clinic",
    );
    expect(
      expertInvestigationSchema.parse({ ...base, additionalContext: "  \n " })
        .additionalContext,
    ).toBeUndefined();
    expect(
      expertInvestigationSchema.safeParse({
        ...base,
        additionalContext: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("accepts omitted city, NPI, additional context, and CV", () => {
    const parsed = expertInvestigationSchema.parse({
      expertName: "Jason A. Demery",
      city: "",
      specialty: "Neuropsychology",
    });
    expect(parsed.city).toBe("");
    expect(parsed.npi).toBeUndefined();
    expect(parsed.additionalContext).toBeUndefined();
    expect(parsed.cvDocumentId).toBeUndefined();
  });

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
