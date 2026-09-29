#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "architecture-diagrams.md");
const outputs = ["request-flow.png", "scoring.png"];
const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");

function browserPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error("Chrome or Edge is required. Set PUPPETEER_EXECUTABLE_PATH to its executable path.");
  }
  return found;
}

function cliPath() {
  const local = path.join(root, "node_modules", "@mermaid-js", "mermaid-cli", "src", "cli.js");
  if (!fs.existsSync(local)) {
    throw new Error("Pinned Mermaid CLI is missing. Run npm ci with PUPPETEER_SKIP_DOWNLOAD=1 first.");
  }
  return local;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    const timer = setTimeout(() => child.kill(), 90000);
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`Mermaid CLI exited ${code}.\n${output.slice(-4000)}`));
    });
  });
}

function imageSize(filename) {
  const bytes = fs.readFileSync(filename);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Mermaid CLI did not create a PNG: ${filename}`);
  }
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

async function main() {
  const markdown = fs.readFileSync(sourcePath, "utf8");
  const diagrams = [...markdown.matchAll(/^```mermaid\s*\r?\n([\s\S]*?)^```[ \t]*$/gm)].map((match) => match[1].trim());
  if (diagrams.length !== outputs.length || diagrams.some((diagram) => !diagram.startsWith("flowchart"))) {
    throw new Error(`Expected ${outputs.length} Mermaid flowcharts in ${sourcePath}; found ${diagrams.length}. Update the output mapping before rendering.`);
  }

  const chrome = browserPath();
  const cli = cliPath();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kinetic-diagrams-"));
  try {
    const config = path.join(temp, "mermaid-config.json");
    fs.writeFileSync(config, JSON.stringify({ theme: "default", securityLevel: "strict" }), "utf8");
    for (let index = 0; index < diagrams.length; index += 1) {
      const input = path.join(temp, `diagram-${index + 1}.mmd`);
      const output = path.join(temp, outputs[index]);
      fs.writeFileSync(input, diagrams[index] + "\n", "utf8");
      await run(process.execPath, [cli, "-i", input, "-o", output, "-b", "white", "-w", "1600", "-c", config], {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: chrome
      });
      console.log(`Rendered ${outputs[index]} from Mermaid block ${index + 1}: ${imageSize(output)}`);
    }
    for (const output of outputs) fs.copyFileSync(path.join(temp, output), path.join(root, output));
    console.log("Updated diagram PNGs from architecture-diagrams.md.");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
