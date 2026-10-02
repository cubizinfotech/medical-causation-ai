import {
  loadCaseForm,
  normalizeCaseForm,
  saveCaseForm,
  STORAGE_KEYS,
} from "./case-storage";

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe("case form persistence", () => {
  beforeEach(() => {
    Object.defineProperty(global, "window", {
      value: globalThis,
      configurable: true,
    });
    Object.defineProperty(global, "sessionStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(global, "window");
    Reflect.deleteProperty(global, "sessionStorage");
  });

  it("drops a legacy patient name and reloads the saved fields", () => {
    sessionStorage.setItem(
      STORAGE_KEYS.case,
      JSON.stringify({
        patientName: "Should not remain",
        patientAge: "52",
        patientGender: "female",
        accidentDate: "2024-01-02",
        accidentType: "Slip and Fall",
        accidentDescription: "Slipped on a wet floor at work.",
        diagnosis: "Lumbar strain",
        symptoms: "Low back pain",
        medicalQuestion: "Did the fall cause the lumbar strain?",
      }),
    );

    const loaded = loadCaseForm();
    expect(loaded?.patientAge).toBe("52");
    expect(loaded?.medicalQuestion).toBe(
      "Did the fall cause the lumbar strain?",
    );
    expect(loaded).not.toHaveProperty("patientName");

    saveCaseForm({ patientAge: "52" });
    expect(
      JSON.parse(sessionStorage.getItem(STORAGE_KEYS.case) ?? "{}"),
    ).not.toHaveProperty("patientName");
  });

  it("keeps fields that are omitted from a later partial save", () => {
    saveCaseForm({
      patientAge: "44",
      patientGender: "male",
      diagnosis: "Cervical strain",
      medicalQuestion: "Did the collision cause the strain?",
    });
    saveCaseForm({ patientAge: "45" });

    expect(loadCaseForm()).toEqual(
      expect.objectContaining({
        patientAge: "45",
        diagnosis: "Cervical strain",
        medicalQuestion: "Did the collision cause the strain?",
      }),
    );
  });

  it("ignores a non-string patient name when normalizing", () => {
    expect(
      normalizeCaseForm({
        patientAge: "38",
        patientName: "Hidden",
      } as never).patientAge,
    ).toBe("38");
  });
});
