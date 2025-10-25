/* Minimal, valid OpenAPI 3.1 doc writer with zero deps. */
const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toYaml(obj, indent = 0) {
  const sp = "  ".repeat(indent);
  if (obj === null) return "null";
  if (obj === undefined) return "";
  if (typeof obj !== "object") {
    if (typeof obj === "string") {
      // quote strings that contain special YAML chars
      if (/[:{}\[\],&*#?|<>=!%@\\]/.test(obj)) return JSON.stringify(obj);
      return obj.replace(/\n/g, "\\n");
    }
    return String(obj);
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map(v => `${sp}- ${toYaml(v, indent + 1).replace(/^\s+/, "")}`).join("\n");
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  return keys.map(k => {
    const v = obj[k];
    const head = `${sp}${k}:`;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const body = toYaml(v, indent + 1);
      return `${head}\n${body}`;
    }
    return `${head} ${toYaml(v, indent + 1)}`;
  }).join("\n");
}

const doc = {
  openapi: "3.1.0",
  info: { title: "AidIN API", version: "1.0.0" },
  paths: {
    "/api/admin/modules": {
      get: { summary: "List available modules", responses: { "200": { description: "OK" } } }
    },
    "/api/admin/role-modules": {
      get: { summary: "List role modules", responses: { "200": { description: "OK" } } },
      put: { summary: "Upsert role modules", responses: { "200": { description: "OK" } } }
    },
    "/api/admin/user-modules": {
      get: { summary: "Get user modules", responses: { "200": { description: "OK" } } },
      put: { summary: "Upsert user modules", responses: { "200": { description: "OK" } } }
    }
  }
};

const outDir = path.join(process.cwd(), "docs");
ensureDir(outDir);
const outFile = path.join(outDir, "openapi.yaml");
const yaml = toYaml(doc);
fs.writeFileSync(outFile, yaml + "\n", "utf8");
console.log(`Wrote ${outFile} (${Buffer.byteLength(yaml, "utf8")} bytes)`);
