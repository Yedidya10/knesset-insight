/**
 * AI Config Sync Checker
 *
 * Validates that CLAUDE.md and .github/copilot-instructions.md stay in sync:
 * - Every .github/instructions/*.md file is referenced in both
 * - Both files have required sections
 * - Every instruction file has applyTo frontmatter
 *
 * Zero dependencies — uses only Node.js built-ins.
 * Run: node --experimental-strip-types scripts/check-ai-config-sync.ts
 *   or: npx tsx scripts/check-ai-config-sync.ts
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INSTRUCTIONS_DIR = join(ROOT, '.github', 'instructions');
const COPILOT_FILE = join(ROOT, '.github', 'copilot-instructions.md');
const CLAUDE_FILE = join(ROOT, 'CLAUDE.md');

interface CheckResult {
  pass: boolean;
  message: string;
  severity: 'error' | 'warning';
}

const results: CheckResult[] = [];

function check(
  pass: boolean,
  message: string,
  severity: 'error' | 'warning' = 'error',
) {
  results.push({ pass, message, severity });
}

// ─── 1. Gather instruction files ────────────────────────────────────────────

function getInstructionFiles(): string[] {
  if (!existsSync(INSTRUCTIONS_DIR)) {
    check(false, `.github/instructions/ directory does not exist`);
    return [];
  }
  return readdirSync(INSTRUCTIONS_DIR)
    .filter((f) => f.endsWith('.instructions.md'))
    .sort();
}

// ─── 2. Check applyTo frontmatter ──────────────────────────────────────────

function checkFrontmatter(files: string[]): void {
  for (const file of files) {
    const content = readFileSync(join(INSTRUCTIONS_DIR, file), 'utf-8');
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
      check(false, `${file}: missing frontmatter (--- block)`);
      continue;
    }
    const hasApplyTo = /applyTo\s*:/.test(frontmatterMatch[1]);
    check(hasApplyTo, `${file}: has applyTo in frontmatter`);
  }
}

// ─── 3. Check references in a file ─────────────────────────────────────────

function extractReferencedFiles(filePath: string): Set<string> {
  if (!existsSync(filePath)) return new Set();
  const content = readFileSync(filePath, 'utf-8');
  const referenced = new Set<string>();
  // Match instruction file names like `something.instructions.md`
  const regex = /(\S+\.instructions\.md)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // Strip backticks and markdown formatting
    const name = match[1].replace(/[`|]/g, '').trim();
    if (name.endsWith('.instructions.md')) {
      referenced.add(name);
    }
  }
  return referenced;
}

function checkReferences(
  files: string[],
  filePath: string,
  label: string,
): void {
  const referenced = extractReferencedFiles(filePath);
  for (const file of files) {
    const isReferenced = referenced.has(file);
    check(isReferenced, `${label} references ${file}`);
  }
  // Check count match
  const extraRefs = [...referenced].filter(
    (r) => !files.includes(r) && r.endsWith('.instructions.md'),
  );
  for (const extra of extraRefs) {
    check(
      false,
      `${label} references ${extra} but file does not exist in .github/instructions/`,
      'warning',
    );
  }
}

// ─── 4. Check required sections ─────────────────────────────────────────────

function extractHeadings(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const headings: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^#{1,3}\s+(.+)/);
    if (match) headings.push(match[1].trim());
  }
  return headings;
}

function checkRequiredSections(
  filePath: string,
  label: string,
  required: string[],
): void {
  const headings = extractHeadings(filePath);
  const headingsLower = headings.map((h) => h.toLowerCase());
  for (const section of required) {
    const found = headingsLower.some((h) => h.includes(section.toLowerCase()));
    check(found, `${label} has section matching "${section}"`);
  }
}

// ─── 5. Check instruction file count parity ─────────────────────────────────

function checkCountParity(files: string[]): void {
  const copilotRefs = extractReferencedFiles(COPILOT_FILE);
  const claudeRefs = extractReferencedFiles(CLAUDE_FILE);

  // Filter to only actual instruction files
  const copilotInstructionRefs = [...copilotRefs].filter((r) =>
    files.includes(r),
  );
  const claudeInstructionRefs = [...claudeRefs].filter((r) =>
    files.includes(r),
  );

  check(
    copilotInstructionRefs.length === files.length,
    `copilot-instructions.md references ${copilotInstructionRefs.length}/${files.length} instruction files`,
  );
  check(
    claudeInstructionRefs.length === files.length,
    `CLAUDE.md references ${claudeInstructionRefs.length}/${files.length} instruction files`,
  );
  check(
    copilotInstructionRefs.length === claudeInstructionRefs.length,
    `Instruction file count matches: copilot=${copilotInstructionRefs.length}, claude=${claudeInstructionRefs.length}`,
    'warning',
  );
}

// ─── Run all checks ─────────────────────────────────────────────────────────

function main(): void {
  console.log('🔍 AI Config Sync Check\n');

  // Check required files exist
  check(existsSync(COPILOT_FILE), `.github/copilot-instructions.md exists`);
  check(existsSync(CLAUDE_FILE), `CLAUDE.md exists`);

  if (!existsSync(COPILOT_FILE) || !existsSync(CLAUDE_FILE)) {
    printResults();
    process.exit(1);
  }

  const files = getInstructionFiles();
  if (files.length === 0) {
    console.log('No instruction files found.\n');
    printResults();
    process.exit(
      results.some((r) => !r.pass && r.severity === 'error') ? 1 : 0,
    );
  }

  console.log(`Found ${files.length} instruction files:\n`);
  for (const f of files) {
    console.log(`  - ${f}`);
  }
  console.log('');

  // Run checks
  checkFrontmatter(files);
  checkReferences(files, COPILOT_FILE, 'copilot-instructions.md');
  checkReferences(files, CLAUDE_FILE, 'CLAUDE.md');
  checkRequiredSections(COPILOT_FILE, 'copilot-instructions.md', [
    'Project Overview',
    'Tech Stack',
    'Core Principles',
    'Instruction Files',
    'Workflow',
  ]);
  checkRequiredSections(CLAUDE_FILE, 'CLAUDE.md', [
    'Project Overview',
    'Tech Stack',
    'Core Principles',
    'Instruction Files',
    'Workflow',
  ]);
  checkCountParity(files);

  printResults();

  const hasErrors = results.some((r) => !r.pass && r.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
}

function printResults(): void {
  console.log('\n─── Results ───\n');

  const passed = results.filter((r) => r.pass);
  const errors = results.filter((r) => !r.pass && r.severity === 'error');
  const warnings = results.filter((r) => !r.pass && r.severity === 'warning');

  for (const r of passed) {
    console.log(`  ✅ ${r.message}`);
  }
  for (const r of warnings) {
    console.log(`  ⚠️  ${r.message}`);
  }
  for (const r of errors) {
    console.log(`  ❌ ${r.message}`);
  }

  console.log(
    `\n  Total: ${passed.length} passed, ${warnings.length} warnings, ${errors.length} errors\n`,
  );
}

main();
