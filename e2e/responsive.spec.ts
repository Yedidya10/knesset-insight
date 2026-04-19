import { test, expect, Page } from '@playwright/test';

/**
 * Checks for horizontal overflow on any element in the page.
 * Returns an array of selectors for elements that overflow.
 */
async function findHorizontalOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const overflows: string[] = [];
    const viewportWidth = document.documentElement.clientWidth;

    // Check if body/html scrolls horizontally
    if (document.documentElement.scrollWidth > viewportWidth + 2) {
      overflows.push(
        `<html> scrollWidth=${document.documentElement.scrollWidth} > viewportWidth=${viewportWidth}`,
      );
    }

    // Walk all elements and find ones that overflow their parent
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const rect = el.getBoundingClientRect();

      // Element extends beyond viewport
      if (rect.right > viewportWidth + 2) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className
          ? `.${String(el.className).split(' ').slice(0, 3).join('.')}`
          : '';
        const id = el.id ? `#${el.id}` : '';
        const text = el.textContent?.slice(0, 50)?.trim() || '';
        overflows.push(
          `${tag}${id}${cls} right=${Math.round(rect.right)}px text="${text}"`,
        );
      }

      // Element's scrollWidth exceeds its clientWidth (inner overflow)
      if (
        el.scrollWidth > el.clientWidth + 2 &&
        el instanceof HTMLElement &&
        getComputedStyle(el).overflowX !== 'auto' &&
        getComputedStyle(el).overflowX !== 'scroll' &&
        getComputedStyle(el).overflowX !== 'hidden'
      ) {
        const tag = el.tagName.toLowerCase();
        const cls = el.className
          ? `.${String(el.className).split(' ').slice(0, 3).join('.')}`
          : '';
        const text = el.textContent?.slice(0, 40)?.trim() || '';
        overflows.push(
          `INNER ${tag}${cls} scrollW=${el.scrollWidth} clientW=${el.clientWidth} text="${text}"`,
        );
      }
    }

    // Deduplicate
    return [...new Set(overflows)];
  });
}

/**
 * Checks for text being clipped or truncated without proper CSS handling.
 * Finds elements where text visually overflows its container.
 */
async function findTextOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    const textEls = document.querySelectorAll(
      'p, span, h1, h2, h3, h4, h5, h6, a, label, td, th',
    );
    for (const el of textEls) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);

      // Skip hidden elements
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      // Check if text overflows without handling
      if (
        el.scrollWidth > el.clientWidth + 2 &&
        style.overflowX !== 'hidden' &&
        style.overflowX !== 'scroll' &&
        style.overflowX !== 'auto' &&
        style.textOverflow !== 'ellipsis' &&
        !style.webkitLineClamp
      ) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 10) continue; // skip tiny elements

        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.slice(0, 60)?.trim() || '';
        if (!text) continue;

        issues.push(
          `${tag} overflows: scrollW=${el.scrollWidth} clientW=${el.clientWidth} text="${text}"`,
        );
      }
    }
    return [...new Set(issues)].slice(0, 20); // limit results
  });
}

// ─── Page routes to test ─────────────────────────────────────

const pages = [
  { name: 'homepage', path: '/he' },
  { name: 'members', path: '/he/members' },
  { name: 'legislation', path: '/he/legislation' },
  { name: 'votes', path: '/he/votes' },
  { name: 'policies', path: '/he/policies' },
  { name: 'elections', path: '/he/elections' },
  { name: 'committees', path: '/he/committees' },
  { name: 'governments', path: '/he/governments' },
  { name: 'political-groups', path: '/he/political-groups' },
  { name: 'budget', path: '/he/budget' },
];

// Detail pages (require data in DB)
const detailPages = [
  { name: 'legislation-detail', path: '/he/legislation/30' },
  { name: 'policy-detail', path: '/he/policies/13' },
  { name: 'policy-detail-16', path: '/he/policies/16' },
  { name: 'member-detail', path: '/he/members/1' },
  { name: 'vote-detail', path: '/he/votes/1' },
];

// ─── Tests ───────────────────────────────────────────────────

for (const p of [...pages, ...detailPages]) {
  test(`no horizontal overflow on ${p.name}`, async ({ page }) => {
    const response = await page.goto(p.path, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    // Skip if page doesn't exist (404) or error
    if (!response || response.status() >= 400) {
      test.skip();
      return;
    }

    // Wait for content to render
    await page.waitForTimeout(1000);

    const overflows = await findHorizontalOverflows(page);

    // Filter out known acceptable patterns (e.g. hidden overflow containers)
    const significant = overflows.filter(
      (o) =>
        !o.includes('overflow-x-auto') &&
        !o.includes('overflow-hidden') &&
        !o.includes('sr-only'),
    );

    if (significant.length > 0) {
      console.log(`[${p.name}] Overflow issues found:`);
      significant.forEach((o) => console.log(`  - ${o}`));
    }

    expect(
      significant,
      `Horizontal overflow found on ${p.name}:\n${significant.join('\n')}`,
    ).toHaveLength(0);
  });
}

for (const p of [...pages, ...detailPages]) {
  test(`no text overflow on ${p.name}`, async ({ page }) => {
    const response = await page.goto(p.path, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });

    if (!response || response.status() >= 400) {
      test.skip();
      return;
    }

    await page.waitForTimeout(1000);

    const textOverflows = await findTextOverflows(page);

    if (textOverflows.length > 0) {
      console.log(`[${p.name}] Text overflow issues:`);
      textOverflows.forEach((o) => console.log(`  - ${o}`));
    }

    expect(
      textOverflows,
      `Text overflow on ${p.name}:\n${textOverflows.join('\n')}`,
    ).toHaveLength(0);
  });
}

// ─── Specific component tests ──────────────────────────────

test('legislation stage pipeline - mobile vertical stepper no overflow', async ({
  page,
}) => {
  const response = await page.goto('/he/legislation/30', {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  if (!response || response.status() >= 400) {
    test.skip();
    return;
  }

  await page.waitForTimeout(1000);

  // Check the mobile stepper container
  const mobileStepperOverflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const issues: string[] = [];

    // Find all elements in the mobile stepper that might overflow
    const stepperElements = document.querySelectorAll('.md\\:hidden *');
    for (const el of stepperElements) {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth + 2 && rect.width > 0) {
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.slice(0, 60)?.trim() || '';
        issues.push(
          `${tag} right=${Math.round(rect.right)}px width=${Math.round(rect.width)}px text="${text}"`,
        );
      }
    }
    return [...new Set(issues)];
  });

  if (mobileStepperOverflow.length > 0) {
    console.log('Mobile stepper overflow:', mobileStepperOverflow);
  }

  expect(mobileStepperOverflow).toHaveLength(0);
});

test('policy detail - member cards do not overflow on mobile', async ({
  page,
}) => {
  const response = await page.goto('/he/policies/13', {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  if (!response || response.status() >= 400) {
    test.skip();
    return;
  }

  await page.waitForTimeout(1000);

  // Check all Card elements for overflow
  const cardOverflows = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const issues: string[] = [];

    // Check cards
    const cards = document.querySelectorAll('[class*="card"]');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.right > viewportWidth + 2) {
        const text = card.textContent?.slice(0, 60)?.trim() || '';
        issues.push(`card right=${Math.round(rect.right)}px text="${text}"`);
      }

      // Check children overflow
      if (
        card.scrollWidth > card.clientWidth + 2 &&
        card instanceof HTMLElement
      ) {
        const style = getComputedStyle(card);
        if (
          style.overflowX !== 'auto' &&
          style.overflowX !== 'scroll' &&
          style.overflowX !== 'hidden'
        ) {
          const text = card.textContent?.slice(0, 60)?.trim() || '';
          issues.push(
            `card inner overflow scrollW=${card.scrollWidth} clientW=${card.clientWidth} text="${text}"`,
          );
        }
      }
    }
    return [...new Set(issues)];
  });

  expect(cardOverflows).toHaveLength(0);
});

test('legislation detail - relationship events panel text clips on mobile', async ({
  page,
}) => {
  const response = await page.goto('/he/legislation/30', {
    waitUntil: 'networkidle',
    timeout: 15000,
  });
  if (!response || response.status() >= 400) {
    test.skip();
    return;
  }

  await page.waitForTimeout(1500);

  // Look for relationship event panels and check text overflow
  const relationOverflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const issues: string[] = [];

    // Find link elements that might be the bill name links in relationship events
    const links = document.querySelectorAll('a');
    for (const link of links) {
      const rect = link.getBoundingClientRect();
      if (rect.right > viewportWidth + 2 && rect.width > 0 && rect.height > 0) {
        const text = link.textContent?.slice(0, 80)?.trim() || '';
        if (text.length > 10) {
          issues.push(
            `link overflows: right=${Math.round(rect.right)}px text="${text}"`,
          );
        }
      }
    }

    // Also check any elements with truncate class that still overflow
    const truncated = document.querySelectorAll(
      '.truncate, [class*="line-clamp"]',
    );
    for (const el of truncated) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > viewportWidth + 2) {
        const text = el.textContent?.slice(0, 60)?.trim() || '';
        issues.push(
          `truncated element overflows: right=${Math.round(rect.right)}px text="${text}"`,
        );
      }
    }

    return [...new Set(issues)];
  });

  if (relationOverflow.length > 0) {
    console.log('Relationship events overflow:', relationOverflow);
  }

  expect(relationOverflow).toHaveLength(0);
});
