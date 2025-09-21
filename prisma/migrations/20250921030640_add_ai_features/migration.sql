-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "departmentId" TEXT;

-- CreateTable
CREATE TABLE "department_keywords" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "department_keywords_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "embedding" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "knowledge_base_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket_kb_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "kbId" TEXT NOT NULL,
    "relevance" REAL NOT NULL DEFAULT 0.0,
    "usedInResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_kb_usage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_kb_usage_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "knowledge_base" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "suggestedDepartment" TEXT,
    "departmentConfidence" REAL DEFAULT 0.0,
    "keywordMatches" TEXT,
    "aiReasoning" TEXT,
    "finalDepartment" TEXT,
    "wasOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_decisions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "department_keywords_departmentId_keyword_key" ON "department_keywords"("departmentId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_kb_usage_ticketId_kbId_key" ON "ticket_kb_usage"("ticketId", "kbId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_decisions_ticketId_key" ON "ai_decisions"("ticketId");
