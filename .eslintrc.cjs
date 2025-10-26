module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  env: { es2022: true, node: true },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "dist/",
    "coverage/",
    "prisma/*",
    "docs/reports/**"
  ],
  rules: {
    "react/no-unescaped-entities": "off",
    "react-hooks/rules-of-hooks": "warn",
    "react-hooks/exhaustive-deps": "warn",
    "jsx-a11y/alt-text": "warn",
    "@next/next/no-img-element": "warn",
    "unicorn/prevent-abbreviations": "off",
    "unicorn/filename-case": "off",
    "security/detect-object-injection": "off"
  },
  overrides: [
    {
      files: ["app/**/*.{ts,tsx,js,jsx}", "components/**/*.{ts,tsx,js,jsx}"],
      excludedFiles: ["**/*server.*", "**/api/**", "app/**/route.{ts,js}"],
      rules: {
        "no-restricted-imports": ["error", {
          paths: [
            { name: "node:buffer", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:crypto", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:stream", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:path", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:url", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:util", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:events", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:fs", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:fs/promises", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:os", message: "Server-only module. Use from API routes or server components only." },
            { name: "node:child_process", message: "Server-only module. Use from API routes or server components only." },
            { name: "buffer", message: "Server-only module. Use from API routes or server components only." },
            { name: "crypto", message: "Server-only module. Use from API routes or server components only." },
            { name: "stream", message: "Server-only module. Use from API routes or server components only." },
            { name: "path", message: "Server-only module. Use from API routes or server components only." },
            { name: "url", message: "Server-only module. Use from API routes or server components only." },
            { name: "util", message: "Server-only module. Use from API routes or server components only." },
            { name: "events", message: "Server-only module. Use from API routes or server components only." },
            { name: "fs", message: "Server-only module. Use from API routes or server components only." },
            { name: "fs/promises", message: "Server-only module. Use from API routes or server components only." },
            { name: "os", message: "Server-only module. Use from API routes or server components only." },
            { name: "child_process", message: "Server-only module. Use from API routes or server components only." }
          ]
        }]
      }
    }
  ]
};
