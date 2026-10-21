import type {
  ExpertResearchProviderId,
  IExpertResearchProvider,
  ProviderDefinition,
} from '../expert-research.types';
import { CourtListenerClient } from './courtlistener.client';
import { CourtListenerResearchProvider } from './courtlistener.provider';
import { FloridaLicenseResearchProvider } from './florida-license.provider';
import { FloridaMqaClient } from './florida-mqa.client';
import { ExpertIdentityResolver } from './identity-resolver';
import { JustiaResearchProvider } from './justia.provider';
import { NihReporterResearchProvider } from './nih-reporter.provider';
import { PubMedResearchProvider } from './pubmed.provider';
import { NpiRegistryClient } from './npi-registry.client';
import { NpiRegistryResearchProvider } from './npi-registry.provider';
import { OpenAlexClient } from './openalex.client';
import { OpenAlexResearchProvider } from './openalex.provider';
import { OpenPaymentsClient } from './open-payments.client';
import { OpenPaymentsResearchProvider } from './open-payments.provider';
import { createWebSourceProviders } from '../../web-research/web-source-providers';
import type { WebResearchEngine } from '../../web-research/web-research-engine';
import { OrcidClient } from './orcid.client';
import { OrcidResearchProvider } from './orcid.provider';

export interface LiveSourceSettings {
  timeoutMs: number;
  courtListenerToken?: string;
  courtListenerTimeoutMs?: number;
  openAlexApiKey?: string;
  openAlexMailto?: string;
  crossrefMailto?: string;
  openPaymentsYears?: number;
  pubmedApiKey?: string;
  pubmedEmail?: string;
  orcidClientId?: string;
  orcidClientSecret?: string;
  fetchImpl?: typeof fetch;
  /** Shared web research run. When set, web-backed catalog sources are live. */
  webEngine?: WebResearchEngine;
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
  const justia = definition('justia');
  if (justia) {
    providers.set(
      justia.id,
      new JustiaResearchProvider(justia, fetchImpl, settings.timeoutMs),
    );
  }
  const pubmed = definition('pubmed');
  if (pubmed) {
    providers.set(
      pubmed.id,
      new PubMedResearchProvider(
        pubmed,
        fetchImpl,
        settings.timeoutMs,
        settings.pubmedApiKey,
        settings.pubmedEmail,
      ),
    );
  }
  const grants = definition('grants');
  if (grants) {
    providers.set(
      grants.id,
      new NihReporterResearchProvider(grants, fetchImpl, settings.timeoutMs),
    );
  }
  const orcid = definition('orcid');
  if (orcid) {
    providers.set(
      orcid.id,
      new OrcidResearchProvider(
        orcid,
        new OrcidClient({
          timeoutMs: settings.timeoutMs,
          fetchImpl,
          clientId: settings.orcidClientId,
          clientSecret: settings.orcidClientSecret,
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
  const mqa = new FloridaMqaClient(fetchImpl ?? fetch, settings.timeoutMs);
  const license = definition('state_license');
  if (license) {
    providers.set(
      license.id,
      new FloridaLicenseResearchProvider(license, resolver, mqa, 'license'),
    );
  }
  const discipline = definition('state_discipline');
  if (discipline) {
    providers.set(
      discipline.id,
      new FloridaLicenseResearchProvider(
        discipline,
        resolver,
        mqa,
        'discipline',
      ),
    );
  }
  // Web-backed sources fill catalog ids that do not already have a dedicated
  // adapter. Justia and CourtListener keep their own searches.
  if (settings.webEngine) {
    for (const [id, provider] of createWebSourceProviders(
      definitions,
      settings.webEngine,
    )) {
      if (!providers.has(id)) providers.set(id, provider);
    }
  }
  return providers;
}
