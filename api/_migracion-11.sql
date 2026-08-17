-- =========================================================
-- Migración 11 — el precio puede ser un mínimo, no solo una cifra
-- =========================================================
-- La carta del sitio decía «Desde $25.000» en Depilación de nariz y oídos,
-- pero la base solo guardaba 25000 y no tenía dónde guardar el «Desde». Desde
-- que la carta se lee de la base, ese servicio anunciaba «$25.000» a secas: el
-- sitio prometía precio cerrado donde el local había puesto precio mínimo, y
-- eso es una discusión en el mostrador.
--
-- Con esta columna, un servicio puede decir tres cosas distintas:
--   precio = 35000, desde = false  →  «$35.000»
--   precio = 25000, desde = true   →  «Desde $25.000»
--   precio = NULL                  →  «Consultar», y se cotiza por WhatsApp

ALTER TABLE servicio ADD COLUMN IF NOT EXISTS precio_desde BOOLEAN NOT NULL DEFAULT FALSE;

-- El que lo tenía escrito en el sitio recupera su «Desde».
UPDATE servicio SET precio_desde = TRUE WHERE id = 'dep-nariz-oidos';
