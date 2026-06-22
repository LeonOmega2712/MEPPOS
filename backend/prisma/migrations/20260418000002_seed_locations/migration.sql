INSERT INTO "locations" ("name", "type", "display_order")
SELECT * FROM (VALUES
  ('Mesa 1', 'table', 1),
  ('Mesa 2', 'table', 2),
  ('Mesa 3', 'table', 3),
  ('Mesa 4', 'table', 4),
  ('Mesa 5', 'table', 5),
  ('Mesa 6', 'table', 6),
  ('Mesa 7', 'table', 7),
  ('Barra',  'bar',   8)
) AS v(name, type, display_order)
WHERE NOT EXISTS (SELECT 1 FROM "locations" LIMIT 1);
