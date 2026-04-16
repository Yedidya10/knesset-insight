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

### Required filter pattern

Follow the established pattern from `LegislationFilter.tsx`:

1. **Imports**: `useSearchParams` from `next/navigation`, `useRouter` + `usePathname` from `@/i18n/navigation`, `useTranslations` from `next-intl`.
2. **Debounced search**: Use `useState` + `useRef<setTimeout>` with 400ms debounce. No form submission — filtering happens on-type.
3. **Layout**: `space-y-3` wrapper → Row 1: search `<Input>` with `Search` icon + `X` clear → Row 2: `flex flex-wrap items-center gap-2` with `<Select>` dropdowns + clear filters `<Button>`.
4. **Clear filters button**: Ghost variant `<Button>` with `X` icon + translated label + `<Badge>` showing active filter count. Only visible when filters are active.
5. **`updateParam` helper**: Builds `URLSearchParams` from current params, sets/deletes the key, removes `page` param, pushes to router.
6. **Select component**: Always pass `items` prop to `<Select>` root for accessibility. Use `_all` as the sentinel value for "show all".

### Server page integration

```tsx
<div className="mb-6">
  <MyFilter currentSearch={search} currentX={x} ... />
</div>
```

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
