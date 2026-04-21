/**
 * Unit tests for Trigger.dev scheduled task cron schedules.
 *
 * These tests verify that every production cron expression:
 *  1. Is valid and parseable.
 *  2. Fires at the correct times in the "Asia/Jerusalem" timezone.
 *  3. Does NOT fire on days that are outside its intended window.
 *  4. The analysis-pipeline recess-skip logic correctly skips expensive
 *     AI jobs during the Knesset summer and Passover recesses.
 */

import { describe, it, expect } from 'vitest';
import { CronExpressionParser } from 'cron-parser';
import { appConfig } from '../../../app.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TZ = appConfig.sync.timezone; // 'Asia/Jerusalem'

/**
 * Return the next N fire-times for a cron expression in the project timezone.
 * `from` is a Date already positioned at the desired start instant.
 */
function nextFires(cron: string, from: Date, n = 5): Date[] {
  const interval = CronExpressionParser.parse(cron, {
    currentDate: from,
    tz: TZ,
  });
  return Array.from({ length: n }, () => interval.next().toDate());
}

/**
 * Day-of-week for a Date in Israel time (0 = Sun … 6 = Sat).
 * We use toLocaleDateString because JS Date.getDay() returns UTC day.
 */
function dowInIsrael(d: Date): number {
  const dayName = d.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: TZ,
  });
  return [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ].indexOf(dayName);
}

/** Get the hour of a Date in Israel time. */
function hourInIsrael(d: Date): number {
  return Number(
    d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }),
  );
}

// ---------------------------------------------------------------------------
// Recess logic (mirrored from analysis-pipeline.ts)
// ---------------------------------------------------------------------------

function isInRecess(timestamp: Date): { skipped: boolean; reason?: string } {
  const { summerRecess, passoverRecess } = appConfig.knessetCalendar;
  const month = timestamp.getMonth() + 1;
  const day = timestamp.getDate();

  const inSummerRecess =
    (month === summerRecess.startMonth && day >= summerRecess.startDay) ||
    (month > summerRecess.startMonth && month < summerRecess.endMonth) ||
    (month === summerRecess.endMonth && day <= summerRecess.endDay);

  const inPassoverRecess =
    month === passoverRecess.startMonth &&
    day >= passoverRecess.startDay &&
    day <= passoverRecess.endDay;

  if (inSummerRecess) return { skipped: true, reason: 'summer-recess' };
  if (inPassoverRecess) return { skipped: true, reason: 'passover-recess' };
  return { skipped: false };
}

// ---------------------------------------------------------------------------
// 1. Validate cron expressions
// ---------------------------------------------------------------------------

describe('cron expressions — validity', () => {
  const schedules: [string, string][] = [
    ['sync-core-data', appConfig.sync.coreData],
    ['sync-bill-relations', appConfig.sync.billRelations],
    ['sync-political-data', appConfig.sync.politicalData],
    ['sync-integrity', appConfig.sync.integrity],
    ['analysis-pipeline', appConfig.sync.analysis],
    ['election-candidate-sync', appConfig.elections2026.candidateSyncCron],
  ];

  it.each(schedules)('%s cron is a valid 5-field expression', (_name, cron) => {
    expect(() => CronExpressionParser.parse(cron, { tz: TZ })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. sync-core-data — every 4 hours, Sun–Thu
//    Default: '0 */4 * * 0-4'
// ---------------------------------------------------------------------------

describe('sync-core-data schedule', () => {
  // Start just before midnight Sunday (Israel time) in a known non-recess week.
  const start = new Date('2025-11-02T21:55:00.000Z'); // Sun 2 Nov 2025 23:55 IL
  const fires = nextFires(appConfig.sync.coreData, start, 10);

  it('fires only on Sun–Thu (dow 0–4)', () => {
    for (const d of fires) {
      expect(dowInIsrael(d)).toBeLessThanOrEqual(4); // 0=Sun … 4=Thu
    }
  });

  it('fires at hours that are multiples of 4 (0, 4, 8, 12, 16, 20)', () => {
    for (const d of fires) {
      expect(hourInIsrael(d) % 4).toBe(0);
    }
  });

  it('fires at minute 0', () => {
    for (const d of fires) {
      expect(d.getUTCMinutes()).toBe(0); // UTC minute == local minute for :00
    }
  });
});

// ---------------------------------------------------------------------------
// 3. sync-bill-relations — daily at 1 AM, Sun–Thu
//    Default: '0 1 * * 0-4'
// ---------------------------------------------------------------------------

describe('sync-bill-relations schedule', () => {
  const start = new Date('2025-11-02T21:55:00.000Z'); // Sun 2 Nov 23:55 IL
  const fires = nextFires(appConfig.sync.billRelations, start, 5);

  it('fires only on Sun–Thu', () => {
    for (const d of fires) {
      expect(dowInIsrael(d)).toBeLessThanOrEqual(4);
    }
  });

  it('fires at 1 AM Israel time', () => {
    for (const d of fires) {
      expect(hourInIsrael(d)).toBe(1);
    }
  });

  it('fires once per day (consecutive fires are ~24h or ~72h apart over weekends)', () => {
    // All gaps must be >= 23 h and <= 96 h (skip Fri/Sat adds up to ~3 days).
    for (let i = 1; i < fires.length; i++) {
      const gapHours =
        (fires[i].getTime() - fires[i - 1].getTime()) / (1000 * 3600);
      expect(gapHours).toBeGreaterThanOrEqual(23);
      expect(gapHours).toBeLessThanOrEqual(96);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. sync-political-data — weekly at 3 AM on Sunday
//    Default: '0 3 * * 0'
// ---------------------------------------------------------------------------

describe('sync-political-data schedule', () => {
  const start = new Date('2025-11-01T00:00:00.000Z');
  const fires = nextFires(appConfig.sync.politicalData, start, 4);

  it('fires only on Sunday (dow 0)', () => {
    for (const d of fires) {
      expect(dowInIsrael(d)).toBe(0);
    }
  });

  it('fires at 3 AM Israel time', () => {
    for (const d of fires) {
      expect(hourInIsrael(d)).toBe(3);
    }
  });

  it('fires approximately weekly (~7 days between firings)', () => {
    for (let i = 1; i < fires.length; i++) {
      const gapHours =
        (fires[i].getTime() - fires[i - 1].getTime()) / (1000 * 3600);
      expect(gapHours).toBeGreaterThanOrEqual(167); // 6d 23h
      expect(gapHours).toBeLessThanOrEqual(169); // 7d 1h
    }
  });
});

// ---------------------------------------------------------------------------
// 5. sync-integrity — twice weekly (Sun & Wed) at 4 AM
//    Default: '0 4 * * 0,3'
// ---------------------------------------------------------------------------

describe('sync-integrity schedule', () => {
  const start = new Date('2025-11-01T00:00:00.000Z');
  const fires = nextFires(appConfig.sync.integrity, start, 6);

  it('fires only on Sun (0) or Wed (3)', () => {
    for (const d of fires) {
      const dow = dowInIsrael(d);
      expect([0, 3]).toContain(dow);
    }
  });

  it('fires at 4 AM Israel time', () => {
    for (const d of fires) {
      expect(hourInIsrael(d)).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. analysis-pipeline — daily at 5 AM, Sun–Thu
//    Default: '0 5 * * 0-4'
// ---------------------------------------------------------------------------

describe('analysis-pipeline schedule', () => {
  const start = new Date('2025-11-02T21:55:00.000Z');
  const fires = nextFires(appConfig.sync.analysis, start, 5);

  it('fires only on Sun–Thu', () => {
    for (const d of fires) {
      expect(dowInIsrael(d)).toBeLessThanOrEqual(4);
    }
  });

  it('fires at 5 AM Israel time', () => {
    for (const d of fires) {
      expect(hourInIsrael(d)).toBe(5);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. election-candidate-sync — daily at 7 AM
//    Default: '0 7 * * *'
// ---------------------------------------------------------------------------

describe('election-candidate-sync schedule', () => {
  const start = new Date('2025-11-03T00:00:00.000Z');
  const fires = nextFires(appConfig.elections2026.candidateSyncCron, start, 7);

  it('fires every day (all dow values 0–6 appear across 7 fires)', () => {
    const days = new Set(fires.map((d) => dowInIsrael(d)));
    // 7 consecutive daily fires must cover 7 distinct dow values
    expect(days.size).toBe(7);
  });

  it('fires at 7 AM Israel time', () => {
    for (const d of fires) {
      expect(hourInIsrael(d)).toBe(7);
    }
  });

  it('fires exactly once per day (~24 h gaps)', () => {
    for (let i = 1; i < fires.length; i++) {
      const gapHours =
        (fires[i].getTime() - fires[i - 1].getTime()) / (1000 * 3600);
      expect(gapHours).toBeGreaterThanOrEqual(23);
      expect(gapHours).toBeLessThanOrEqual(25);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Analysis-pipeline recess-skip logic
// ---------------------------------------------------------------------------

describe('analysis-pipeline recess-skip logic', () => {
  describe('summer recess', () => {
    const { summerRecess } = appConfig.knessetCalendar;

    it('skips on summer recess start day', () => {
      const d = new Date(
        2025,
        summerRecess.startMonth - 1,
        summerRecess.startDay,
        5,
        0,
        0,
      );
      expect(isInRecess(d)).toEqual({ skipped: true, reason: 'summer-recess' });
    });

    it('skips mid-summer (month strictly between start and end)', () => {
      // September is well within summer recess (Aug 1 – Oct 14)
      const d = new Date(2025, 8, 15, 5, 0, 0); // 15 Sep 2025
      expect(isInRecess(d)).toEqual({ skipped: true, reason: 'summer-recess' });
    });

    it('skips on summer recess end day', () => {
      const d = new Date(
        2025,
        summerRecess.endMonth - 1,
        summerRecess.endDay,
        5,
        0,
        0,
      );
      expect(isInRecess(d)).toEqual({ skipped: true, reason: 'summer-recess' });
    });

    it('does NOT skip the day after summer recess ends (Oct 15)', () => {
      const d = new Date(
        2025,
        summerRecess.endMonth - 1,
        summerRecess.endDay + 1,
        5,
        0,
        0,
      );
      expect(isInRecess(d).skipped).toBe(false);
    });

    it('does NOT skip the day before summer recess starts (Jul 31)', () => {
      const d = new Date(
        2025,
        summerRecess.startMonth - 1,
        summerRecess.startDay - 1,
        5,
        0,
        0,
      );
      expect(isInRecess(d).skipped).toBe(false);
    });
  });

  describe('passover recess', () => {
    const { passoverRecess } = appConfig.knessetCalendar;

    it('skips on passover recess start day', () => {
      const d = new Date(
        2025,
        passoverRecess.startMonth - 1,
        passoverRecess.startDay,
        5,
        0,
        0,
      );
      expect(isInRecess(d)).toEqual({
        skipped: true,
        reason: 'passover-recess',
      });
    });

    it('skips mid-passover', () => {
      // Apr 10 is within Apr 1–19
      const d = new Date(2025, 3, 10, 5, 0, 0);
      expect(isInRecess(d)).toEqual({
        skipped: true,
        reason: 'passover-recess',
      });
    });

    it('skips on passover recess end day', () => {
      const d = new Date(
        2025,
        passoverRecess.startMonth - 1,
        passoverRecess.endDay,
        5,
        0,
        0,
      );
      expect(isInRecess(d)).toEqual({
        skipped: true,
        reason: 'passover-recess',
      });
    });

    it('does NOT skip the day after passover recess ends (Apr 20)', () => {
      const d = new Date(
        2025,
        passoverRecess.startMonth - 1,
        passoverRecess.endDay + 1,
        5,
        0,
        0,
      );
      expect(isInRecess(d).skipped).toBe(false);
    });

    it('does NOT skip the day before passover recess (Mar 31)', () => {
      const d = new Date(
        2025,
        passoverRecess.startMonth - 1,
        passoverRecess.startDay - 1,
        5,
        0,
        0,
      );
      expect(isInRecess(d).skipped).toBe(false);
    });
  });

  describe('normal working periods', () => {
    it('does NOT skip during November (active session)', () => {
      const d = new Date(2025, 10, 5, 5, 0, 0); // Nov 5
      expect(isInRecess(d).skipped).toBe(false);
    });

    it('does NOT skip during January', () => {
      const d = new Date(2026, 0, 12, 5, 0, 0);
      expect(isInRecess(d).skipped).toBe(false);
    });

    it('does NOT skip during March (before passover)', () => {
      const d = new Date(2026, 2, 20, 5, 0, 0);
      expect(isInRecess(d).skipped).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Timezone sanity — all tasks use Asia/Jerusalem
// ---------------------------------------------------------------------------

describe('timezone config', () => {
  it('sync timezone is Asia/Jerusalem', () => {
    expect(appConfig.sync.timezone).toBe('Asia/Jerusalem');
  });

  it('cron-parser respects Asia/Jerusalem (UTC+2/+3 per DST)', () => {
    // In winter (UTC+2), midnight IL = 22:00 UTC previous day.
    // '0 1 * * *' should fire at 23:00 UTC.
    const winterStart = new Date('2025-12-01T00:00:00.000Z'); // Dec, UTC+2
    const [fire] = nextFires('0 1 * * *', winterStart, 1);
    // 1 AM Israel winter = 23:00 UTC
    expect(fire.getUTCHours()).toBe(23);

    // In summer (UTC+3), 1 AM IL = 22:00 UTC.
    const summerStart = new Date('2025-06-01T00:00:00.000Z'); // Jun, UTC+3
    const [fireSummer] = nextFires('0 1 * * *', summerStart, 1);
    expect(fireSummer.getUTCHours()).toBe(22);
  });
});
