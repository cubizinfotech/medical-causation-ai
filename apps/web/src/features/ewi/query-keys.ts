export const ewiKeys = {
  histories: ["ewi", "histories"] as const,
  history: (id: string) => ["ewi", "history", id] as const,
  job: (jobId: string) => ["ewi", "job", jobId] as const,
};
