'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

interface CityMapData {
  cityCode: string;
  cityName: string;
  eligibleVoters: number;
  actualVoters: number;
  validVotes: number;
  turnoutPercent: number;
}

interface NationalData {
  totalEligible: number;
  totalVoters: number;
  totalValid: number;
  totalInvalid: number;
  turnoutPercent: number;
  cityCount: number;
  topParties: {
    ballotLetters: string;
    partyName: string;
    votes: number;
    percent: number;
  }[];
}

interface CityDetailData {
  cityCode: string;
  cityName: string;
  eligibleVoters: number;
  actualVoters: number;
  validVotes: number;
  invalidVotes: number;
  turnoutPercent: number;
  parties: {
    ballotLetters: string;
    partyName: string;
    votes: number;
    votePercent: number;
  }[];
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

  const [mapData, setMapData] = useState<CityMapData[] | undefined>();
  const [mapLoading, setMapLoading] = useState(true);
  const [nationalData, setNationalData] = useState<NationalData | null>(null);
  const [cityDetail, setCityDetail] = useState<CityDetailData | null>(null);

  const fetchIdRef = useRef(0);
  const detailIdRef = useRef(0);

  const fetchKnessetData = useCallback((knessetNum: number) => {
    const id = ++fetchIdRef.current;
    setMapLoading(true);
    setMapData(undefined);
    setNationalData(null);
    setSelectedCity(null);
    setCityDetail(null);

    Promise.all([
      trpc.electionMap.districtResults.query({ knessetNum }),
      trpc.electionMap.nationalSummary.query({ knessetNum }),
    ])
      .then(([districts, national]) => {
        if (id !== fetchIdRef.current) return;
        setMapData(
          districts.map((d) => ({
            cityCode: d.districtCode,
            cityName: '',
            eligibleVoters: d.eligibleVoters,
            actualVoters: d.actualVoters,
            validVotes: d.validVotes,
            turnoutPercent: d.turnoutPercent,
          })),
        );
        setNationalData(national);
        setMapLoading(false);
      })
      .catch(() => {
        if (id === fetchIdRef.current) setMapLoading(false);
      });
  }, []);

  // Initial fetch on mount
  const initialKnesset = knessets[0] ?? appConfig.electionMap.defaultKnesset;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchKnessetData(initialKnesset);
  }, []);

  const handleKnessetChange = useCallback(
    (knesset: number) => {
      setSelectedKnesset(knesset);
      fetchKnessetData(knesset);
    },
    [fetchKnessetData],
  );

  const fetchCityDetail = useCallback(
    (knessetNum: number, cityCode: string) => {
      const id = ++detailIdRef.current;
      trpc.electionMap.cityDetail
        .query({ knessetNum, cityCode, isDistrict: true })
        .then((data) => {
          if (id === detailIdRef.current) setCityDetail(data);
        })
        .catch(() => {
          if (id === detailIdRef.current) setCityDetail(null);
        });
    },
    [],
  );

  const handleCityClick = useCallback(
    (cityCode: string, cityName: string) => {
      setSelectedCity((prev) => {
        if (prev?.code === cityCode) {
          setCityDetail(null);
          return null;
        }
        fetchCityDetail(selectedKnesset, cityCode);
        return { code: cityCode, name: cityName };
      });
    },
    [selectedKnesset, fetchCityDetail],
  );

  const handleClose = useCallback(() => {
    setSelectedCity(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <MapControls
        availableKnessets={knessets}
        selectedKnesset={selectedKnesset}
        onKnessetChange={handleKnessetChange}
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
          ) : mapLoading ? (
            <MapSkeleton />
          ) : (
            <div className="bg-muted/30 flex h-125 items-center justify-center rounded-xl border">
              <p className="text-muted-foreground text-sm">{t('noData')}</p>
            </div>
          )}
        </div>

        {/* Side panel: national summary or city detail */}
        <div className="w-full shrink-0 lg:w-80 xl:w-96">
          {selectedCity && cityDetail ? (
            <CityDetailPanel
              cityName={selectedCity.name}
              cityCode={selectedCity.code}
              eligibleVoters={cityDetail.eligibleVoters}
              actualVoters={cityDetail.actualVoters}
              validVotes={cityDetail.validVotes}
              invalidVotes={cityDetail.invalidVotes}
              turnoutPercent={cityDetail.turnoutPercent}
              parties={cityDetail.parties}
              trends={[]}
              onClose={handleClose}
            />
          ) : nationalData ? (
            <NationalSummary
              totalEligible={nationalData.totalEligible}
              totalVoters={nationalData.totalVoters}
              totalValid={nationalData.totalValid}
              totalInvalid={nationalData.totalInvalid}
              turnoutPercent={nationalData.turnoutPercent}
              cityCount={nationalData.cityCount}
              topParties={nationalData.topParties}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
