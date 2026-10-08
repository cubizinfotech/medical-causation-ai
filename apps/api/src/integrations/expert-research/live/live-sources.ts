import type {
  ExpertResearchProviderId,
  IExpertResearchProvider,
  ProviderDefinition,
} from '../expert-research.types';
import { CourtListenerClient } from './courtlistener.client';
import { CourtListenerResearchProvider } from './courtlistener.provider';
import { ExpertIdentityResolver } from './identity-resolver';
import { NpiRegistryClient } from './npi-registry.client';
import { NpiRegistryResearchProvider } from './npi-registry.provider';
import { OpenAlexClient } from './openalex.client';
import { OpenAlexResearchProvider } from './openalex.provider';
import { OpenPaymentsClient } from './open-payments.client';
import { OpenPaymentsResearchProvider } from './open-payments.provider';

export interface LiveSourceSettings {
  timeoutMs: number;
  courtListenerToken?: string;
  courtListenerTimeoutMs?: number;
  openAlexApiKey?: string;
  openAlexMailto?: string;
  openPaymentsYears?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Real adapters for the connected public sources. They share one identity
 * resolver so every source uses the same confirmed NPI record.
 */
export function createLiveSourceProviders(
  definitions: readonly ProviderDefinition[],
  settings: LiveSourceSettings,
): Map<ExpertResearchProviderId, IExpertResearchProvider> {
  const fetchImpl = settings.fetchImpl;
  const resolver = new ExpertIdentityResolver(
    new NpiRegistryClient({ timeoutMs: settings.timeoutMs, fetchImpl }),
  );
  const byId = new Map(definitions.map((entry) => [entry.id, entry]));
  const providers = new Map<
    ExpertResearchProviderId,
    IExpertResearchProvider
  >();
  const definition = (id: ExpertResearchProviderId) => byId.get(id);

  const npi = definition('npi_registry');
  if (npi) {
    providers.set(npi.id, new NpiRegistryResearchProvider(npi, resolver));
  }
  const payments = definition('open_payments');
  if (payments) {
    providers.set(
      payments.id,
      new OpenPaymentsResearchProvider(
        payments,
        resolver,
        new OpenPaymentsClient({ timeoutMs: settings.timeoutMs, fetchImpl }),
        settings.openPaymentsYears ?? 7,
      ),
    );
  }
  const openalex = definition('openalex');
  if (openalex) {
    providers.set(
      openalex.id,
      new OpenAlexResearchProvider(
        openalex,
        resolver,
        new OpenAlexClient({
          timeoutMs: settings.timeoutMs,
          fetchImpl,
          apiKey: settings.openAlexApiKey,
          mailto: settings.openAlexMailto,
        }),
      ),
    );
  }
  const courts = definition('courtlistener');
  if (courts) {
    providers.set(
      courts.id,
      new CourtListenerResearchProvider(
        courts,
        resolver,
        new CourtListenerClient({
          timeoutMs: settings.courtListenerTimeoutMs ?? 60000,
          fetchImpl,
          token: settings.courtListenerToken,
        }),
      ),
    );
  }
  return providers;
}
