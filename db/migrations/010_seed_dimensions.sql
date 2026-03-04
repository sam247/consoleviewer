-- Seed common GSC dimensions
INSERT INTO gsc_dimensions (id, dimension_type, dimension_value)
VALUES
  (1, 'device', 'mobile'),
  (2, 'device', 'desktop'),
  (3, 'device', 'tablet')
ON CONFLICT (dimension_type, dimension_value) DO NOTHING;
