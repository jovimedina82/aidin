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
  }
};
