-- =========================================================
-- Migración 14 — miniatura propia para la galería
-- =========================================================
-- Las fotos se guardan a 1400 px porque al ampliarlas ocupan media pantalla.
-- Pero la rejilla las enseña a 232 px de ancho: cada visitante descargaba una
-- foto seis veces más grande de lo que iba a ver, cuatro veces seguidas, para
-- unas miniaturas. En un celular con datos eso se paga.
--
-- Guardar las dos versiones cuesta un 15% más de espacio y ahorra alrededor del
-- 70% de lo que se descarga al entrar. La grande se pide solo cuando alguien
-- amplía, que es una minoría de las visitas.
--
-- Es NULL para las que ya existen: se sirven con la grande, como hasta ahora,
-- y van tomando su miniatura a medida que se vuelvan a subir. No hace falta
-- migrar nada a mano.

ALTER TABLE galeria ADD COLUMN IF NOT EXISTS mini TEXT;
