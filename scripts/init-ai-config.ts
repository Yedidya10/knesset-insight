#!/usr/bin/env node
/**
 * AI Config Initializer
 *
 * Bootstraps a unified AI agent configuration structure for any project.
 * Detects existing AI config files, reports their state, and generates
 * a unified structure.
 *
 * Usage: npx tsx scripts/init-ai-config.ts [--dry-run]
 *
 * Zero dependencies — uses only Node.js built-ins.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Detection ──────────────────────────────────────────────────────────────

interface DetectedFile {
  path: string;
  relativePath: string;
  tool: string;
  exists: boolean;
}

const AI_CONFIG_FILES: Omit<DetectedFile, 'exists'>[] = [
  {
    path: join(ROOT, 'CLAUDE.md'),
    relativePath: 'CLAUDE.md',
    tool: 'Claude Code',
  },
  {
    path: join(ROOT, '.github', 'copilot-instructions.md'),
    relativePath: '.github/copilot-instructions.md',
    tool: 'GitHub Copilot',
  },
  {
    path: join(ROOT, '.cursorrules'),
    relativePath: '.cursorrules',
    tool: 'Cursor',
  },
  {
    path: join(ROOT, '.windsurfrules'),
    relativePath: '.windsurfrules',
    tool: 'Windsurf',
  },
  {
    path: join(ROOT, '.clinerules'),
    relativePath: '.clinerules',
    tool: 'Cline',
  },
  {
    path: join(ROOT, '.aider.conf.yml'),
    relativePath: '.aider.conf.yml',
    tool: 'Aider',
  },
  {
    path: join(ROOT, '.claude', 'settings.json'),
    relativePath: '.claude/settings.json',
    tool: 'Claude Code',
  },
  {
    path: join(ROOT, '.claude', 'settings.local.json'),
    relativePath: '.claude/settings.local.json',
    tool: 'Claude Code',
  },
];

function detect(): DetectedFile[] {
  return AI_CONFIG_FILES.map((f) => ({
    ...f,
    exists: existsSync(f.path),
  }));
}

function detectInstructionFiles(): string[] {
  const dir = join(ROOT, '.github', 'instructions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.instructions.md'))
    .sort();
}

// ─── Templates ──────────────────────────────────────────────────────────────

function generateCopilotInstructions(projectName: string): string {
  return `# ${projectName} — Copilot Instructions

## Project Overview

<!-- TODO: Describe your project -->

## Detailed Instruction Files

This file provides the global rules loaded in **every** conversation.
For domain-specific rules, see the files in \`.github/instructions/\` — each is loaded automatically when you work on matching files (based on its \`applyTo\` frontmatter):

| File | Applies to | Summary |
| ---- | ---------- | ------- |
| \`_example.instructions.md\` | \`src/example/**\` | Example domain rules |

> **When multiple domains overlap**, all matching instruction files are loaded together.

## Core Principles

<!-- TODO: List your project's core principles -->

1. **Principle one** — description
2. **Principle two** — description

## Tech Stack

<!-- TODO: List your tech stack -->

- **Framework**: 
- **Styling**: 
- **Database**: 

## File Conventions

<!-- TODO: Define your naming conventions -->

- Components: PascalCase (\`MyComponent.tsx\`)
- Utilities: camelCase (\`myUtil.ts\`)

## Workflow

- **After completing a fix or feature, always create a commit** with a clear conventional-commit message.
- **Every commit must pass type-checking** before committing.
`;
}

function generateClaudeMd(projectName: string): string {
  return `# ${projectName} — Claude Code Instructions

## Project Overview

<!-- TODO: Describe your project -->

## Domain-Specific Instruction Files

**IMPORTANT**: Before working on any file, check if it matches a pattern below. If it does, **read the corresponding instruction file first** using \`cat .github/instructions/<filename>\`.

| File | Applies to | Summary |
| ---- | ---------- | ------- |
| \`_example.instructions.md\` | \`src/example/**\` | Example domain rules |

When multiple domains overlap, read ALL matching instruction files.

## Core Principles

<!-- TODO: List your project's core principles (same as copilot-instructions.md) -->

1. **Principle one** — description
2. **Principle two** — description

## Tech Stack

<!-- TODO: List your tech stack (same as copilot-instructions.md) -->

- **Framework**: 
- **Styling**: 
- **Database**: 

## File Conventions

<!-- TODO: Define your naming conventions -->

- Components: PascalCase (\`MyComponent.tsx\`)
- Utilities: camelCase (\`myUtil.ts\`)

## Workflow

- **After completing a fix or feature, always create a commit** with a clear conventional-commit message.
- **Every commit must pass type-checking** before committing.

## Key Domain Knowledge

<!-- TODO: Add project-specific knowledge that both tools need -->

## Memory Bridge

Claude Code cannot access GitHub Copilot's \`/memories/repo/\` directory. The domain knowledge above is a snapshot. For the latest project knowledge, also check:

- \`docs/\` — architecture decisions and feature specs
- \`.github/instructions/\` — domain-specific coding rules
`;
}

function generateExampleInstruction(): string {
  return `---
applyTo: "src/example/**"
---

# Example Domain Rules

<!-- 
  This is an example instruction file. 
  Replace with your actual domain rules.
  The applyTo pattern determines which files trigger this instruction.
-->

## Rules

1. Rule one
2. Rule two
`;
}

function generateClaudeSettings(): string {
  return (
    JSON.stringify(
      {
        permissions: {
          allow: [
            'Bash(cat:*)',
            'Bash(ls:*)',
            'Bash(find:*)',
            'Bash(grep:*)',
            'Bash(git add:*)',
            'Bash(git commit:*)',
            'Bash(git status:*)',
            'Bash(git diff:*)',
            'Bash(git log:*)',
            'Read(*)',
          ],
          deny: [
            'Bash(rm -rf:*)',
            'Bash(git push --force:*)',
            'Bash(git reset --hard:*)',
          ],
        },
      },
      null,
      2,
    ) + '\n'
  );
}

function generateCiWorkflow(): string {
  return `name: AI Config Sync

on:
  push:
    paths:
      - 'CLAUDE.md'
      - '.github/copilot-instructions.md'
      - '.github/instructions/**'
      - 'scripts/check-ai-config-sync.ts'
  pull_request:
    paths:
      - 'CLAUDE.md'
      - '.github/copilot-instructions.md'
      - '.github/instructions/**'
      - 'scripts/check-ai-config-sync.ts'

jobs:
  check:
    name: AI Config Sync Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx tsx scripts/check-ai-config-sync.ts
`;
}

// ─── File writing ───────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would create directory: ${relative(ROOT, dir)}`);
    } else {
      mkdirSync(dir, { recursive: true });
      console.log(`  📁 Created: ${relative(ROOT, dir)}/`);
    }
  }
}

function writeIfNotExists(filePath: string, content: string): void {
  const rel = relative(ROOT, filePath);
  if (existsSync(filePath)) {
    console.log(`  ⏭️  Skipped (exists): ${rel}`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] Would create: ${rel}`);
  } else {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✅ Created: ${rel}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  console.log('🔧 AI Config Initializer\n');

  if (DRY_RUN) {
    console.log('  Running in dry-run mode (no files will be created)\n');
  }

  // Detect existing files
  console.log('── Detecting existing AI config files ──\n');
  const detected = detect();
  const existing = detected.filter((f) => f.exists);
  const missing = detected.filter((f) => !f.exists);

  if (existing.length > 0) {
    console.log('  Found:');
    for (const f of existing) {
      console.log(`    ✅ ${f.relativePath} (${f.tool})`);
    }
  }
  if (missing.length > 0) {
    console.log('  Missing:');
    for (const f of missing) {
      console.log(`    ❌ ${f.relativePath} (${f.tool})`);
    }
  }

  const instructionFiles = detectInstructionFiles();
  if (instructionFiles.length > 0) {
    console.log(`\n  Instruction files (${instructionFiles.length}):`);
    for (const f of instructionFiles) {
      console.log(`    📄 ${f}`);
    }
  } else {
    console.log('\n  No instruction files found in .github/instructions/');
  }

  // Detect project name from package.json
  let projectName = 'My Project';
  const pkgPath = join(ROOT, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) {
        projectName = pkg.name
          .replace(/^@\w+\//, '') // strip scope
          .split('-')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    } catch {
      // ignore
    }
  }

  // Generate files
  console.log('\n── Generating unified structure ──\n');

  ensureDir(join(ROOT, '.github'));
  ensureDir(join(ROOT, '.github', 'instructions'));
  ensureDir(join(ROOT, '.claude'));
  ensureDir(join(ROOT, 'scripts'));

  writeIfNotExists(
    join(ROOT, '.github', 'copilot-instructions.md'),
    generateCopilotInstructions(projectName),
  );
  writeIfNotExists(join(ROOT, 'CLAUDE.md'), generateClaudeMd(projectName));
  writeIfNotExists(
    join(ROOT, '.github', 'instructions', '_example.instructions.md'),
    generateExampleInstruction(),
  );
  writeIfNotExists(
    join(ROOT, '.claude', 'settings.json'),
    generateClaudeSettings(),
  );

  // Copy the sync checker if this script is running from a different project
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const syncCheckerSrc = join(__dirname, 'check-ai-config-sync.ts');
  const syncCheckerDest = join(ROOT, 'scripts', 'check-ai-config-sync.ts');
  if (existsSync(syncCheckerSrc) && syncCheckerSrc !== syncCheckerDest) {
    writeIfNotExists(syncCheckerDest, readFileSync(syncCheckerSrc, 'utf-8'));
  }

  // Offer standalone CI workflow
  const standaloneWorkflow = join(
    ROOT,
    '.github',
    'workflows',
    'ai-config-sync.yml',
  );
  if (!existsSync(join(ROOT, '.github', 'workflows'))) {
    ensureDir(join(ROOT, '.github', 'workflows'));
  }
  writeIfNotExists(standaloneWorkflow, generateCiWorkflow());

  console.log('\n── Done ──\n');
  console.log('Next steps:');
  console.log(
    '  1. Edit CLAUDE.md and copilot-instructions.md with your project details',
  );
  console.log(
    '  2. Replace _example.instructions.md with real domain instruction files',
  );
  console.log('  3. Run: npx tsx scripts/check-ai-config-sync.ts');
  console.log(
    '  4. See docs/ai-agent-unification.md for the full architecture guide\n',
  );
}

main();
