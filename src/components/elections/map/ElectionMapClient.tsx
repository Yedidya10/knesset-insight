'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { trpc } from '@/lib/trpc';
import { appConfig } from '../../../../app.config';
import MapControls from './MapControls';
import NationalSummary from './NationalSummary';
import CityDetailPanel from './CityDetailPanel';
import type { ViewMode } from './IsraelMap';

// Dynamic import to avoid SSR issues with react-simple-maps
const IsraelMap = dynamic(() => import('./IsraelMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="bg-muted/30 flex h-125 items-center justify-center rounded-xl border sm:h-150 lg:h-175">
      <div className="bg-muted h-80 w-48 animate-pulse rounded-lg" />
    </div>
  );
}

interface ElectionMapClientProps {
  availableKnessets: number[];
}

export default function ElectionMapClient({
  availableKnessets,
}: ElectionMapClientProps) {
  const t = useTranslations('electionMap');
  const knessets =
    availableKnessets.length > 0
      ? availableKnessets
      : appConfig.electionMap.availableKnessets.slice();

  const [selectedKnesset, setSelectedKnesset] = useState(
    knessets[0] ?? appConfig.electionMap.defaultKnesset,
  );
  const [viewMode, setViewMode] = useState<ViewMode>('turnout');
  const [selectedCity, setSelectedCity] = useState<{
    code: string;
    name: string;
  } | null>(null);

  // Fetch district results for the map
  const districtResultsQuery = trpc.electionMap.districtResults.useQuery(
    { knessetNum: selectedKnesset },
    { staleTime: Infinity },
  );

  // Fetch national summary
  const nationalQuery = trpc.electionMap.nationalSummary.useQuery(
    { knessetNum: selectedKnesset },
    { staleTime: Infinity },
  );

  // Fetch district detail on selection (isDistrict: true)
  const cityDetailQuery = trpc.electionMap.cityDetail.useQuery(
    {
      knessetNum: selectedKnesset,
      cityCode: selectedCity?.code ?? '',
      isDistrict: true,
    },
    { enabled: !!selectedCity?.code, staleTime: Infinity },
  );

  // Transform district data into the format IsraelMap expects
  // The TopoJSON uses muni_code which matches districtCode (1-6)
  const mapData = useMemo(() => {
    if (!districtResultsQuery.data) return undefined;
    return districtResultsQuery.data.map((d) => ({
      cityCode: d.districtCode,
      cityName: '', // IsraelMap will use name_he from TopoJSON properties
      eligibleVoters: d.eligibleVoters,
      actualVoters: d.actualVoters,
      validVotes: d.validVotes,
      turnoutPercent: d.turnoutPercent,
    }));
  }, [districtResultsQuery.data]);

  const handleCityClick = useCallback((cityCode: string, cityName: string) => {
    setSelectedCity((prev) =>
      prev?.code === cityCode ? null : { code: cityCode, name: cityName },
    );
  }, []);

  const handleClose = useCallback(() => {
    setSelectedCity(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <MapControls
        availableKnessets={knessets}
        selectedKnesset={selectedKnesset}
        onKnessetChange={setSelectedKnesset}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Main layout: map + sidebar */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Map area */}
        <div className="min-w-0 flex-1">
          {mapData ? (
            <IsraelMap
              geoUrl={appConfig.electionMap.topoJsonPath}
              cities={mapData}
              viewMode={viewMode}
              colorRange={appConfig.electionMap.turnoutColorRange}
              onCityClick={handleCityClick}
              selectedCity={selectedCity?.code ?? null}
            />
          ) : districtResultsQuery.isLoading ? (
            <MapSkeleton />
          ) : (
            <div className="bg-muted/30 flex h-125 items-center justify-center rounded-xl border">
              <p className="text-muted-foreground text-sm">{t('noData')}</p>
            </div>
          )}
        </div>

        {/* Side panel: national summary or city detail */}
        <div className="w-full shrink-0 lg:w-80 xl:w-96">
          {selectedCity && cityDetailQuery.data ? (
            <CityDetailPanel
              cityName={selectedCity.name}
              cityCode={selectedCity.code}
              eligibleVoters={cityDetailQuery.data.eligibleVoters}
              actualVoters={cityDetailQuery.data.actualVoters}
              validVotes={cityDetailQuery.data.validVotes}
              invalidVotes={cityDetailQuery.data.invalidVotes}
              turnoutPercent={cityDetailQuery.data.turnoutPercent}
              parties={cityDetailQuery.data.parties}
              trends={[]}
              onClose={handleClose}
            />
          ) : nationalQuery.data ? (
            <NationalSummary
              totalEligible={nationalQuery.data.totalEligible}
              totalVoters={nationalQuery.data.totalVoters}
              totalValid={nationalQuery.data.totalValid}
              totalInvalid={nationalQuery.data.totalInvalid}
              turnoutPercent={nationalQuery.data.turnoutPercent}
              cityCount={nationalQuery.data.cityCount}
              topParties={nationalQuery.data.topParties}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
