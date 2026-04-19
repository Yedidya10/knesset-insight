import { test, expect } from '@playwright/test';

// Longer timeout for SSR dev server pages
test.setTimeout(90_000);

const pages = [
  { name: 'homepage', path: '/he' },
  { name: 'legislation', path: '/he/legislation' },
  { name: 'legislation-detail', path: '/he/legislation/30' },
  { name: 'policies', path: '/he/policies' },
  { name: 'policies-13', path: '/he/policies/13' },
  { name: 'members', path: '/he/members' },
  { name: 'members-1', path: '/he/members/1' },
  { name: 'votes', path: '/he/votes' },
  { name: 'committees', path: '/he/committees' },
  { name: 'budget', path: '/he/budget' },
];

for (const p of pages) {
  test(`overflow check: ${p.name}`, async ({ page }, testInfo) => {
    const response = await page.goto(p.path, {
      waitUntil: 'load',
      timeout: 60_000,
    });

    if (!response || response.status() >= 400) {
      test.skip();
      return;
    }

    // Wait for SSR hydration + data loading
    await page.waitForTimeout(5000);

    // Screenshot full page
    await page.screenshot({
      path: `test-results/screenshots/${testInfo.project.name}-${p.name}.png`,
      fullPage: true,
    });

    // Check for horizontal overflow
    const overflowInfo = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const overflows: string[] = [];

      if (docScrollW > vw + 2) {
        overflows.push(`DOCUMENT scrollWidth=${docScrollW} > viewport=${vw}`);
      }

      // Check all visible elements
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (!(el instanceof HTMLElement)) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const rect = el.getBoundingClientRect();
        // Skip tiny/zero-size elements
        if (rect.width < 5 || rect.height < 5) continue;

        // Check if element extends past viewport right edge
        if (rect.right > vw + 2) {
          // Skip elements inside overflow containers
          let parent = el.parentElement;
          let insideOverflowContainer = false;
          while (parent) {
            const ps = getComputedStyle(parent);
            if (
              ps.overflowX === 'auto' ||
              ps.overflowX === 'scroll' ||
              ps.overflowX === 'hidden' ||
              ps.overflow === 'auto' ||
              ps.overflow === 'scroll' ||
              ps.overflow === 'hidden'
            ) {
              insideOverflowContainer = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (insideOverflowContainer) continue;

          const tag = el.tagName.toLowerCase();
          const cls = el.className
            ? '.' + String(el.className).split(/\s+/).slice(0, 4).join('.')
            : '';
          const text = el.textContent?.slice(0, 80)?.trim() || '';
          overflows.push(
            `${tag}${cls} | right=${Math.round(rect.right)}px (viewport=${vw}px) | "${text.slice(0, 60)}"`,
          );
        }
      }

      return {
        vw,
        docScrollW,
        overflows: [...new Set(overflows)].slice(0, 30),
      };
    });

    if (overflowInfo.overflows.length > 0) {
      console.log(
        `\n[${p.name}] ${overflowInfo.overflows.length} overflow(s) found (viewport=${overflowInfo.vw}, scrollW=${overflowInfo.docScrollW}):`,
      );
      overflowInfo.overflows.forEach((o) => console.log(`  ${o}`));
    }

    expect(
      overflowInfo.overflows,
      `Horizontal overflow on ${p.name} (viewport=${overflowInfo.vw}px):\n${overflowInfo.overflows.join('\n')}`,
    ).toHaveLength(0);
  });
}
