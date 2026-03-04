-- Dictionary and dimensions
CREATE TABLE IF NOT EXISTS query_dictionary (
  id bigserial PRIMARY KEY,
  query_hash bytea NOT NULL UNIQUE,
  query_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_dictionary (
  id bigserial PRIMARY KEY,
  page_hash bytea NOT NULL UNIQUE,
  page_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gsc_dimensions (
  id int PRIMARY KEY,
  dimension_type text NOT NULL,
  dimension_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dimension_type, dimension_value)
);
