'use client';

import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FilterSelect from './FilterSelect';
import FilterToggle from './FilterToggle';
import FilterChips from './FilterChips';
import FilterSheet from './FilterSheet';
import SortSelect from './SortSelect';
import SortControl from './SortControl';
import type {
  FilterFieldConfig,
  SelectFilterField,
  SortOption,
  ToggleFilterField,
} from './types';
import type { ActiveFilter } from './types';

interface FilterBarProps {
  /** All filter field definitions */
  fields: FilterFieldConfig[];
  /** Current filter values (from useFilterParams) */
  filters: Record<string, string>;
  /** Controlled search value (from useFilterParams) */
  searchValue: string;
  /** Search value setter (from useFilterParams) */
  onSearchChange: (value: string) => void;
  /** Commit search immediately (from useFilterParams) */
  onSearchCommit: () => void;
  /** Update a single filter (from useFilterParams) */
  onUpdateFilter: (key: string, value: string) => void;
  /** Clear a single filter (from useFilterParams) */
  onClearFilter: (key: string) => void;
  /** Clear all filters (from useFilterParams) */
  onClearAll: () => void;
  /** Number of active filters (from useFilterParams) */
  activeCount: number;
  /** Whether any filter is active (from useFilterParams) */
  hasActiveFilters: boolean;
  /** Active filter list for chips (from useFilterParams) */
  activeFilters: ActiveFilter[];
  /** Sort options (optional — shown if provided) */
  sortOptions?: SortOption[];
  /** Current sort value */
  sortValue?: string;
  /** Default sort value */
  sortDefault?: string;
  /** Sort change handler */
  onSortChange?: (value: string) => void;
  /** Split sort: field options (when provided, replaces sortOptions with field+direction UI) */
  sortFieldOptions?: SortOption[];
  /** Split sort: current field value */
  sortField?: string;
  /** Split sort: current direction */
  sortDir?: 'asc' | 'desc';
  /** Split sort: field change handler */
  onSortFieldChange?: (value: string) => void;
  /** Split sort: direction change handler */
  onSortDirChange?: (dir: 'asc' | 'desc') => void;
  /** Extra content rendered between search and filters (e.g. knesset/status tabs) */
  beforeFilters?: React.ReactNode;
  /** Extra content rendered after inline filters (e.g. details toggle) */
  afterFilters?: React.ReactNode;
  /** Custom renderers for specific fields inside the FilterSheet */
  customRenderers?: Record<string, React.ReactNode>;
}

export default function FilterBar({
  fields,
  filters,
  searchValue,
  onSearchChange,
  onSearchCommit,
  onUpdateFilter,
  onClearFilter,
  onClearAll,
  activeCount,
  hasActiveFilters,
  activeFilters,
  sortOptions,
  sortValue,
  sortDefault,
  onSortChange,
  sortFieldOptions,
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirChange,
  beforeFilters,
  afterFilters,
  customRenderers,
}: FilterBarProps) {
  const t = useTranslations('filters');

  const searchField = fields.find((f) => f.type === 'search');
  const primaryFields = fields.filter((f) => f.primary && f.type !== 'search');
  const hasSheetFields = fields.some((f) => f.type !== 'search' && !f.primary);

  // Count of non-primary active filters (for sheet badge)
  const sheetActiveCount = activeFilters.filter((af) => {
    const field = fields.find((f) => f.key === af.key);
    return field && !field.primary && field.type !== 'search';
  }).length;

  return (
    <div className="space-y-3">
      {/* Before filters slot (e.g. knesset selector + status tabs) */}
      {beforeFilters}

      {/* Search bar */}
      {searchField && (
        <div className="relative">
          <Search className="text-muted-foreground absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchCommit();
            }}
            placeholder={
              searchField.type === 'search'
                ? (searchField.placeholder ?? t('search'))
                : t('search')
            }
            className="w-full rounded-xl ps-10 pe-10"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-muted-foreground hover:text-foreground absolute end-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5"
              aria-label={t('clearAll')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filter row: primary inline filters + sheet trigger + sort + clear */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Primary filters (inline, visible on all screen sizes) */}
        {primaryFields.map((field) => {
          if (field.type === 'select') {
            return (
              <FilterSelect
                key={field.key}
                field={field as SelectFilterField}
                value={filters[field.key] ?? ''}
                onChange={(val) => onUpdateFilter(field.key, val)}
              />
            );
          }
          if (field.type === 'toggle') {
            return (
              <FilterToggle
                key={field.key}
                field={field as ToggleFilterField}
                value={filters[field.key] ?? ''}
                onChange={(val) => onUpdateFilter(field.key, val)}
              />
            );
          }
          return null;
        })}

        {/* Filter sheet trigger (for non-primary fields) */}
        {hasSheetFields && (
          <FilterSheet
            fields={fields}
            filters={filters}
            activeCount={sheetActiveCount}
            onUpdateFilter={onUpdateFilter}
            onClearAll={onClearAll}
            customRenderers={customRenderers}
          />
        )}

        {/* After filters slot (e.g. details toggle) */}
        {afterFilters}

        {/* Visual separator between filter controls and sort controls */}
        {(primaryFields.length > 0 || hasSheetFields) &&
          (sortFieldOptions || (sortOptions && sortOptions.length > 0)) && (
            <div className="bg-border mx-0.5 h-6 w-px shrink-0 self-center" />
          )}

        {/* Split sort (field select + direction arrow button) */}
        {sortFieldOptions && onSortFieldChange && onSortDirChange && (
          <SortControl
            options={sortFieldOptions}
            sortField={sortField ?? ''}
            sortDir={sortDir ?? 'desc'}
            onFieldChange={onSortFieldChange}
            onDirChange={onSortDirChange}
            dirAscLabel={t('sortDirAsc')}
            dirDescLabel={t('sortDirDesc')}
          />
        )}

        {/* Legacy sort select (used when sortFieldOptions not provided) */}
        {!sortFieldOptions &&
          sortOptions &&
          sortOptions.length > 0 &&
          onSortChange && (
            <SortSelect
              options={sortOptions}
              value={sortValue ?? ''}
              onChange={onSortChange}
              defaultValue={sortDefault}
            />
          )}

        {/* Clear all button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-foreground h-9 gap-1.5 rounded-xl"
          >
            <X className="h-3.5 w-3.5" />
            {t('clearAll')}
            {activeCount > 0 && (
              <Badge
                variant="secondary"
                className="ms-1 h-5 min-w-5 px-1 text-xs"
              >
                {activeCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      <FilterChips filters={activeFilters} onRemove={onClearFilter} />
    </div>
  );
}
