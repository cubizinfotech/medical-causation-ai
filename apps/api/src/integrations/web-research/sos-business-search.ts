/**
 * Public Secretary of State / business-entity search entry points by US state.
 * These are deep-links for attorneys to open official registries. They are not
 * a completed SOS login or scrape; portals often block automated agents.
 */
const SOS_SEARCH_URL: Record<string, string> = {
  AL: 'https://arc-sos.state.al.us/CGI/CORPNAME.MBR/INPUT',
  AK: 'https://www.commerce.alaska.gov/cbp/main/search/entities',
  AZ: 'https://ecorp.azcc.gov/EntitySearch/Index',
  AR: 'https://www.sos.arkansas.gov/business-commercial-services-bcs/search-records',
  CA: 'https://bizfileonline.sos.ca.gov/search/business',
  CO: 'https://www.coloradosos.gov/biz/BusinessEntityCriteriaExt.do',
  CT: 'https://service.ct.gov/business/s/onlinebusinesssearch',
  DE: 'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx',
  DC: 'https://corponline.dcra.dc.gov/Home.aspx',
  FL: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByName',
  GA: 'https://ecorp.sos.ga.gov/BusinessSearch',
  HI: 'https://hbe.ehawaii.gov/documents/search.html',
  ID: 'https://sosbiz.idaho.gov/search/business',
  IL: 'https://apps.ilsos.gov/businessentitysearch/',
  IN: 'https://bsd.sos.in.gov/publicbusinesssearch',
  IA: 'https://sos.iowa.gov/search/business/search.aspx',
  KS: 'https://www.kansas.gov/bess/',
  KY: 'https://web.sos.ky.gov/ftsearch/',
  LA: 'https://coraweb.sos.la.gov/CommercialSearch/CommercialSearch.aspx',
  ME: 'https://icrs.informe.org/nei-sos-icrs/ICRS?MainPage=x',
  MD: 'https://egov.maryland.gov/BusinessExpress/EntitySearch',
  MA: 'https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx',
  MI: 'https://cofs.lara.state.mi.us/SearchApi/Search/Search',
  MN: 'https://mblsportal.sos.state.mn.us/Business/Search',
  MS: 'https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx',
  MO: 'https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx',
  MT: 'https://biz.sosmt.gov/search',
  NE: 'https://www.nebraska.gov/sos/cc/index.cgi',
  NV: 'https://esos.nv.gov/EntitySearch/OnlineEntitySearch',
  NH: 'https://quickstart.sos.nh.gov/online/BusinessInquire',
  NJ: 'https://www.njportal.com/DOR/BusinessNameSearch',
  NM: 'https://enterprise.sos.nm.gov/search',
  NY: 'https://apps.dos.ny.gov/publicInquiry/',
  NC: 'https://www.sosnc.gov/online_services/search/by_title/_Business_Registration',
  ND: 'https://firststop.sos.nd.gov/search/business',
  OH: 'https://businesssearch.ohiosos.gov/',
  OK: 'https://www.sos.ok.gov/corp/corpInquiryFind.aspx',
  OR: 'https://sos.oregon.gov/business/Pages/find.aspx',
  PA: 'https://file.dos.pa.gov/search/business',
  RI: 'https://business.sos.ri.gov/CorpWeb/CorpSearch/CorpSearch.aspx',
  SC: 'https://businessfilings.sc.gov/BusinessFiling/Entity/Search',
  SD: 'https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx',
  TN: 'https://tnbear.tn.gov/Ecommerce/FilingSearch.aspx',
  TX: 'https://www.sos.state.tx.us/corp/sosda/index.shtml',
  UT: 'https://businessregistration.utah.gov/EntitySearch/OnlineEntitySearch',
  VT: 'https://bizfilings.vermont.gov/online/BusinessInquire',
  VA: 'https://cis.scc.virginia.gov/EntitySearch/Index',
  WA: 'https://ccfs.sos.wa.gov/',
  WV: 'https://apps.sos.wv.gov/business/corporations/',
  WI: 'https://www.wdfi.org/apps/CorpSearch/Search.aspx',
  WY: 'https://wyobiz.wyo.gov/Business/FilingSearch.aspx',
};

export function sosBusinessSearchUrl(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null;
  return SOS_SEARCH_URL[stateCode.toUpperCase()] ?? null;
}

export interface SosDeepLink {
  state: string;
  entityName: string;
  searchUrl: string;
}

/**
 * Official SOS search links for entity names and the expert’s practice /
 * license states. Practice websites are never treated as SOS proof.
 */
export function sosDeepLinksFor(
  entityNames: readonly string[],
  stateCodes: readonly string[],
): SosDeepLink[] {
  const links: SosDeepLink[] = [];
  const seen = new Set<string>();
  for (const state of stateCodes) {
    const searchUrl = sosBusinessSearchUrl(state);
    if (!searchUrl) continue;
    for (const entityName of entityNames) {
      const name = entityName.trim();
      if (name.length < 2) continue;
      const key = `${state}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ state: state.toUpperCase(), entityName: name, searchUrl });
    }
  }
  return links.slice(0, 24);
}
