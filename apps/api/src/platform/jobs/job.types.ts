/** BullMQ key prefixes. The braces keep each queue in one Redis Cluster slot. */
export const QUEUE_PREFIXES = {
  MCA: '{mca-bull}',
  EWI: '{ewi-bull}',
} as const;
