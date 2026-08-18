-- =========================================================
-- Migración 16 — el día libre semanal de cada profesional
-- =========================================================
-- Ya hay dos formas de cerrar la agenda: el horario del local, que dice qué días
-- abre, y los descansos con fecha, que son las excepciones —un festivo, unas
-- vacaciones—. Falta la tercera, que es la más corriente de todas: «Valentina no
-- viene los lunes». Todas las semanas, sin fecha de fin.
--
-- Marcarlo como descansos con fecha obligaría a poner cincuenta y dos lunes al
-- año, y a acordarse en diciembre de poner los del año siguiente.
--
-- Va como columna y no como tabla aparte: son como mucho siete números por
-- persona, siempre se leen junto con el resto de su ficha, y una tabla obligaría
-- a un JOIN en cada consulta de disponibilidad para traer siete enteros.

ALTER TABLE profesional
  ADD COLUMN IF NOT EXISTS dias_libres SMALLINT[] NOT NULL DEFAULT '{}';

-- Mismo convenio que usa Postgres y JavaScript para el día de la semana:
-- 0 es domingo y 6 es sábado. Se deja escrito porque un array de números sin
-- contexto es imposible de interpretar seis meses después.
COMMENT ON COLUMN profesional.dias_libres IS
  'Días de la semana que no trabaja. 0=domingo … 6=sábado, igual que EXTRACT(DOW).';
