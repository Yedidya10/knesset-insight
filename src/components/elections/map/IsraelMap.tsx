'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { scaleSequential } from 'd3-scale';
import { interpolateRgb } from 'd3-interpolate';
import MapTooltip from './MapTooltip';
import MapLegend from './MapLegend';

export type ViewMode = 'turnout' | 'winningParty' | 'comparison';

interface CityData {
  cityCode: string;
  cityName: string;
  eligibleVoters: number;
  actualVoters: number;
  validVotes: number;
  turnoutPercent: number;
}

interface IsraelMapProps {
  geoUrl: string;
  cities: CityData[];
  viewMode: ViewMode;
  colorRange: readonly [string, string];
  onCityClick: (cityCode: string, cityName: string) => void;
  selectedCities: string[];
  overseasVoters?: number;
  isOverseasSelected?: boolean;
  onOverseasClick?: () => void;
}

interface TooltipState {
  x: number;
  y: number;
  cityName: string;
  turnoutPercent: number;
  eligibleVoters: number;
  actualVoters: number;
}

export default function IsraelMap({
  geoUrl,
  cities,
  viewMode,
  colorRange,
  onCityClick,
  selectedCities,
  overseasVoters,
  isOverseasSelected,
  onOverseasClick,
}: IsraelMapProps) {
  const t = useTranslations('electionMap');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const selectedSet = useMemo(() => new Set(selectedCities), [selectedCities]);
  const hasSelection = selectedSet.size > 0;

  // Build a lookup map: cityCode → data
  const cityMap = useMemo(() => {
    const map = new Map<string, CityData>();
    for (const city of cities) {
      map.set(city.cityCode, city);
    }
    return map;
  }, [cities]);

  // Color scale for turnout mode — narrowed to 55–80% to differentiate
  // districts in the typical Israeli turnout range (60–75%)
  const turnoutScale = useMemo(() => {
    const minTurnout = 55;
    const maxTurnout = 80;
    return scaleSequential()
      .domain([minTurnout, maxTurnout])
      .interpolator(interpolateRgb(colorRange[0], colorRange[1]));
  }, [colorRange]);

  const getFillColor = useCallback(
    (geo: { properties: { muni_code?: string } }) => {
      const code = geo.properties?.muni_code;
      if (!code) return 'hsl(var(--muted))';

      const data = cityMap.get(code);
      if (!data) return 'hsl(var(--muted))';

      if (viewMode === 'turnout') {
        return turnoutScale(data.turnoutPercent) as string;
      }

      // Default fallback
      return turnoutScale(data.turnoutPercent) as string;
    },
    [cityMap, viewMode, turnoutScale],
  );

  const handleMouseEnter = useCallback(
    (
      geo: { properties: { muni_code?: string; name_he?: string } },
      event: React.MouseEvent,
    ) => {
      const code = geo.properties?.muni_code;
      if (!code) return;

      const data = cityMap.get(code);
      if (!data) return;

      setTooltip({
        x: event.clientX,
        y: event.clientY,
        cityName: data.cityName || geo.properties?.name_he || '',
        turnoutPercent: data.turnoutPercent,
        eligibleVoters: data.eligibleVoters,
        actualVoters: data.actualVoters,
      });
    },
    [cityMap],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div className="relative">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          center: [35.0, 31.5],
          scale: 6000,
        }}
        className="h-125 w-full sm:h-150 lg:h-175"
      >
        {/* SVG defs for 3D-like effects */}
        <defs>
          <filter
            id="shadow-default"
            x="-10%"
            y="-10%"
            width="130%"
            height="130%"
          >
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="1.5"
              floodColor="#000"
              floodOpacity="0.15"
            />
          </filter>
          <filter
            id="shadow-selected"
            x="-15%"
            y="-15%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="3"
              floodColor="#000"
              floodOpacity="0.35"
            />
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="4"
              floodColor="#0d9488"
              floodOpacity="0.4"
            />
          </filter>
          <filter
            id="shadow-hover"
            x="-10%"
            y="-10%"
            width="130%"
            height="130%"
          >
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="2"
              floodColor="#000"
              floodOpacity="0.25"
            />
          </filter>
          {/* Bevel/inner-shadow effect for 3D appearance */}
          <filter id="bevel" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
            <feSpecularLighting
              in="blur"
              surfaceScale="3"
              specularConstant="0.6"
              specularExponent="20"
              result="specular"
            >
              <fePointLight x="-50" y="-100" z="200" />
            </feSpecularLighting>
            <feComposite
              in="specular"
              in2="SourceAlpha"
              operator="in"
              result="specular-in"
            />
            <feComposite
              in="SourceGraphic"
              in2="specular-in"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="0.3"
              k4="0"
            />
          </filter>
        </defs>
        <ZoomableGroup center={[35.0, 31.5]} zoom={1} minZoom={0.8} maxZoom={8}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = geo.properties?.muni_code;
                const isSelected = !!code && selectedSet.has(code);
                const isFaded = hasSelection && !isSelected;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getFillColor(geo)}
                    stroke={isSelected ? '#0d9488' : 'rgba(255,255,255,0.6)'}
                    strokeWidth={isSelected ? 2.5 : 0.8}
                    className="cursor-pointer outline-none focus:outline-none"
                    style={{
                      default: {
                        filter: isSelected
                          ? 'url(#shadow-selected)'
                          : 'url(#shadow-default)',
                        opacity: isFaded ? 0.35 : 1,
                        transition:
                          'filter 250ms, stroke 200ms, stroke-width 200ms, opacity 300ms',
                      },
                      hover: {
                        filter: isSelected
                          ? 'url(#shadow-selected)'
                          : 'url(#shadow-hover)',
                        stroke: '#0d9488',
                        strokeWidth: 2,
                        opacity: isFaded ? 0.55 : 1,
                      },
                      pressed: {
                        filter: 'url(#shadow-selected)',
                      },
                    }}
                    onMouseEnter={(e) => handleMouseEnter(geo, e)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => {
                      if (code) {
                        const data = cityMap.get(code);
                        onCityClick(
                          code,
                          data?.cityName || geo.properties?.name_he || '',
                        );
                      }
                    }}
                    tabIndex={-1}
                    aria-label={
                      code
                        ? `${cityMap.get(code)?.cityName ?? geo.properties?.name_he ?? ''}: ${cityMap.get(code)?.turnoutPercent?.toFixed(1) ?? 0}%`
                        : undefined
                    }
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {tooltip && (
        <MapTooltip
          x={tooltip.x}
          y={tooltip.y}
          cityName={tooltip.cityName}
          turnoutPercent={tooltip.turnoutPercent}
          eligibleVoters={tooltip.eligibleVoters}
          actualVoters={tooltip.actualVoters}
        />
      )}

      <MapLegend
        viewMode={viewMode}
        colorRange={colorRange}
        lowLabel={t('legend.low')}
        highLabel={t('legend.high')}
      />

      {/* Overseas votes territory */}
      {overseasVoters != null && overseasVoters > 0 && onOverseasClick && (
        <button
          type="button"
          onClick={onOverseasClick}
          className={`absolute start-3 bottom-20 z-10 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
            isOverseasSelected
              ? 'border-teal-500 bg-teal-950/80 text-teal-50 shadow-teal-500/40'
              : 'border-border/60 bg-background/80 text-foreground hover:border-teal-400/60'
          }`}
          aria-label={t('overseas.territory')}
        >
          <span className="text-lg leading-none">✈️</span>
          <span className="text-[10px] leading-tight font-semibold">
            {t('overseas.territory')}
          </span>
          <span className="text-xs font-bold tabular-nums">
            {overseasVoters.toLocaleString()}
          </span>
        </button>
      )}
    </div>
  );
}
