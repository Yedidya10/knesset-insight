---
applyTo: 'src/components/**'
---

# Component Development Instructions

## General Rules

1. **Server Components by default** — only add `'use client'` when you need:
   - Event handlers (onClick, onChange)
   - React hooks (useState, useEffect)
   - Browser APIs (localStorage, IntersectionObserver)

2. **All displayed text via `t()`** — import `useTranslations` from `next-intl`:

   ```tsx
   import { useTranslations } from 'next-intl';

   export function MemberCard({ member }: Props) {
     const t = useTranslations('members');
     return <h2>{t('card.title')}</h2>;
   }
   ```

   For Server Components, use `getTranslations` instead.

3. **RTL-safe styling** — use logical properties:
   - `ps-4` not `pl-4` (padding-start)
   - `pe-4` not `pr-4` (padding-end)
   - `ms-4` not `ml-4` (margin-start)
   - `me-4` not `mr-4` (margin-end)
   - `text-start` not `text-left`
   - `text-end` not `text-right`
   - `start-0` not `left-0`
   - `end-0` not `right-0`
   - `float-start` not `float-left`

4. **Dark mode** — always provide `dark:` variants for colors:

   ```tsx
   <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
   ```

5. **Accessibility (a11y)**:
   - All interactive elements must have accessible labels
   - Use `aria-label` with `t()` translated strings
   - Ensure color contrast ratio ≥ 4.5:1
   - Support keyboard navigation
   - Use semantic HTML (`<nav>`, `<main>`, `<article>`, etc.)

6. **Charts & Visualizations** — use the project's color tokens:
   - Coalition: `#2E7D32` (green)
   - Opposition: `#C62828` (red)
   - Vote For: `#388E3C`
   - Vote Against: `#D32F2F`
   - Abstain: `#FFA000`
     Define these in a shared constant, not hardcoded per component.

7. **Loading states** — use React `Suspense` with skeleton placeholders. Skeletons should match the component's layout.

8. **New string = 4 locales** — if you add ANY text to a component, add the translation key to `he.json`, `en.json`, `ar.json`, and `ru.json` immediately.

9. **Mobile-first responsive design** — all components must work on screens from 320px up:
   - **Flex rows**: Always add `min-w-0` on flex children that contain text to prevent overflow. Add `shrink-0` on fixed-width elements (avatars, icons, badges).
   - **Text overflow**: Use `truncate` or `line-clamp-N` on dynamic text inside flex/grid cells. Especially important for Hebrew/Arabic text which can be longer than expected.
   - **Tables**: Always wrap `<Table>` in `<div className="overflow-x-auto">` — tables will overflow on mobile otherwise.
   - **Grids**: Use mobile-first breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Never start with multi-column grids without a single-column mobile fallback.
   - **Horizontal steppers/pipelines**: Wrap in `overflow-x-auto` if using inline `minWidth` styles.
   - **Cards with horizontal layout**: Use `flex-col sm:flex-row` pattern when card content includes multiple sections side-by-side.
   - **`justify-between` rows**: Always pair with `gap-2` and ensure the start element has `min-w-0 flex-1 truncate` and the end element has `shrink-0`.
