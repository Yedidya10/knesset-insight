---
applyTo: '**/*.css,**/*.tsx,src/components/**'
---

# Styling & RTL Instructions

## Tailwind CSS RTL Rules

Hebrew and Arabic are RTL. English and Russian are LTR.
The `dir` attribute is set automatically per locale. Use Tailwind **logical properties**:

### Spacing

| ❌ Don't use | ✅ Use instead | Reason               |
| ------------ | -------------- | -------------------- |
| `ml-4`       | `ms-4`         | margin-inline-start  |
| `mr-4`       | `me-4`         | margin-inline-end    |
| `pl-4`       | `ps-4`         | padding-inline-start |
| `pr-4`       | `pe-4`         | padding-inline-end   |

### Positioning

| ❌ Don't use  | ✅ Use instead |
| ------------- | -------------- |
| `left-0`      | `start-0`      |
| `right-0`     | `end-0`        |
| `text-left`   | `text-start`   |
| `text-right`  | `text-end`     |
| `float-left`  | `float-start`  |
| `float-right` | `float-end`    |

### Borders

| ❌ Don't use | ✅ Use instead |
| ------------ | -------------- |
| `border-l`   | `border-s`     |
| `border-r`   | `border-e`     |
| `rounded-l`  | `rounded-s`    |
| `rounded-r`  | `rounded-e`    |

### Flexbox & Grid

- `flex-row` works correctly with `dir` attribute — items are automatically reversed in RTL
- For explicit control: use `rtl:flex-row-reverse` only when auto-direction is insufficient
- **Grid columns**: Always set `grid-cols-1` at mobile. Without it, grid items are not constrained to the container width, causing them to overflow **left** in RTL (since content grows from right-to-left). This makes card content (scores, percentages) invisible. Example: `grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3`

### Icons & Arrows

- Directional icons (chevrons, arrows) must flip in RTL:
  ```tsx
  <ChevronRight className="rtl:rotate-180" />
  ```

## Dark Mode

- Always provide `dark:` variants for background and text colors
- Use CSS variables from shadcn/ui theme for consistency
