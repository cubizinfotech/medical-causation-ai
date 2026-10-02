import { caseFormSchema } from "./case-form.schema";

const validCase = {
  patientAge: "47",
  patientGender: "male",
  accidentDate: "2023-09-14",
  accidentType: "Motor Vehicle Collision",
  accidentDescription: "Rear-end collision with immediate neck pain.",
  diagnosis: "Cervical strain",
  symptoms: "Neck pain and headache",
  medicalHistory: "",
  medications: "",
  timeline: "",
  medicalQuestion: "Did the collision materially cause the cervical strain?",
};

describe("caseFormSchema", () => {
  it("accepts a complete case without a patient name", () => {
    const parsed = caseFormSchema.safeParse(validCase);
    expect(parsed.success).toBe(true);
    expect(caseFormSchema.shape).not.toHaveProperty("patientName");
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("patientName");
    }
  });

  it("rejects missing and invalid required fields", () => {
    const parsed = caseFormSchema.safeParse({
      ...validCase,
      patientAge: "",
      accidentDate: "09/14/2023",
      medicalQuestion: "too short",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(
        expect.arrayContaining([
          "patientAge",
          "accidentDate",
          "medicalQuestion",
        ]),
      );
    }
  });
});
