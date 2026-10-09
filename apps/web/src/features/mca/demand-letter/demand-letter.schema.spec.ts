import {
  EMPTY_DEMAND_LETTER,
  demandLetterSchema,
  toDemandLetterRequest,
} from "./demand-letter.schema";

const valid = {
  ...EMPTY_DEMAND_LETTER,
  clientName: " Jane Doe ",
  dateOfLoss: "2024-08-14",
  incidentDescription: "Your insured rear-ended our client at a red light.",
  lostWages: "$2,400.50",
  demandAmount: "45,000",
  attorneyName: "Alex Counsel",
};

describe("demandLetterSchema", () => {
  it("accepts amounts typed with $ and commas, and sends numbers", () => {
    const parsed = demandLetterSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const request = toDemandLetterRequest(parsed.data);
    expect(request).toMatchObject({
      clientName: "Jane Doe",
      lostWages: 2400.5,
      demandAmount: 45000,
      responseDays: 30,
      useAi: true,
    });
    // Empty fields are left out of the request.
    expect(request.futureMedical).toBeUndefined();
    expect(request.claimNumber).toBeUndefined();
    expect(JSON.parse(JSON.stringify(request))).not.toHaveProperty("policyLimits");
  });

  it("rejects missing and invalid fields", () => {
    const parsed = demandLetterSchema.safeParse({
      ...valid,
      clientName: "",
      demandAmount: "",
      lostWages: "about 2k",
      dateOfLoss: "08/14/2024",
      responseDays: "0",
      attorneyEmail: "not-an-email",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining([
        "clientName",
        "demandAmount",
        "lostWages",
        "dateOfLoss",
        "responseDays",
        "attorneyEmail",
      ]),
    );
  });
});
