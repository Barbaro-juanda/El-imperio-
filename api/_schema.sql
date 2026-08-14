-- =========================================================
-- The Imperial Clasic Barber — esquema de reservas
-- Postgres. Correr una sola vez contra la base de Vercel.
-- =========================================================

-- Profesionales. Los ids son nuestros, no los del sistema anterior.
CREATE TABLE IF NOT EXISTS profesional (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  foto        TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Catálogo. `minutos` es lo que ocupa en agenda; `precio` NULL = a convenir.
CREATE TABLE IF NOT EXISTS servicio (
  id          TEXT PRIMARY KEY,           -- mismo id que en assets/app.js
  segmento    TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  precio      INTEGER,
  minutos     INTEGER NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Quién presta qué. Sin fila aquí, ese profesional no aparece para ese servicio.
CREATE TABLE IF NOT EXISTS servicio_profesional (
  servicio_id    TEXT REFERENCES servicio(id)    ON DELETE CASCADE,
  profesional_id INTEGER REFERENCES profesional(id) ON DELETE CASCADE,
  PRIMARY KEY (servicio_id, profesional_id)
);

-- Horario habitual del local. dow: 0=domingo .. 6=sábado. Hora local de Bogotá.
CREATE TABLE IF NOT EXISTS horario (
  id          SERIAL PRIMARY KEY,
  dow         SMALLINT NOT NULL CHECK (dow BETWEEN 0 AND 6),
  abre        TIME NOT NULL,
  cierra      TIME NOT NULL,
  abierto     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (dow)
);

-- Bloqueos puntuales: vacaciones, festivos, una tarde que alguien no viene.
-- profesional_id NULL = cierra el local entero.
CREATE TABLE IF NOT EXISTS bloqueo (
  id             SERIAL PRIMARY KEY,
  profesional_id INTEGER REFERENCES profesional(id) ON DELETE CASCADE,
  inicio         TIMESTAMPTZ NOT NULL,
  fin            TIMESTAMPTZ NOT NULL,
  motivo         TEXT
);

CREATE TABLE IF NOT EXISTS cliente (
  id       SERIAL PRIMARY KEY,
  nombre   TEXT NOT NULL,
  telefono TEXT NOT NULL UNIQUE,          -- E.164, +57...
  email    TEXT,
  creado   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cita (
  id             SERIAL PRIMARY KEY,
  codigo         TEXT NOT NULL UNIQUE,     -- el que ve el cliente
  cliente_id     INTEGER NOT NULL REFERENCES cliente(id),
  profesional_id INTEGER NOT NULL REFERENCES profesional(id),
  inicio         TIMESTAMPTZ NOT NULL,
  fin            TIMESTAMPTZ NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'confirmada'
                 CHECK (estado IN ('confirmada','cancelada','cumplida','no_asistio')),
  total          INTEGER NOT NULL DEFAULT 0,
  nota           TEXT,
  creado         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

-- Una cita puede llevar varios servicios (el paso 1 es selección múltiple).
CREATE TABLE IF NOT EXISTS cita_servicio (
  cita_id     INTEGER REFERENCES cita(id) ON DELETE CASCADE,
  servicio_id TEXT    REFERENCES servicio(id),
  precio      INTEGER,                     -- congelado al reservar
  PRIMARY KEY (cita_id, servicio_id)
);

-- ---------------------------------------------------------
-- La garantía que hace que esto no se rompa
-- ---------------------------------------------------------
-- Sin esto, dos personas que reservan el mismo cupo a la vez pasan las dos:
-- comprobar en la aplicación y luego insertar deja una ventana entre ambas.
-- Esta restricción la cierra en la base, que es el único sitio donde no hay
-- carrera posible. Requiere la extensión btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE cita DROP CONSTRAINT IF EXISTS cita_sin_solape;
ALTER TABLE cita ADD CONSTRAINT cita_sin_solape
  EXCLUDE USING gist (
    profesional_id WITH =,
    tstzrange(inicio, fin) WITH &&
  ) WHERE (estado = 'confirmada');

CREATE INDEX IF NOT EXISTS cita_inicio_idx ON cita (inicio);
CREATE INDEX IF NOT EXISTS cita_prof_idx   ON cita (profesional_id, inicio);
