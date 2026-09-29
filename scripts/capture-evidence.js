#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const screenshots = path.join(root, "screenshots");
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
const width = 1600;
const height = 900;

function browserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome or Edge is required. Set CHROME_PATH to its executable path.");
  return found;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function json(value) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function page(title, eyebrow, intro, content) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
  body { background: #071528; color: #eef5ff; font-family: "Segoe UI", Arial, sans-serif; }
  main { width: 100%; height: 100%; padding: 44px 55px 42px; background: radial-gradient(circle at 88% 0%, #174a62 0%, transparent 34%), #071528; }
  .eyebrow { color: #70ddba; text-transform: uppercase; font-size: 15px; font-weight: 750; letter-spacing: .16em; }
  h1 { margin: 15px 0 8px; font-size: 46px; line-height: 1.1; letter-spacing: -.035em; }
  .intro { margin: 0 0 25px; color: #b0c5de; font-size: 19px; line-height: 1.4; }
  .grid { display: grid; grid-template-columns: 510px minmax(0, 1fr); gap: 22px; height: 620px; }
  .stack { display: grid; grid-template-rows: 1fr 1fr; gap: 20px; min-height: 0; }
  .panel { min-width: 0; min-height: 0; padding: 21px 25px; border: 1px solid #294762; border-radius: 17px; background: #0d2038; overflow: hidden; }
  .panel h2 { margin: 0 0 12px; color: #79e4c2; font-size: 18px; font-weight: 700; }
  .panel p { color: #a6bfd8; margin: 0 0 12px; font-size: 14px; }
  pre { margin: 0; color: #e5f2ff; font: 15px/1.45 Consolas, "Courier New", monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  .response pre { font-size: 13.5px; line-height: 1.4; }
  .proof { height: 660px; }
  .proof pre { font-size: 14px; line-height: 1.39; }
  .meta { margin-top: 21px; color: #9bb5d0; font-size: 14px; }
  .meta strong { color: #79e4c2; }
</style></head><body><main><div class="eyebrow">${escapeHtml(eyebrow)}</div>
<h1>${escapeHtml(title)}</h1><p class="intro">${escapeHtml(intro)}</p>${content}</main></body></html>`;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      windowsHide: true,
      shell: options.shell ?? false,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeout ?? 90000);
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`${command} timed out.\n${output.slice(-3000)}`));
      else resolve({ code, output });
    });
  });
}

function imageSize(filename) {
  const bytes = fs.readFileSync(filename);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Browser did not create a PNG: ${filename}`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function screenshot(chrome, temp, name, url) {
  const output = path.join(temp, name);
  const profile = path.join(temp, `profile-${name}`);
  const result = await run(chrome, [
    "--headless=new", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
    "--force-device-scale-factor=1", `--window-size=${width},${height}`,
    "--virtual-time-budget=6000", `--user-data-dir=${profile}`, `--screenshot=${output}`, url
  ], { timeout: 45000 });
  if (result.code !== 0) throw new Error(`Browser capture of ${name} exited ${result.code}.\n${result.output.slice(-3000)}`);
  const size = imageSize(output);
  if (size.width !== width || size.height !== height) {
    throw new Error(`${name} is ${size.width}x${size.height}; expected ${width}x${height}.`);
  }
  return output;
}

async function getJson(base, route) {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`GET ${route} returned ${response.status}; evidence was not captured.`);
  return response.json();
}

function hasKeyValue(node, key, value) {
  if (!node || typeof node !== "object") return false;
  if (node[key] === value) return true;
  return Object.values(node).some((child) => hasKeyValue(child, key, value));
}

async function main() {
  const chrome = browserPath();
  const app = require(path.join(root, "src", "app"));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kinetic-evidence-"));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      if (server.listening) resolve();
      else { server.once("listening", resolve); server.once("error", reject); }
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const docsResponse = await fetch(base + "/docs/", { signal: AbortSignal.timeout(10000) });
    if (!docsResponse.ok || !(await docsResponse.text()).includes("Swagger UI")) {
      throw new Error("Swagger UI was not served successfully at /docs/.");
    }

    const lead = await getJson(base, "/api/leads/lead-001");
    const accounts = await getJson(base, "/api/accounts");
    assert.ok(Array.isArray(accounts), "/api/accounts must return an array");
    const account = accounts.find((item) => item.id === lead.accountId);
    assert.ok(account, `Account ${lead.accountId} was not found`);
    const linked = await getJson(base, "/api/leads/lead-001/score");
    assert.ok(hasKeyValue(linked, "leadId", "lead-001"), "Linked response is missing leadId");
    assert.ok(hasKeyValue(linked, "accountId", "acct-analytics-002"), "Linked response is missing accountId");
    assert.ok(hasKeyValue(linked, "score", 89), "Linked response is missing the fixture score 89");
    assert.ok(hasKeyValue(linked, "tier", "high-intent"), "Linked response is missing its high-intent tier");

    const npm = process.platform === "win32" ? "cmd.exe" : "npm";
    const npmArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd test"] : ["test"];
    const tests = await run(npm, npmArgs, { timeout: 120000 });
    if (tests.code !== 0) throw new Error(`npm test failed (${tests.code}); proof screenshot was not updated.\n${tests.output.slice(-4000)}`);
    const cleanOutput = tests.output.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");
    const lines = cleanOutput.trimEnd().split("\n");
    assert.match(cleanOutput, /(?:ℹ|#) tests \d+/u, "npm test did not report a test count");
    assert.match(cleanOutput, /(?:ℹ|#) fail 0/u, "npm test did not report zero failures");
    const reportLines = lines.filter((line) => /^(?:✔|✖|ℹ|# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms))/u.test(line));
    const excerpt = reportLines.slice(-27).join("\n");

    const linkedExcerpt = {
      leadId: linked.leadId,
      accountId: linked.accountId,
      modelVersion: linked.modelVersion,
      provenance: linked.provenance,
      breakdown: linked.breakdown,
      result: {
        score: linked.result.score,
        tier: linked.result.tier,
        recommendedNextAction: linked.result.recommendedNextAction
      }
    };

    const featureHtml = page("One lead. One account. One explainable score.", "Observed API workflow",
      "Synthetic source records are joined by accountId; the linked score is returned by the running API.",
      `<div class="grid"><div class="stack">
        <section class="panel"><h2>GET /api/leads/lead-001</h2><pre>${json({
          id: lead.id, accountId: lead.accountId, engagementScore: lead.engagementScore,
          intentSignals: lead.intentSignals
        })}</pre></section>
        <section class="panel"><h2>Account from GET /api/accounts</h2><pre>${json({
          id: account.id, employees: account.employees, annualRevenue: account.annualRevenue
        })}</pre></section></div>
        <section class="panel response"><h2>GET /api/leads/lead-001/score → 200 · selected response fields</h2><pre>${json(linkedExcerpt)}</pre></section></div>
        <div class="meta">Source: local Express service, synthetic fixtures. <strong>Score 89 / high-intent</strong> observed in the HTTP response.</div>`);
    const proofHtml = page("Tests passed on this checkout.", "Observed verification",
      "Selected test and summary lines from the actual npm test output on this checkout.",
      `<section class="panel proof"><h2>npm test · exit code ${tests.code}</h2><pre>${escapeHtml(reportLines.length > 27 ? "[Earlier test lines omitted]\n" + excerpt : excerpt)}</pre></section>
       <div class="meta">The screenshot proves only this local test run; GitHub CI and CodeQL require separate results.</div>`);
    const featurePath = path.join(temp, "feature.html");
    const proofPath = path.join(temp, "proof.html");
    fs.writeFileSync(featurePath, featureHtml, "utf8");
    fs.writeFileSync(proofPath, proofHtml, "utf8");

    const files = [
      ["01-hero.png", await screenshot(chrome, temp, "01-hero.png", base + "/docs/")],
      ["02-feature.png", await screenshot(chrome, temp, "02-feature.png", pathToFileURL(featurePath).href)],
      ["03-proof.png", await screenshot(chrome, temp, "03-proof.png", pathToFileURL(proofPath).href)]
    ];
    fs.mkdirSync(screenshots, { recursive: true });
    for (const [name, source] of files) {
      const target = path.join(screenshots, name);
      fs.copyFileSync(source, target);
      const sha256 = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
      console.log(`${name}: ${width}x${height}, sha256 ${sha256}`);
    }
    console.log(`Captured local /docs, linked fixture score 89, and passing npm test output (${tests.code}).`);
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
