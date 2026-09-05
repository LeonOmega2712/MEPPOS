-- AddCheckConstraint
-- order_discounts rows are permanent financial snapshots (never recalculated after charge),
-- so integrity is enforced at the DB level as defense-in-depth alongside Zod validation.
ALTER TABLE "order_discounts"
  ADD CONSTRAINT "order_discounts_value_check" CHECK ("value" > 0),
  ADD CONSTRAINT "order_discounts_percentage_range_check"
    CHECK ("type" <> 'percentage' OR "value" <= 100),
  ADD CONSTRAINT "order_discounts_amount_check" CHECK ("amount" >= 0);
