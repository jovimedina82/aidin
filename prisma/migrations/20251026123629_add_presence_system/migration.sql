-- CreateTable
CREATE TABLE "presence_status_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'presence',
    "requiresOffice" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_status_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_office_locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_office_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_presence" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status_id" TEXT NOT NULL,
    "office_location_id" TEXT,
    "notes" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_presence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presence_status_types_code_key" ON "presence_status_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "presence_office_locations_code_key" ON "presence_office_locations"("code");

-- CreateIndex
CREATE INDEX "staff_presence_user_id_start_at_idx" ON "staff_presence"("user_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_presence_user_id_start_at_end_at_status_id_office_l_key" ON "staff_presence"("user_id", "start_at", "end_at", "status_id", "office_location_id");

-- AddForeignKey
ALTER TABLE "staff_presence" ADD CONSTRAINT "staff_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_presence" ADD CONSTRAINT "staff_presence_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "presence_status_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_presence" ADD CONSTRAINT "staff_presence_office_location_id_fkey" FOREIGN KEY ("office_location_id") REFERENCES "presence_office_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
