/*
  Warnings:

  - You are about to drop the column `departmentId` on the `users` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "user_departments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "user_departments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "userType" TEXT NOT NULL DEFAULT 'Client',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "azureId" TEXT
);
INSERT INTO "new_users" ("azureId", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "password", "phone", "updatedAt") SELECT "azureId", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "password", "phone", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_azureId_key" ON "users"("azureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_departments_userId_departmentId_key" ON "user_departments"("userId", "departmentId");
