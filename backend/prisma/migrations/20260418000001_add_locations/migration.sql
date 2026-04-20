-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "locations_type_check" CHECK (type IN ('table', 'bar'))
);

-- CreateIndex
CREATE INDEX "locations_display_order_idx" ON "locations"("display_order");

-- CreateIndex
CREATE INDEX "locations_active_idx" ON "locations"("active");
