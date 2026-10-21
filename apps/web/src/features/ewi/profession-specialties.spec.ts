import {
  PROFESSION_CATEGORIES,
  PROFESSION_SPECIALTIES,
  filterProfessionSuggestions,
  groupProfessionSuggestions,
} from "./profession-specialties";

describe("profession specialty suggestions", () => {
  it("covers every requested category and includes medical and legal examples", () => {
    const categories = new Set(PROFESSION_SPECIALTIES.map((item) => item.category));
    for (const category of PROFESSION_CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }
    const labels = PROFESSION_SPECIALTIES.map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(["Neuropsychologist", "Attorney", "Engineer"]));
  });

  it("filters by partial, case-insensitive text and not by an empty query", () => {
    expect(filterProfessionSuggestions("")).toEqual([]);
    expect(
      filterProfessionSuggestions("attor").map((item) => item.label),
    ).toEqual(expect.arrayContaining(["Attorney"]));
    expect(
      filterProfessionSuggestions("ENGINEER").map((item) => item.label),
    ).toEqual(
      expect.arrayContaining(["Engineer", "Civil Engineer", "Mechanical Engineer"]),
    );
  });

  it("does not require an uncommon profession to be in the list", () => {
    expect(filterProfessionSuggestions("Marine surveyor extraordinaire")).toEqual(
      [],
    );
  });

  it("groups matches by category", () => {
    const grouped = groupProfessionSuggestions(
      filterProfessionSuggestions("forensic"),
    );
    expect(grouped.some((group) => group.category === "Legal and forensic")).toBe(
      true,
    );
  });
});
