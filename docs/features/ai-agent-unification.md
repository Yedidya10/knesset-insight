# Unified AI Agent Configuration — Architecture Guide

A practical guide for keeping GitHub Copilot and Claude Code (or any AI coding agent) in sync across a single codebase.

## The Problem

Each AI coding tool reads different configuration files:

```
GitHub Copilot                          Claude Code
────────────────                        ──────────────
.github/copilot-instructions.md  ✅     ❌
.github/instructions/*.md        ✅     ❌
CLAUDE.md                        ❌     ✅
.claude/settings.json            ❌     ✅
.claude/agents/*.md              ❌     ✅
Copilot /memories/repo/          ✅     ❌
~/.claude/projects/              ❌     ✅
```

Without coordination, each tool gets a partial, inconsistent view of your project's rules. You end up maintaining duplicate content that drifts over time.

## The Solution: Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Domain Rules (Single Source of Truth)         │
│  .github/instructions/*.md                              │
│  Each file has applyTo frontmatter for file patterns    │
│  ─ Copilot loads these automatically                    │
│  ─ Claude Code reads them when directed by CLAUDE.md    │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Tool-Specific Entry Points                    │
│  .github/copilot-instructions.md  ← Copilot baseline   │
│  CLAUDE.md                        ← Claude baseline     │
│  Both contain:                                          │
│    • Project overview & tech stack                      │
│    • Core principles                                    │
│    • Reference table pointing to Layer 1 files          │
│    • Workflow conventions                               │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Tool-Specific Extensions                      │
│  .claude/settings.json            ← Permissions         │
│  .claude/agents/*.md              ← Agent personas      │
│  .claude/commands/*.md            ← Slash commands      │
│  /memories/repo/                  ← Copilot memory      │
└─────────────────────────────────────────────────────────┘
```

### Key Principle

**Layer 1 is authoritative.** Layer 2 files are entry points that reference Layer 1. Layer 3 is tool-specific and doesn't need syncing.

## Decision Tree: Where Does This Go?

```
Is it a domain-specific coding rule?
  (e.g., "always use Zod for API validation")
  → .github/instructions/<domain>.instructions.md

Is it a project-wide principle or convention?
  (e.g., "all text must be translated", tech stack overview)
  → BOTH copilot-instructions.md AND CLAUDE.md (Layer 2)

Is it a tool-specific permission or agent persona?
  (e.g., Claude Code bash permissions, agent definitions)
  → .claude/settings.json or .claude/agents/ (Layer 3)

Is it accumulated project knowledge (IDs, gotchas)?
  → CLAUDE.md "Key Domain Knowledge" section
  → /memories/repo/ for Copilot
```

## Setup Steps for a New Project

### Step 1: Create the instruction files directory

```bash
mkdir -p .github/instructions
```

### Step 2: Create domain instruction files

For each domain in your project, create a file with `applyTo` frontmatter:

```markdown
---
applyTo: 'src/components/**'
---

# Component Rules

- Use Server Components by default
- All text via translation function
  ...
```

### Step 3: Create `copilot-instructions.md`

```markdown
# Project Name — Copilot Instructions

## Project Overview

...

## Detailed Instruction Files

| File                         | Applies to          | Summary         |
| ---------------------------- | ------------------- | --------------- |
| `components.instructions.md` | `src/components/**` | Component rules |

...

## Core Principles

...

## Tech Stack

...

## Workflow

...
```

### Step 4: Create `CLAUDE.md`

Same structure as copilot-instructions.md, but add the directive:

```markdown
## Domain-Specific Instruction Files

**IMPORTANT**: Before working on any file, check if it matches a pattern below.
If it does, **read the corresponding instruction file first** using
`cat .github/instructions/<filename>`.

| File | Applies to | Summary |
...
```

### Step 5: Create `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(pnpm:*)",
      "Read(*)"
    ],
    "deny": ["Bash(rm -rf:*)", "Bash(git push --force:*)"]
  }
}
```

### Step 6: Add CI sync check

Copy `scripts/check-ai-config-sync.ts` to your project and add to your CI workflow:

```yaml
ai-config-sync:
  name: AI Config Sync
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npx tsx scripts/check-ai-config-sync.ts
```

## CI Sync Check: What It Validates

| Check                                                   | Severity | Description                                                                                      |
| ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| Instruction files referenced in copilot-instructions.md | Error    | Every `.github/instructions/*.md` must appear in the table                                       |
| Instruction files referenced in CLAUDE.md               | Error    | Every `.github/instructions/*.md` must appear in the table                                       |
| Required sections exist                                 | Error    | Both files must have: Project Overview, Tech Stack, Core Principles, Instruction Files, Workflow |
| applyTo frontmatter                                     | Error    | Every instruction file must have `applyTo` in its frontmatter                                    |
| Count parity                                            | Warning  | Both reference tables should list the same number of files                                       |

## Common Pitfalls

### 1. Putting domain rules in CLAUDE.md or copilot-instructions.md

**Wrong:** Writing "always validate API inputs with Zod" in CLAUDE.md only.
**Right:** Put it in `.github/instructions/api.instructions.md`, reference from both entry points.

### 2. Duplicating instruction file content in CLAUDE.md

**Wrong:** Copy-pasting the full content of `trigger-basic.instructions.md` into CLAUDE.md.
**Right:** CLAUDE.md has a reference table; Claude Code reads the file when needed.

### 3. Forgetting to update both entry points

**Wrong:** Adding a new instruction file and only updating copilot-instructions.md.
**Right:** The CI check catches this automatically.

### 4. Accumulated knowledge only in one tool's memory

**Wrong:** Domain gotchas only in `/memories/repo/` (Copilot can't share with Claude Code).
**Right:** Critical knowledge in CLAUDE.md "Key Domain Knowledge" + `/memories/repo/` for Copilot.

## Other Tools

### Cursor (.cursorrules)

If you also use Cursor, create `.cursorrules` with the same structure as CLAUDE.md (project baseline + instruction file references). Add it to the CI check.

### Windsurf (.windsurfrules)

Same approach — create `.windsurfrules` mirroring the entry point pattern.

### Aider (.aider.conf.yml)

Aider uses `--read` flags. Point it at `.github/instructions/` files in your config.

## File Structure Summary

```
your-project/
├── .github/
│   ├── copilot-instructions.md           ← Copilot entry point (Layer 2)
│   ├── instructions/                     ← Domain rules (Layer 1)
│   │   ├── api.instructions.md
│   │   ├── components.instructions.md
│   │   └── ...
│   └── workflows/
│       └── ci.yml                        ← Includes ai-config-sync job
├── CLAUDE.md                             ← Claude Code entry point (Layer 2)
├── .claude/
│   ├── settings.json                     ← Permissions (Layer 3)
│   └── agents/                           ← Agent personas (Layer 3)
├── scripts/
│   └── check-ai-config-sync.ts           ← CI sync checker
└── docs/
    └── ai-agent-unification.md           ← This guide
```
