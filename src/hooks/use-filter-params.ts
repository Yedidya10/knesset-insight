'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useCallback, useState, useRef, useMemo } from 'react';
import type {
  FilterFieldConfig,
  ActiveFilter,
  SelectFilterField,
  MultiSelectFilterField,
  RangeFilterField,
} from '@/components/filters/types';

interface UseFilterParamsOptions {
  /** Filter field definitions */
  fields: FilterFieldConfig[];
  /** If true, remove the `page` param whenever any filter changes (default true) */
  resetPageOnChange?: boolean;
}

interface UseFilterParamsReturn {
  /** Current value of every filter field, keyed by field.key */
  filters: Record<string, string>;
  /** Update a single filter */
  updateFilter: (key: string, value: string) => void;
  /** Batch-update multiple filters at once (single navigation) */
  updateFilters: (updates: Record<string, string>) => void;
  /** Remove a single filter (set to empty) */
  clearFilter: (key: string) => void;
  /** Remove all filters and navigate to clean path */
  clearAll: () => void;
  /** Number of non-default active filters (excludes search) */
  activeCount: number;
  /** Whether any filter is active */
  hasActiveFilters: boolean;
  /** List of active filters with display info (for chips) */
  activeFilters: ActiveFilter[];
  /** Controlled search state + setter (debounced internally) */
  searchValue: string;
  setSearchValue: (value: string) => void;
  /** Commit search immediately (e.g. on Enter) */
  commitSearch: () => void;
}

/**
 * Centralized hook for URL-based filter state management.
 * Replaces per-page updateParam / updateParams / debounced search logic.
 */
export function useFilterParams({
  fields,
  resetPageOnChange = true,
}: UseFilterParamsOptions): UseFilterParamsReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ── Read current values from URL ──────────────────────────────
  const filters = useMemo(() => {
    const result: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === 'range') {
        const rf = field as RangeFilterField;
        const fromKey = rf.fromKey ?? `${rf.key}From`;
        const toKey = rf.toKey ?? `${rf.key}To`;
        result[fromKey] = searchParams.get(fromKey) ?? '';
        result[toKey] = searchParams.get(toKey) ?? '';
      } else {
        result[field.key] = searchParams.get(field.key) ?? '';
      }
    }
    return result;
  }, [fields, searchParams]);

  // ── Search debounce ───────────────────────────────────────────
  const searchField = fields.find((f) => f.type === 'search');
  const searchKey = searchField?.key ?? 'search';
  const debounceMs =
    searchField?.type === 'search' ? (searchField.debounceMs ?? 400) : 400;

  const [searchValue, setSearchValueInternal] = useState(
    searchParams.get(searchKey) ?? '',
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external URL changes (e.g. browser back/forward).
  // Track previous URL value via state to avoid accessing refs during render.
  const urlSearchValue = searchParams.get(searchKey) ?? '';
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearchValue);
  if (prevUrlSearch !== urlSearchValue) {
    setPrevUrlSearch(urlSearchValue);
    setSearchValueInternal(urlSearchValue);
  }

  // ── Navigate helper ───────────────────────────────────────────
  const navigate = useCallback(
    (params: URLSearchParams) => {
      if (resetPageOnChange) params.delete('page');
      // Clean up empty values
      const keysToDelete: string[] = [];
      params.forEach((v, k) => {
        if (!v) keysToDelete.push(k);
      });
      keysToDelete.forEach((k) => params.delete(k));

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, resetPageOnChange],
  );

  // ── Public API ────────────────────────────────────────────────
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      navigate(params);
    },
    [searchParams, navigate],
  );

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      navigate(params);
    },
    [searchParams, navigate],
  );

  const clearFilter = useCallback(
    (key: string) => {
      if (key === searchKey) {
        setSearchValueInternal('');
      }
      // For range fields, clear both from/to keys
      const field = fields.find((f) => {
        if (f.type === 'range') {
          const rf = f as RangeFilterField;
          const fromKey = rf.fromKey ?? `${rf.key}From`;
          const toKey = rf.toKey ?? `${rf.key}To`;
          return key === fromKey || key === toKey || key === rf.key;
        }
        return f.key === key;
      });
      if (field?.type === 'range') {
        const rf = field as RangeFilterField;
        const fromKey = rf.fromKey ?? `${rf.key}From`;
        const toKey = rf.toKey ?? `${rf.key}To`;
        updateFilters({ [fromKey]: '', [toKey]: '' });
      } else {
        updateFilter(key, '');
      }
    },
    [fields, searchKey, updateFilter, updateFilters, setSearchValueInternal],
  );

  const clearAll = useCallback(() => {
    setSearchValueInternal('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.push(pathname);
  }, [router, pathname, setSearchValueInternal]);

  // Debounced search setter
  const setSearchValue = useCallback(
    (value: string) => {
      setSearchValueInternal(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateFilter(searchKey, value);
      }, debounceMs);
    },
    [searchKey, debounceMs, updateFilter, setSearchValueInternal],
  );

  const commitSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateFilter(searchKey, searchValue);
  }, [searchKey, searchValue, updateFilter]);

  // ── Active filter computation ─────────────────────────────────
  const { activeCount, activeFilters, hasActiveFilters } = useMemo(() => {
    const actives: ActiveFilter[] = [];

    for (const field of fields) {
      if (field.type === 'search') {
        const v = filters[field.key];
        if (v) {
          actives.push({ key: field.key, label: field.label, displayValue: v });
        }
        continue;
      }
      if (field.type === 'select') {
        const sf = field as SelectFilterField;
        const v = filters[field.key];
        const allVal = sf.allValue ?? '_all';
        if (v && v !== allVal) {
          const opt = sf.options.find((o) => o.value === v);
          actives.push({
            key: field.key,
            label: field.label,
            displayValue: opt?.label ?? v,
          });
        }
      } else if (field.type === 'multiSelect') {
        const mf = field as MultiSelectFilterField;
        const v = filters[field.key];
        if (v) {
          const sep = mf.separator ?? ',';
          const selected = v.split(sep).filter(Boolean);
          if (selected.length > 0) {
            const labels = selected
              .map((s) => mf.options.find((o) => o.value === s)?.label ?? s)
              .join(', ');
            actives.push({
              key: field.key,
              label: field.label,
              displayValue: labels,
            });
          }
        }
      } else if (field.type === 'range') {
        const rf = field as RangeFilterField;
        const fromKey = rf.fromKey ?? `${rf.key}From`;
        const toKey = rf.toKey ?? `${rf.key}To`;
        const from = filters[fromKey];
        const to = filters[toKey];
        if (from || to) {
          const display = [from, to].filter(Boolean).join(' – ');
          actives.push({
            key: field.key,
            label: field.label,
            displayValue: display,
          });
        }
      } else if (field.type === 'toggle') {
        const v = filters[field.key];
        const onVal = field.onValue ?? 'true';
        if (v === onVal) {
          actives.push({
            key: field.key,
            label: field.label,
            displayValue: field.label,
          });
        }
      }
    }

    // activeCount excludes search
    const count = actives.filter(
      (a) => !fields.find((f) => f.key === a.key && f.type === 'search'),
    ).length;

    return {
      activeCount: count,
      activeFilters: actives,
      hasActiveFilters: actives.length > 0,
    };
  }, [fields, filters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    clearFilter,
    clearAll,
    activeCount,
    hasActiveFilters,
    activeFilters,
    searchValue,
    setSearchValue,
    commitSearch,
  };
}
