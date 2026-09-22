import type { CaseFormValues } from "./schemas/case-form.schema";

export interface DemoCaseExample {
  id: string;
  title: string;
  summary: string;
  values: CaseFormValues;
}

/** Rotating demo cases — cycled by "Load Example Case" on the intake form. */
export const demoCaseExamples: DemoCaseExample[] = [
  {
    id: "anderson-mtbi-stroke",
    title: "John Anderson — mTBI → Stroke (5 months)",
    summary: "Rear-end MVA with brief LOC; ischemic stroke five months later.",
    values: {
      patientName: "John Anderson",
      patientAge: "47",
      patientGender: "male",
      accidentDate: "2024-08-14",
      accidentType: "Motor Vehicle Collision",
      accidentDescription:
        "The patient was involved in a rear-end motor vehicle collision while stopped at a traffic light. His head struck the driver's side window, resulting in a brief loss of consciousness lasting approximately one minute. He was transported to the emergency department where he was diagnosed with a mild traumatic brain injury (concussion). CT imaging showed no acute intracranial hemorrhage, and he was discharged after observation.",
      diagnosis:
        "Mild Traumatic Brain Injury (Concussion); Ischemic Stroke (diagnosed 5 months after the accident)",
      symptoms:
        "Immediately after the accident:\n• Headache\n• Dizziness\n• Confusion\n• Memory problems\n• Neck pain\n\nOver the following months:\n• Persistent headaches\n• Difficulty concentrating\n• Fatigue\n• Occasional numbness in the left arm\n\nFive months later:\n• Sudden left-sided weakness\n• Slurred speech\n• Facial drooping\n\nHospital evaluation confirmed an ischemic stroke.",
      medicalHistory:
        "No previous history of stroke.\n\nMild hypertension controlled with medication.\n\nNon-smoker.\n\nNo diabetes.\n\nNo previous traumatic brain injury.\n\nNo significant neurological disorders.",
      medications:
        "Lisinopril 10 mg daily\n\nAspirin 81 mg daily\n\nAtorvastatin 20 mg daily",
      timeline:
        "14 Aug 2024 — Motor vehicle accident.\n\n14 Aug 2024 — Diagnosed with mild traumatic brain injury.\n\nAug–Dec 2024 — Persistent headaches, dizziness, cognitive issues.\n\n15 Jan 2025 — Sudden onset of left-sided weakness and slurred speech.\n\n16 Jan 2025 — MRI confirmed ischemic stroke.\n\nCurrent — Neurological rehabilitation and ongoing follow-up.",
      medicalQuestion:
        "Can the patient's mild traumatic brain injury sustained during the motor vehicle accident have medically contributed to the ischemic stroke diagnosed approximately five months later? Please evaluate supporting and opposing medical evidence using peer-reviewed literature and explain whether a causal relationship is medically plausible.",
    },
  },
  {
    id: "chen-mtbi-stroke",
    title: "Robert Chen — mTBI → Stroke (18 days)",
    summary: "Pickup rear-end collision; stroke diagnosed 18 days post-impact.",
    values: {
      patientName: "Robert Chen",
      patientAge: "52",
      patientGender: "male",
      accidentDate: "2023-09-14",
      accidentType: "Motor Vehicle Collision",
      accidentDescription:
        "On September 14, 2023, Mr. Chen was the restrained driver of a sedan stopped at a red light when his vehicle was rear-ended by a full-size pickup truck traveling approximately 35 mph. His head struck the headrest during the impact (whiplash mechanism). He was ambulatory at the scene, declined ambulance transport, and went home. No loss of consciousness was reported at the scene, though his wife noted he was dazed and repeatedly asked the same questions for several hours afterward.",
      diagnosis:
        "Acute ischemic stroke (left middle cerebral artery territory), diagnosed 18 days post-collision. Prior imaging showed no prior cerebrovascular disease. Mild traumatic brain injury (concussion) sustained in the motor vehicle collision.",
      symptoms:
        "Immediate: neck pain, headache, dizziness, difficulty concentrating, photophobia, and brief confusion for approximately 6 hours post-impact.\n\nDays 1–14: persistent headaches, memory difficulty, irritability, sleep disturbance, and slowed processing at work.\n\nDay 18: sudden onset right-sided weakness, facial droop, and slurred speech — presented to ED; CT angiography confirmed left MCA ischemic stroke.",
      medicalHistory:
        "Hypertension (controlled on lisinopril 10 mg daily). Hyperlipidemia. No prior stroke, TIA, or intracranial hemorrhage. Non-smoker. Family history of stroke in father (age 68).",
      medications:
        "Lisinopril 10 mg daily, atorvastatin 20 mg daily, aspirin 81 mg daily (started after stroke).",
      timeline:
        "2023-09-14 — Motor vehicle rear-end collision; acute headache, confusion, neck pain.\n2023-09-15 — Urgent care visit; diagnosed cervical strain and concussion; advised rest.\n2023-09-20 — Return to desk work; persistent cognitive fog and headaches.\n2023-10-02 — Sudden right hemiparesis and dysarthria; EMS transport; ischemic stroke confirmed.\n2023-10-03 — Neurology consult; stroke workup negative for cardioembolic source on initial evaluation.",
      medicalQuestion:
        "Did the mild traumatic brain injury sustained in the September 14, 2023 motor vehicle collision materially contribute to the development of the ischemic stroke diagnosed on October 2, 2023?",
    },
  },
  {
    id: "martinez-cervical-mva",
    title: "Elena Martinez — Cervical Strain (MVA)",
    summary: "T-bone collision with delayed cervical radiculopathy presentation.",
    values: {
      patientName: "Elena Martinez",
      patientAge: "38",
      patientGender: "female",
      accidentDate: "2024-03-22",
      accidentType: "Motor Vehicle Collision",
      accidentDescription:
        "Ms. Martinez was the belted driver of a compact SUV struck on the driver's side by another vehicle that ran a stop sign (T-bone mechanism). Airbags deployed. She reported immediate left neck and shoulder pain, headache, and left arm tingling at the scene. She was evaluated in the ED, cervical spine CT was negative for fracture, and she was discharged with a cervical collar and analgesics.",
      diagnosis:
        "Cervical strain/sprain with left C6 radiculopathy; post-traumatic headache. No prior cervical spine surgery.",
      symptoms:
        "Acute (day of accident): left neck pain (6/10), left trapezial spasm, headache, intermittent paresthesia in left thumb and index finger.\n\nWeek 1–4: worsening neck stiffness, pain radiating to left arm, difficulty sleeping, reduced range of motion.\n\nWeek 6: EMG/NCS consistent with left C6 radiculopathy; MRI cervical spine showed C5–C6 disc protrusion contacting the left ventral nerve root.",
      medicalHistory:
        "Prior mild low back pain (resolved 2019). No prior neck surgery. Office worker. Non-smoker. BMI 26. No anticoagulation.",
      medications: "Ibuprofen 600 mg TID PRN; cyclobenzaprine 10 mg at bedtime (started post-accident).",
      timeline:
        "2024-03-22 — T-bone motor vehicle collision; ED evaluation; cervical strain diagnosed.\n2024-03-25 — Primary care follow-up; persistent radicular symptoms.\n2024-04-08 — Physical therapy initiated (6 sessions completed).\n2024-05-02 — MRI cervical spine; C5–C6 disc protrusion with left-sided radiculopathy.\n2024-05-10 — Orthopedic spine consult; causation and treatment plan discussed.",
      medicalQuestion:
        "Is the cervical disc protrusion and left C6 radiculopathy at C5–C6 causally related to the March 22, 2024 motor vehicle collision, as opposed to pre-existing degenerative disease?",
    },
  },
  {
    id: "walsh-workplace-fall",
    title: "David Walsh — Lumbar Disc (Workplace Fall)",
    summary: "Warehouse ladder fall with delayed lumbar herniation diagnosis.",
    values: {
      patientName: "David Walsh",
      patientAge: "44",
      patientGender: "male",
      accidentDate: "2023-11-03",
      accidentType: "Workplace Accident",
      accidentDescription:
        "Mr. Walsh, a warehouse supervisor, fell approximately 8 feet from a fixed ladder when the ladder shifted on a wet concrete floor. He landed on his buttocks and lower back. Coworkers noted immediate complaints of severe low back pain and inability to stand fully upright. He was transported by EMS to the hospital; lumbar X-rays showed no fracture. He was discharged with work restrictions and referred to occupational medicine.",
      diagnosis:
        "Lumbar disc herniation at L4–L5 with left L5 radiculopathy; lumbar strain. No prior lumbar surgery.",
      symptoms:
        "Immediate: severe lower back pain (8/10), muscle spasm, difficulty ambulating.\n\nDays 3–14: pain radiating to left posterior thigh and lateral calf, numbness in left foot dorsum, positive straight leg raise on left.\n\nWeek 4: MRI lumbar spine — L4–L5 posterolateral disc extrusion with left nerve root compression.",
      medicalHistory:
        "Intermittent low back discomfort over 10 years (never required imaging or surgery). Hypertension. Former smoker (quit 2018). No diabetes.",
      medications:
        "Naproxen 500 mg BID; gabapentin 300 mg TID (started after radiculopathy confirmed); lisinopril 20 mg daily.",
      timeline:
        "2023-11-03 — Fall from ladder at workplace; ED evaluation; lumbar strain diagnosed.\n2023-11-06 — Occupational medicine; modified duty, PT ordered.\n2023-11-20 — Worsening radicular symptoms; MRI scheduled.\n2023-12-01 — MRI confirms L4–L5 disc herniation with left L5 radiculopathy.\n2023-12-15 — Epidural steroid injection; partial improvement.",
      medicalQuestion:
        "Did the November 3, 2023 workplace ladder fall materially contribute to the L4–L5 disc herniation and left L5 radiculopathy, given the patient's history of intermittent low back pain?",
    },
  },
];

/** @deprecated Use demoCaseExamples[0] or cycle via getNextDemoCaseExample */
export const demoCaseExample = demoCaseExamples[0]!.values;

export function getDemoCaseExample(index: number): DemoCaseExample {
  const normalized = ((index % demoCaseExamples.length) + demoCaseExamples.length) % demoCaseExamples.length;
  return demoCaseExamples[normalized]!;
}
