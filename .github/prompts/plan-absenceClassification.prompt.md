## ניתוח: סינון היעדרויות — מוצדקות מול לא מוצדקות

### ממצא קריטי: באג קיים בנתונים

גיליתי שבקוד הנוכחי ב-[transforms.ts](src/lib/knesset/transforms.ts), הפונקציה `mapV4ResultCode()` ממפה **כל קוד שאינו 7/8/9** ל-`'absent'`. אבל ב-API של הכנסת:

| ResultCode | ResultDesc  | משמעות         | מה קורה היום        |
| ---------- | ----------- | -------------- | ------------------- |
| **6**      | **"נוכח"**  | נוכח, לא הצביע | **נספר כ"נעדר"** ❌ |
| 7          | "בעד"       | הצביע בעד      | ✅                  |
| 8          | "נגד"       | הצביע נגד      | ✅                  |
| 9          | "נמנע"      | נמנע           | ✅                  |
| **11**     | **"הצביע"** | הצבעה חשאית    | **נספר כ"נעדר"** ❌ |

**כלומר ח"כים שהיו נוכחים פיזית אבל לא הצביעו — נספרים כנעדרים. זה מנפח את מספרי ההיעדרויות.**

### מקורות מידע זמינים לסיווג היעדרויות

| מקור                                     | מה נותן                                          | סטטוס                     |
| ---------------------------------------- | ------------------------------------------------ | ------------------------- |
| `ResultCode=6` מהAPI                     | ח"כ נכח אבל לא הצביע                             | קיים, ממופה בטעות כ"נעדר" |
| Open Knesset `members/presence`          | שעות נוכחות **יומיות** בבניין הכנסת (144K שורות) | **לא משולב** כרגע         |
| `committeeSessions` + `committeeMembers` | ישיבות ועדה שחפפו להצבעה                         | נתונים קיימים, לא מוצלבים |
| תפקידים ממשלתיים                         | שר/סגן שר בזמן ההצבעה                            | נתונים קיימים, לא מוצלבים |

### מגבלת ה-API — אין סיבת היעדרות מפורשת

ה-API של הכנסת **לא חושף** נתוני טיסות לחו"ל, חופשות, או סיבות היעדרות מפורשות. כל הסיווג חייב להתבסס על **הצלבת נתונים**.

### קטגוריות היעדרות מוצעות

1. **"נוכח ולא הצביע"** — ResultCode=6. **מוצדק באופן ודאי.**
2. **"בישיבת ועדה"** — נעדר מהמליאה אבל ישיבת ועדה חפפה לזמן ההצבעה. **ככל הנראה מוצדק.**
3. **"בתפקיד ממשלתי"** — החבר מכהן כשר/סגן שר. **אולי מוצדק.**
4. **"נוכח בכנסת"** — שעות נוכחות > 0 באותו יום (מנתוני presence), אבל לא הצביע. **מוצדק חלקית.**
5. **"לא נוכח"** — לא היה בבניין הכנסת כלל. **לא מוצדק.**

---

## Plan: Absence Classification Feature

**TL;DR**: Fix a critical data bug (ResultCode=6 mapped as "absent"), integrate new data sources (daily presence hours, committee session overlap), and build a classification system that distinguishes justified from unjustified absences.

**Steps**

### Phase 1: Fix existing data bug (high value, low effort)

1. Fix `mapV4ResultCode()` in [transforms.ts](src/lib/knesset/transforms.ts) — return `'present'` for code 6, `'voted'` for code 11
2. Add DB migration to support new `voteValue` options (`'present'`, `'voted'`)
3. Update [sync-votes.ts](src/pipeline/jobs/sync-votes.ts) to store corrected values
4. Backfill K25 vote results to correct wrongly-mapped code=6 records

### Phase 2: Integrate presence data (_parallel with phase 1_)

5. Create `member_presence` table (mk_id, date, total_attended_hours)
6. Create `sync-presence.ts` pipeline job fetching Open Knesset `members/presence/presence.csv`
7. Register job in pipeline schedule

### Phase 3: Absence classification logic

8. Create classification function that cross-references vote absence with: committee session overlap, government positions, daily presence hours
9. Pre-compute aggregated stats per member (counts per absence category)

### Phase 4: UI updates

10. Update `MemberCard` — show justified vs. unjustified counts with distinct visual indicators
11. Add "most unjustified absences" sort option to `MembersFilter`
12. Add absence breakdown to member detail page
13. Add i18n keys across all 4 locales

**Relevant files**

- [src/lib/knesset/transforms.ts](src/lib/knesset/transforms.ts) — `mapV4ResultCode()` bug fix
- [src/lib/db/schema.ts](src/lib/db/schema.ts) — `memberVotes` table, new `memberPresence` table
- [src/pipeline/jobs/sync-votes.ts](src/pipeline/jobs/sync-votes.ts) — uses transform functions
- [src/pipeline/jobs/sync-committee-members.ts](src/pipeline/jobs/sync-committee-members.ts) — reference for CSV sync pattern
- [src/app/[locale]/(public)/members/page.tsx](<src/app/%5Blocale%5D/(public)/members/page.tsx>) — absence aggregation logic
- [src/components/members/MemberCard.tsx](src/components/members/MemberCard.tsx) — absence display
- [src/components/members/MembersFilter.tsx](src/components/members/MembersFilter.tsx) — sort dropdown

**Verification**

1. `pnpm type-check` passes
2. Compare absence counts before/after fix — code=6 should no longer inflate counts
3. Spot-check known MKs (e.g. ministers who miss votes regularly)
4. Validate committee session time overlap logic with manual examples

**Decisions**

- No API exists for explicit absence reasons — classification is inferred from data cross-referencing
- Committee overlap ≠ guaranteed attendance (we can only say "a session existed")
- Presence data is daily, not per-vote — shows "was in building that day" not "was available for specific vote"
- Government ministers regularly miss votes for legitimate duties — this is normal

**Further Considerations**

1. **Ship Phase 1 first?** The ResultCode bug fix is high-value and low-effort. Recommended to ship it separately before the full classification feature.
2. **"Present but didn't vote"** — in Israeli politics this is sometimes a deliberate political signal. Show as a separate category? Recommended: yes.
3. **Backfill scope** — re-sync all K25 votes or also fix legacy K20-K24?
