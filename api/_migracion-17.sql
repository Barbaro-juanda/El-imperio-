-- =========================================================
-- Migración 17 — se retiran los descansos con fecha
-- =========================================================
-- La tabla `descanso` guardaba las excepciones con fecha —un festivo, unas
-- vacaciones—. Se retira del panel a petición del local, que se queda con el
-- día libre semanal de cada profesional (migración 16) y con los bloqueos por
-- horas para lo demás.
--
-- Se comprobó que estaba vacía antes de tirarla: no se pierde nada. Los índices
-- caen con ella.

DROP TABLE IF EXISTS descanso;
