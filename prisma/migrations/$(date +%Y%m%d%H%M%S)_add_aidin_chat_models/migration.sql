-- CreateTable
CREATE TABLE "aidin_chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aidin_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aidin_chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aidin_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aidin_chat_sessions_user_id_created_at_idx" ON "aidin_chat_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "aidin_chat_sessions_expires_at_idx" ON "aidin_chat_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "aidin_chat_messages_session_id_created_at_idx" ON "aidin_chat_messages"("session_id", "created_at" ASC);

-- AddForeignKey
ALTER TABLE "aidin_chat_messages" ADD CONSTRAINT "aidin_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "aidin_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
