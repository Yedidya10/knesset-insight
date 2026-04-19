---
applyTo: 'src/components/**,src/app/**'
description: UI component and styling consistency rules
---

# UI Component & Styling Consistency Rules

## Never use raw HTML form elements

Always use the project's shadcn/ui components from `@/components/ui/` — **never** use native HTML elements for interactive controls:

| ❌ Never use              | ✅ Always use                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `<select>`                | `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` from `@/components/ui/select` |
| `<input>`                 | `<Input>` from `@/components/ui/input`                                                            |
| `<button>`                | `<Button>` from `@/components/ui/button`                                                          |
| `<textarea>`              | `<Textarea>` from `@/components/ui/textarea`                                                      |
| `<input type="checkbox">` | `<Checkbox>` from `@/components/ui/checkbox`                                                      |

**Exception**: The small inline `<button>` used to clear a search input's X icon is acceptable (see `LegislationFilter.tsx`).

## Filter components must be client components

Every page that has filters (search, dropdowns) must extract them into a dedicated **client component** (e.g., `PoliciesFilter.tsx`, `LegislationFilter.tsx`, `MembersFilter.tsx`). Never inline filters directly in a server page component.

### Required filter pattern — FilterBar + useFilterParams

Use the unified filter system in `src/components/filters/` and `src/hooks/use-filter-params.ts`. **Do not** build ad-hoc filter logic with `useSearchParams` + `useRouter` + manual debounce refs.

#### 1. Define a field schema

```tsx
import type { FilterFieldConfig, SortOption } from '@/components/filters';

const fields: FilterFieldConfig[] = [
  { key: 'search', type: 'search', label: t('searchPlaceholder'), placeholder: t('searchPlaceholder'), debounceMs: 400 },
  { key: 'knesset', type: 'select', label: t('allKnessets'), primary: true, options: [{ value: '_all', label: t('allKnessets') }, ...] },
  { key: 'result', type: 'select', label: t('allResults'), primary: true, options: [...] },
];

const sortOptions: SortOption[] = [
  { value: 'dateDesc', label: t('sort.dateDesc') },
  { value: 'dateAsc', label: t('sort.dateAsc') },
];
```

- `primary: true` → rendered inline in the toolbar. Non-primary fields go into the FilterSheet side panel.
- `group` → groups non-primary fields inside the FilterSheet.
- Field types: `search`, `select`, `multi-select`, `range`, `toggle`.

#### 2. Use the hook

```tsx
const {
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
} = useFilterParams({ fields });
```

The hook manages URL search params, debounced search, batch updates, and page param reset.

#### 3. Render FilterBar

```tsx
<FilterBar
  fields={fields}
  filters={filters}
  searchValue={searchValue}
  onSearchChange={setSearchValue}
  onSearchCommit={commitSearch}
  onUpdateFilter={updateFilter}
  onClearFilter={clearFilter}
  onClearAll={clearAll}
  activeCount={activeCount}
  hasActiveFilters={hasActiveFilters}
  activeFilters={activeFilters}
  sortOptions={sortOptions}
  sortValue={filters.sort ?? 'dateDesc'}
  sortDefault="dateDesc"
  onSortChange={(val) => updateFilter('sort', val)}
/>
```

#### Slots for custom elements

- `beforeFilters` — e.g., knesset term selector, status tabs (see `MembersFilter.tsx`)
- `afterFilters` — e.g., details toggle button (see `MembersFilter.tsx`)

#### Available filter primitives

| Component           | Usage                                       |
| ------------------- | ------------------------------------------- |
| `FilterSelect`      | Single-value dropdown (wraps shadcn Select) |
| `FilterMultiSelect` | Chip-based toggle multi-select              |
| `FilterRange`       | From/to number or date inputs               |
| `FilterToggle`      | Boolean toggle button                       |
| `SortSelect`        | Sort dropdown with ArrowUpDown icon         |
| `FilterChips`       | Active filter dismissible pills             |
| `FilterSheet`       | Side panel for non-primary filters          |

All primitives are exported from `@/components/filters`.

## Card pattern

All list-view cards must use:

```
glass-card hover-lift border-s-primary/30 overflow-hidden border-s-4
```

## Header pattern

Page headers use the icon-box + title + subtitle layout:

```tsx
<div className="mb-8 flex items-center gap-3">
  <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
    <Icon className="text-primary h-7 w-7" />
  </div>
  <div>
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
    <p className="text-muted-foreground text-sm">{subtitle}</p>
  </div>
</div>
```

## No-results pattern

When a page/filter has no results, show:

```tsx
<div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
  <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
    <Icon className="h-8 w-8 opacity-40" />
  </div>
  <p className="text-sm">{t('noResults')}</p>
</div>
```

## Button sizes

Use these consistently:

- `xs` → h-6 (rare, very compact)
- `sm` → h-7
- `default` → h-8
- `lg` → h-9

## CSS direction

Use logical properties (`start`/`end`) instead of `left`/`right` for RTL/LTR compatibility:

- `ps-*` / `pe-*` instead of `pl-*` / `pr-*`
- `ms-*` / `me-*` instead of `ml-*` / `mr-*`
- `start-*` / `end-*` instead of `left-*` / `right-*`

## Never use raw HTML `title` attribute for tooltips

Always use the shadcn/ui `Tooltip` component — **never** use the HTML `title` attribute for contextual hints or hover labels:

```tsx
// ❌ Never do this
<button title="Delete item">🗑️</button>;

// ✅ Always do this
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger render={<Button variant="ghost" size="sm" />}>
      🗑️
    </TooltipTrigger>
    <TooltipContent>{t('deleteItem')}</TooltipContent>
  </Tooltip>
</TooltipProvider>;
```

Wrap a group of tooltip triggers in a single `<TooltipProvider>` to share delay settings. Every tooltip label must use `next-intl` `t()` — never hardcode strings.

**Exception**: `alt` attributes on `<Image>` for accessibility are not tooltips and remain as-is.

## Never use raw HTML interactive elements

This extends beyond form elements. Always prefer the project's UI components:

| ❌ Never use                   | ✅ Always use                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `<button>` (for any clickable) | `<Button>` from `@/components/ui/button`                                             |
| `<a>` for internal navigation  | `<Link>` from `@/i18n/navigation`                                                    |
| `title="..."` for hover hints  | `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>` from `@/components/ui/tooltip` |
| `<dialog>` / custom modals     | `<Dialog>` from `@/components/ui/dialog`                                             |

**Exception**: The small inline `<button>` used to clear a search input's X icon is acceptable (see `LegislationFilter.tsx`).

## Mobile-first responsive checklist

Every component and page must pass this checklist before being considered complete:

1. **Flex containers**: Text-bearing children have `min-w-0`; fixed-width children have `shrink-0`.
2. **Dynamic text**: Has `truncate` or `line-clamp-N` — especially in `flex` / `grid` cells. Hebrew and Arabic text is often 20-40% longer than English.
3. **Tables**: Wrapped in `<div className="overflow-x-auto">`.
4. **Grids**: **Always** include explicit `grid-cols-1` for mobile. Without it, CSS Grid creates auto-sized implicit columns that don't constrain items to the container width — causing horizontal overflow that is invisible in LTR but clips content in RTL (items extend past the left edge).
   - ✅ `grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3`
   - ❌ `grid gap-2 sm:grid-cols-2 lg:grid-cols-3` (missing `grid-cols-1`)
   - **Never** use `overflow-hidden` on a container to fix grid overflow — it hides the real problem and clips card content (scores, percentages, buttons).
5. **Horizontal pipelines/steppers**: Wrapped in `overflow-x-auto` if using inline `minWidth` or `style` widths.
6. **`justify-between` rows**: Start element has `min-w-0 flex-1 truncate`; end element has `shrink-0`.
7. **Images/avatars**: Use `shrink-0` and explicit `h-*` / `w-*`.
8. **No bare inline `style={{ width }}` or `style={{ minWidth }}`** without an `overflow-x-auto` ancestor.
9. **Test at 320px, 375px, 412px** widths — not only desktop.
