import { appConfig } from '../../../app.config';

const ODATA_BASE = appConfig.dataSources.knessetOdata;

export type ODataService = 'ParliamentInfo' | 'Votes' | 'MMM';

interface ODataParams {
  $filter?: string;
  $top?: number;
  $skip?: number;
  $orderby?: string;
  $select?: string;
}

interface ODataResponse<T> {
  value: T[];
}

export async function fetchOData<T>(
  service: ODataService,
  entity: string,
  params: ODataParams = {},
): Promise<T[]> {
  const url = new URL(`${ODATA_BASE}/${service}.svc/${entity}`);
  url.searchParams.set('$format', 'json');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(
      `OData request failed: ${response.status} ${response.statusText} — ${url.pathname}`,
    );
  }

  const data: ODataResponse<T> = await response.json();
  return data.value;
}

/**
 * Fetch all pages of an OData entity with automatic pagination.
 */
export async function fetchAllOData<T>(
  service: ODataService,
  entity: string,
  params: ODataParams = {},
  pageSize = 1000,
): Promise<T[]> {
  const results: T[] = [];
  let skip = params.$skip ?? 0;

  while (true) {
    const page = await fetchOData<T>(service, entity, {
      ...params,
      $top: pageSize,
      $skip: skip,
    });

    results.push(...page);

    if (page.length < pageSize) break;
    skip += pageSize;
  }

  return results;
}

/**
 * Fetch entities updated after a given date (incremental sync).
 */
export async function fetchODataSince<T>(
  service: ODataService,
  entity: string,
  since: Date,
  dateField = 'LastUpdatedDate',
  extraParams: ODataParams = {},
): Promise<T[]> {
  const isoDate = since.toISOString().replace('Z', '');
  return fetchAllOData<T>(service, entity, {
    ...extraParams,
    $filter: `${dateField} gt datetime'${isoDate}'`,
    $orderby: `${dateField} desc`,
  });
}
