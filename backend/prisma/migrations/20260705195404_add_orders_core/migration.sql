-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('open', 'charged', 'cancelled');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('fixed', 'percentage');

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "location_id" INTEGER,
    "bar_position" INTEGER,
    "takeout_number" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'open',
    "owner_user_id" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_service_type_check" CHECK (
        (location_id IS NOT NULL AND takeout_number IS NULL) OR
        (location_id IS NULL AND takeout_number IS NOT NULL AND bar_position IS NULL)
    )
);

-- CreateTable
CREATE TABLE "order_rounds" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "round_number" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "round_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "custom_name" VARCHAR(255),
    "unit_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(10,2) GENERATED ALWAYS AS ("unit_price" * "quantity") STORED,
    "notes" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_discounts" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_owner_user_id_idx" ON "orders"("owner_user_id");

-- CreateIndex
CREATE INDEX "orders_opened_at_idx" ON "orders"("opened_at");

-- CreateIndex
CREATE INDEX "order_rounds_order_id_idx" ON "order_rounds"("order_id");

-- CreateIndex
CREATE INDEX "order_items_round_id_idx" ON "order_items"("round_id");

-- CreateIndex
CREATE INDEX "order_discounts_order_id_idx" ON "order_discounts"("order_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rounds" ADD CONSTRAINT "order_rounds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rounds" ADD CONSTRAINT "order_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "order_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
