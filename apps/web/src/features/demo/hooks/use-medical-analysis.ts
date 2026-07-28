"use client";

import { useMutation } from "@tanstack/react-query";
import {
  medicalAnalysisClient,
  type AnalyzeCaseRequest,
  type MedicalAnalysisResult,
} from "@/features/medical-analysis";

export function useMedicalAnalysis() {
  return useMutation<MedicalAnalysisResult, Error, AnalyzeCaseRequest>({
    mutationFn: (request) => medicalAnalysisClient.analyze(request),
  });
}
