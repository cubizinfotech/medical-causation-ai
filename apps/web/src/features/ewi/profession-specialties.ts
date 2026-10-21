/**
 * Suggestion list for Specialty / Profession. The intake field still accepts
 * any typed value; nothing here is required or used to reject a profession.
 */

export interface ProfessionSuggestion {
  label: string;
  category: ProfessionCategory;
}

export const PROFESSION_CATEGORIES = [
  "Medical and healthcare",
  "Psychology and behavioral health",
  "Legal and forensic",
  "Engineering and technology",
  "Finance, accounting, and economics",
  "Business and management",
  "Education and academia",
  "Construction, architecture, and real estate",
  "Science and research",
  "Other professional services",
] as const;

export type ProfessionCategory = (typeof PROFESSION_CATEGORIES)[number];

const byCategory: Record<ProfessionCategory, readonly string[]> = {
  "Medical and healthcare": [
    "Physician",
    "Surgeon",
    "Nurse",
    "Nurse Practitioner",
    "Physician Assistant",
    "Anesthesiology",
    "Cardiology",
    "Dermatology",
    "Emergency Medicine",
    "Family Practice",
    "Internal Medicine",
    "Neurology",
    "Neurosurgery",
    "Obstetrics and Gynecology",
    "Oncology",
    "Ophthalmology",
    "Orthopedic Surgery",
    "Otolaryngology",
    "Pain Management",
    "Pathology",
    "Pediatrics",
    "Physical Medicine and Rehabilitation",
    "Plastic Surgery",
    "Pulmonology",
    "Radiology",
    "Rheumatology",
    "Toxicology",
    "Vascular Surgery",
    "Chiropractor",
    "Dentist",
    "Pharmacist",
    "Physical Therapist",
    "Occupational Therapist",
    "Speech-Language Pathologist",
    "Life Care Planner",
  ],
  "Psychology and behavioral health": [
    "Psychologist",
    "Neuropsychologist",
    "Clinical Psychologist",
    "Forensic Psychologist",
    "Psychiatrist",
    "Counselor",
    "Social Worker",
    "Vocational Expert",
  ],
  "Legal and forensic": [
    "Attorney",
    "Trial Attorney",
    "Criminal Defense Attorney",
    "Plaintiff Attorney",
    "Judge",
    "Paralegal",
    "Forensic Scientist",
    "Forensic Pathologist",
    "Crime Scene Analyst",
    "Handwriting Examiner",
    "Accident Reconstructionist",
    "Fire Investigator",
    "Digital Forensics Examiner",
  ],
  "Engineering and technology": [
    "Engineer",
    "Civil Engineer",
    "Mechanical Engineer",
    "Electrical Engineer",
    "Structural Engineer",
    "Chemical Engineer",
    "Biomedical Engineer",
    "Software Engineer",
    "Computer Scientist",
    "Safety Engineer",
    "Human Factors Engineer",
  ],
  "Finance, accounting, and economics": [
    "Accountant",
    "Certified Public Accountant",
    "Economist",
    "Forensic Economist",
    "Forensic Accountant",
    "Actuary",
    "Financial Analyst",
    "Appraiser",
    "Auditor",
  ],
  "Business and management": [
    "Business Consultant",
    "Management Consultant",
    "Human Resources Consultant",
    "Damages Expert",
    "Economist Consultant",
    "Industry Analyst",
  ],
  "Education and academia": [
    "Professor",
    "Teacher",
    "School Administrator",
    "Academic Researcher",
    "Education Consultant",
  ],
  "Construction, architecture, and real estate": [
    "Architect",
    "General Contractor",
    "Construction Manager",
    "Building Inspector",
    "Land Surveyor",
    "Real Estate Appraiser",
    "Interior Designer",
  ],
  "Science and research": [
    "Scientist",
    "Chemist",
    "Biologist",
    "Epidemiologist",
    "Statistician",
    "Meteorologist",
    "Environmental Scientist",
  ],
  "Other professional services": [
    "Expert Witness",
    "Translator",
    "Interpreter",
    "Ethicist",
    "Police Officer",
    "Private Investigator",
    "Marine Surveyor",
    "Pilot",
    "Licensed Electrician",
    "Plumber",
  ],
};

export const PROFESSION_SPECIALTIES: readonly ProfessionSuggestion[] =
  PROFESSION_CATEGORIES.flatMap((category) =>
    byCategory[category].map((label) => ({ label, category })),
  );

export const PROFESSION_SPECIALTY_LABELS: readonly string[] =
  PROFESSION_SPECIALTIES.map((item) => item.label);

const MAX_MATCHES = 40;

/**
 * Case-insensitive partial matches, in list order, capped so a one-letter
 * query does not dump the whole catalog.
 */
export function filterProfessionSuggestions(
  query: string,
  items: readonly ProfessionSuggestion[] = PROFESSION_SPECIALTIES,
  limit = MAX_MATCHES,
): ProfessionSuggestion[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches: ProfessionSuggestion[] = [];
  for (const item of items) {
    if (item.label.toLowerCase().includes(needle)) {
      matches.push(item);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

export function groupProfessionSuggestions(
  items: readonly ProfessionSuggestion[],
): Array<{ category: ProfessionCategory | string; items: ProfessionSuggestion[] }> {
  const groups: Array<{
    category: ProfessionCategory | string;
    items: ProfessionSuggestion[];
  }> = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const existing = index.get(item.category);
    if (existing === undefined) {
      index.set(item.category, groups.length);
      groups.push({ category: item.category, items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }
  return groups;
}
