/** Option for select / multi-select filters */
export interface FilterOption {
  value: string;
  label: string;
}

/** Base config shared by every filter field */
interface FilterFieldBase {
  /** URL search-param key */
  key: string;
  /** i18n key for the filter label (resolved by the consuming page) */
  label: string;
  /** If true, this filter is shown inline in the toolbar (desktop).
   *  If false / omitted, it only appears inside the FilterSheet. */
  primary?: boolean;
  /** Group label inside the FilterSheet (optional) */
  group?: string;
}

export interface SelectFilterField extends FilterFieldBase {
  type: 'select';
  options: FilterOption[];
  /** Value that means "no filter" (default `_all`) */
  allValue?: string;
}

export interface MultiSelectFilterField extends FilterFieldBase {
  type: 'multiSelect';
  options: FilterOption[];
  /** URL separator between selected values (default `,`) */
  separator?: string;
}

export interface RangeFilterField extends FilterFieldBase {
  type: 'range';
  /** URL param key for the lower bound (defaults to `${key}From`) */
  fromKey?: string;
  /** URL param key for the upper bound (defaults to `${key}To`) */
  toKey?: string;
  /** Placeholder for "from" input */
  fromPlaceholder?: string;
  /** Placeholder for "to" input */
  toPlaceholder?: string;
  /** Input type — `number` or `date` (default `number`) */
  inputType?: 'number' | 'date';
}

export interface ToggleFilterField extends FilterFieldBase {
  type: 'toggle';
  /** Value when toggled on (default `'true'`) */
  onValue?: string;
}

export interface SearchFilterField extends FilterFieldBase {
  type: 'search';
  /** Debounce delay in ms (default 400) */
  debounceMs?: number;
  /** Placeholder text (i18n key) */
  placeholder?: string;
}

export type FilterFieldConfig =
  | SelectFilterField
  | MultiSelectFilterField
  | RangeFilterField
  | ToggleFilterField
  | SearchFilterField;

/** Sort option passed to SortSelect */
export interface SortOption {
  value: string;
  label: string;
}

/** Props expected by every inline filter primitive */
export interface FilterPrimitiveProps {
  value: string;
  onChange: (value: string) => void;
}

/** Active filter chip data */
export interface ActiveFilter {
  key: string;
  label: string;
  displayValue: string;
}
