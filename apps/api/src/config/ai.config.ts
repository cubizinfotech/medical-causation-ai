import type { AISettings } from './config.types';
import { providerConfig } from './provider.config';

/** @deprecated Use providerConfig() directly. Kept for backward compatibility. */
export const aiConfig = (): AISettings => providerConfig();
