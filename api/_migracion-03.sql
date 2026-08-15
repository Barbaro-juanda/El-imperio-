-- =========================================================
-- Migración 03 — dos roles: dueño y profesional
-- =========================================================

-- Cada profesional entra con su propia clave. Una compartida para «empleados»
-- no serviría: el panel del profesional solo debe enseñar SU jornada, y sin
-- saber quién entró no hay forma de filtrar.
--
-- Se guarda el hash, nunca la clave. Si alguien llega a leer esta tabla no
-- obtiene con qué entrar.
ALTER TABLE profesional ADD COLUMN IF NOT EXISTS clave_hash TEXT;

-- Horario propio. El del negocio marca cuándo abre la puerta; este, cuándo
-- está esa persona. Un barbero que entra a las 11 no debería aparecer con
-- huecos libres a las 9.
ALTER TABLE profesional ADD COLUMN IF NOT EXISTS entra TIME NOT NULL DEFAULT '09:00';
ALTER TABLE profesional ADD COLUMN IF NOT EXISTS sale  TIME NOT NULL DEFAULT '20:00';
