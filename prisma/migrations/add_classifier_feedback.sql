-- Add ClassifierFeedback model to track false positive tickets
-- This helps the AI learn what should NOT be classified as tickets

CREATE TABLE IF NOT EXISTS "classifier_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "emailFrom" TEXT,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "originalCategory" TEXT,
    "feedbackType" TEXT NOT NULL, -- 'NOT_TICKET', 'WRONG_CATEGORY', 'CORRECT'
    "correctCategory" TEXT,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "classifier_feedback_ticketId_idx" ON "classifier_feedback"("ticketId");
CREATE INDEX "classifier_feedback_feedbackType_idx" ON "classifier_feedback"("feedbackType");
CREATE INDEX "classifier_feedback_createdAt_idx" ON "classifier_feedback"("createdAt");
