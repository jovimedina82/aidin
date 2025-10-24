-- AlterTable
ALTER TABLE "attachments" ADD COLUMN "comment_id" TEXT;

-- CreateIndex
CREATE INDEX "attachments_comment_id_idx" ON "attachments"("comment_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "ticket_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
