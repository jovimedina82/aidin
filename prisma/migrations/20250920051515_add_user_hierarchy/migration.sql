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
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "azureId" TEXT,
    CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("azureId", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "password", "phone", "updatedAt", "userType") SELECT "azureId", "createdAt", "email", "firstName", "id", "isActive", "lastLoginAt", "lastName", "password", "phone", "updatedAt", "userType" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_azureId_key" ON "users"("azureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
