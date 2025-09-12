-- db/worker/schema.sql

CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY,
  routeId INTEGER,
  timestamp INTEGER,
  FOREIGN KEY(routeId) REFERENCES routes(id)
);
