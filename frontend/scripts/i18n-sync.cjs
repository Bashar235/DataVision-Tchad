/**
 * DataVision Tchad — i18n Sync Tool (Single Source of Truth)
 * ===========================================================
 * The ONE script for all translation maintenance.
 *
 * Usage:
 *   node scripts/i18n-sync.cjs audit   → Report key parity across EN / FR / AR
 *   node scripts/i18n-sync.cjs sync    → Fill missing keys with [MISSING_xx] stubs
 *   node scripts/i18n-sync.cjs clean   → Deduplicate + alphabetise all JSON files
 *
 * Or via npm:
 *   npm run i18n:check   (audit)
 *   npm run i18n:fix     (sync + clean)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const MASTER_LANG = 'en';
const LANGS       = ['en', 'fr', 'ar'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getJsonPath(lang) {
  return path.join(LOCALES_DIR, lang, 'translation.json');
}

function loadJson(lang) {
  const raw = fs.readFileSync(getJsonPath(lang), 'utf-8');
  return JSON.parse(raw);
}

function saveJson(lang, data) {
  // Always sort keys alphabetically for clean git diffs.
  const sorted = Object.fromEntries(
    Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  );
  fs.writeFileSync(getJsonPath(lang), JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}

function pad(str, len) {
  return String(str).padEnd(len);
}

// ─── COMMAND: audit ───────────────────────────────────────────────────────────
function audit() {
  const master     = loadJson(MASTER_LANG);
  const masterKeys = Object.keys(master);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        DataVision Tchad — i18n Parity Audit             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  Master language : ${MASTER_LANG.toUpperCase()} (${masterKeys.length} keys)\n`);

  const otherLangs = LANGS.filter(l => l !== MASTER_LANG);

  for (const lang of otherLangs) {
    const other      = loadJson(lang);
    const otherKeys  = Object.keys(other);
    const missing    = masterKeys.filter(k => !(k in other));   // in EN, not in lang
    const extra      = otherKeys.filter(k => !(k in master));   // in lang, not in EN

    const status = missing.length === 0 && extra.length === 0 ? '✅ IN SYNC' : '⚠️  OUT OF SYNC';

    console.log(`  ┌─ [${lang.toUpperCase()}] ${status}`);
    console.log(`  │  Total keys   : ${otherKeys.length}`);
    console.log(`  │  Missing in ${lang.toUpperCase()} : ${missing.length}`);
    console.log(`  │  Extra in ${lang.toUpperCase()}   : ${extra.length} (not in EN master)`);

    if (missing.length > 0) {
      console.log(`  │`);
      console.log(`  │  Missing keys (add EN value, then run sync):`);
      missing.slice(0, 20).forEach(k => console.log(`  │    - ${k}`));
      if (missing.length > 20) console.log(`  │    ... and ${missing.length - 20} more`);
    }

    if (extra.length > 0) {
      console.log(`  │`);
      console.log(`  │  Extra keys in ${lang.toUpperCase()} (not yet in EN master — merge manually):`);
      extra.slice(0, 20).forEach(k => console.log(`  │    - ${k}  →  "${other[k]}"`));
      if (extra.length > 20) console.log(`  │    ... and ${extra.length - 20} more`);
    }

    console.log(`  └${'─'.repeat(56)}\n`);
  }
  console.log('  Run `npm run i18n:fix` to fill missing keys with stubs.\n');
}

// ─── COMMAND: sync ────────────────────────────────────────────────────────────
function sync() {
  const master = loadJson(MASTER_LANG);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        DataVision Tchad — i18n Sync                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const otherLangs = LANGS.filter(l => l !== MASTER_LANG);

  for (const lang of otherLangs) {
    const other  = loadJson(lang);
    let   added  = 0;

    for (const [key, val] of Object.entries(master)) {
      if (!(key in other)) {
        // Stub value clearly marks what still needs human translation
        other[key] = `[MISSING_${lang.toUpperCase()}] ${val}`;
        added++;
      }
    }

    saveJson(lang, other);
    const total = Object.keys(other).length;
    console.log(`  [${lang.toUpperCase()}] ✅ Synced — ${added} stub(s) added. Total keys: ${total}`);
  }
  console.log('\n  Tip: Search for [MISSING_AR] in your editor to find all untranslated Arabic keys.\n');
}

// ─── COMMAND: clean ───────────────────────────────────────────────────────────
function clean() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        DataVision Tchad — i18n Clean                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const lang of LANGS) {
    const raw  = fs.readFileSync(getJsonPath(lang), 'utf-8');
    // JSON.parse de-duplicates automatically (last-key-wins).
    const data = JSON.parse(raw);
    const before = (raw.match(/"[^"]+"\s*:/g) || []).length;
    const after  = Object.keys(data).length;
    const dupes  = before - after;

    saveJson(lang, data);
    console.log(`  [${lang.toUpperCase()}] ✅ Cleaned — ${after} keys${dupes > 0 ? `, removed ${dupes} duplicate(s)` : ', no duplicates found'} — keys sorted alphabetically.`);
  }
  console.log('');
}

// ─── Router ───────────────────────────────────────────────────────────────────
const cmd = process.argv[2];

switch (cmd) {
  case 'audit':  audit();  break;
  case 'sync':   sync();   break;
  case 'clean':  clean();  break;
  default:
    console.log('\n  DataVision i18n-sync — Usage:\n');
    console.log('    node scripts/i18n-sync.cjs audit   → parity report');
    console.log('    node scripts/i18n-sync.cjs sync    → fill missing keys with stubs');
    console.log('    node scripts/i18n-sync.cjs clean   → deduplicate + sort all JSONs\n');
    console.log('  Or use npm scripts:');
    console.log('    npm run i18n:check   (= audit)');
    console.log('    npm run i18n:fix     (= sync + clean)\n');
    process.exit(1);
}
