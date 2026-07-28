# Demo Case Examples

Use **Load Example Case** on the [case intake form](http://localhost:3000/case) to cycle through four pre-filled scenarios. Each click loads the next example.

---

## 1. John Anderson — mTBI → Stroke (5 months)

| Field | Value |
|-------|-------|
| **Name** | John Anderson |
| **Age** | 47 |
| **Gender** | Male |
| **Accident Date** | 2024-08-14 |
| **Accident Type** | Motor Vehicle Collision |

**Medical Question:** Can the patient's mild traumatic brain injury sustained during the motor vehicle accident have medically contributed to the ischemic stroke diagnosed approximately five months later?

---

## 2. Robert Chen — mTBI → Stroke (18 days)

| Field | Value |
|-------|-------|
| **Name** | Robert Chen |
| **Age** | 52 |
| **Gender** | Male |
| **Accident Date** | 2023-09-14 |
| **Accident Type** | Motor Vehicle Collision |

**Medical Question:** Did the mild TBI from the September 14, 2023 collision materially contribute to the ischemic stroke diagnosed on October 2, 2023?

---

## 3. Elena Martinez — Cervical Strain (MVA)

| Field | Value |
|-------|-------|
| **Name** | Elena Martinez |
| **Age** | 38 |
| **Gender** | Female |
| **Accident Date** | 2024-03-22 |
| **Accident Type** | Motor Vehicle Collision |

**Medical Question:** Is the cervical disc protrusion and left C6 radiculopathy causally related to the March 22, 2024 motor vehicle collision?

---

## 4. David Walsh — Lumbar Disc (Workplace Fall)

| Field | Value |
|-------|-------|
| **Name** | David Walsh |
| **Age** | 44 |
| **Gender** | Male |
| **Accident Date** | 2023-11-03 |
| **Accident Type** | Workplace Accident |

**Medical Question:** Did the November 3, 2023 workplace ladder fall materially contribute to the L4–L5 disc herniation and left L5 radiculopathy?

---

## Full field values (John Anderson)

Copy-paste reference for the first example:

```json
{
  "patientName": "John Anderson",
  "patientAge": "47",
  "patientGender": "male",
  "accidentDate": "2024-08-14",
  "accidentType": "Motor Vehicle Collision",
  "accidentDescription": "The patient was involved in a rear-end motor vehicle collision while stopped at a traffic light. His head struck the driver's side window, resulting in a brief loss of consciousness lasting approximately one minute. He was transported to the emergency department where he was diagnosed with a mild traumatic brain injury (concussion). CT imaging showed no acute intracranial hemorrhage, and he was discharged after observation.",
  "diagnosis": "Mild Traumatic Brain Injury (Concussion); Ischemic Stroke (diagnosed 5 months after the accident)",
  "symptoms": "Immediately after the accident:\n• Headache\n• Dizziness\n• Confusion\n• Memory problems\n• Neck pain\n\nOver the following months:\n• Persistent headaches\n• Difficulty concentrating\n• Fatigue\n• Occasional numbness in the left arm\n\nFive months later:\n• Sudden left-sided weakness\n• Slurred speech\n• Facial drooping\n\nHospital evaluation confirmed an ischemic stroke.",
  "medicalHistory": "No previous history of stroke.\n\nMild hypertension controlled with medication.\n\nNon-smoker.\n\nNo diabetes.\n\nNo previous traumatic brain injury.\n\nNo significant neurological disorders.",
  "medications": "Lisinopril 10 mg daily\n\nAspirin 81 mg daily\n\nAtorvastatin 20 mg daily",
  "timeline": "14 Aug 2024 — Motor vehicle accident.\n\n14 Aug 2024 — Diagnosed with mild traumatic brain injury.\n\nAug–Dec 2024 — Persistent headaches, dizziness, cognitive issues.\n\n15 Jan 2025 — Sudden onset of left-sided weakness and slurred speech.\n\n16 Jan 2025 — MRI confirmed ischemic stroke.\n\nCurrent — Neurological rehabilitation and ongoing follow-up.",
  "medicalQuestion": "Can the patient's mild traumatic brain injury sustained during the motor vehicle accident have medically contributed to the ischemic stroke diagnosed approximately five months later? Please evaluate supporting and opposing medical evidence using peer-reviewed literature and explain whether a causal relationship is medically plausible."
}
```

*Fictional composite cases for demonstration only — not medical or legal advice.*
