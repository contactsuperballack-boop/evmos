// Runs every *.test.js file under tests/ as its own child process (so
// each gets a clean require-cache and a clean evmos.db, matching how
// they're meant to be run individually) and prints a summary at the end.
// No test framework dependency — this project is deliberately
// zero-external-dependency on the backend, and a plain runner is enough
// for 7 files. Revisit if this grows past what a human wants to scroll
// through.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const TESTS_DIR = __dirname;

function findTestFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findTestFiles(full));
    } else if (entry.name.endsWith(".test.js")) {
      results.push(full);
    }
  }
  return results;
}

const testFiles = findTestFiles(TESTS_DIR).sort();
console.log(`Found ${testFiles.length} test file(s).\n`);

const results = [];
for (const file of testFiles) {
  const label = path.relative(TESTS_DIR, file);
  process.stdout.write(`--- ${label} ---\n`);
  try {
    const output = execFileSync("node", [file], { encoding: "utf8" });
    process.stdout.write(output);
    results.push({ label, ok: true });
  } catch (err) {
    process.stdout.write(err.stdout || "");
    process.stderr.write(err.stderr || "");
    results.push({ label, ok: false });
  }
  console.log("");
}

// Clean up the shared DB file the tests leave behind.
const dbPath = path.join(TESTS_DIR, "..", "evmos.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

console.log("=".repeat(50));
console.log("SUMMARY");
console.log("=".repeat(50));
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.label}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} test files passed.`);
if (failed.length > 0) {
  process.exitCode = 1;
}
