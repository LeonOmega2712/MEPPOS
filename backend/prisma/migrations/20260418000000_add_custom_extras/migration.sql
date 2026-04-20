-- CreateTable
CREATE TABLE "custom_extras" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "default_price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "custom_extras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_extras_name_key" ON "custom_extras"("name");

-- AddForeignKey
ALTER TABLE "custom_extras" ADD CONSTRAINT "custom_extras_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
