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
  selectedCity: string | null;
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
  selectedCity,
}: IsraelMapProps) {
  const t = useTranslations('electionMap');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Build a lookup map: cityCode → data
  const cityMap = useMemo(() => {
    const map = new Map<string, CityData>();
    for (const city of cities) {
      map.set(city.cityCode, city);
    }
    return map;
  }, [cities]);

  // Color scale for turnout mode
  const turnoutScale = useMemo(() => {
    const minTurnout = 30;
    const maxTurnout = 90;
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
        <ZoomableGroup center={[35.0, 31.5]} zoom={1} minZoom={0.8} maxZoom={8}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = geo.properties?.muni_code;
                const isSelected = code === selectedCity;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getFillColor(geo)}
                    stroke={
                      isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'
                    }
                    strokeWidth={isSelected ? 2 : 0.5}
                    className="cursor-pointer transition-colors duration-200 outline-none focus:outline-none"
                    style={{
                      hover: {
                        fill: 'hsl(var(--primary) / 0.3)',
                        stroke: 'hsl(var(--primary))',
                        strokeWidth: 1.5,
                      },
                      pressed: {
                        fill: 'hsl(var(--primary) / 0.5)',
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
    </div>
  );
}
