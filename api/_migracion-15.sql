-- =========================================================
-- Migración 15 — días de descanso
-- =========================================================
-- El horario semanal ya dice qué días abre el local, pero eso es una regla fija:
-- «los domingos cerramos». Lo que faltaba son las excepciones con fecha —el 25
-- de diciembre, la semana que el local se va de vacaciones, el lunes que
-- Valentina no viene—, y hasta ahora la única forma de taparlas era poner
-- bloqueos hora por hora.

CREATE TABLE IF NOT EXISTS descanso (
  id       SERIAL PRIMARY KEY,

  fecha    DATE NOT NULL,

  -- NULL significa el local entero. Con un profesional, descansa solo esa
  -- persona y los demás siguen atendiendo: son dos cosas distintas y la misma
  -- tabla las cubre sin duplicar nada.
  profesional_id INTEGER REFERENCES profesional(id) ON DELETE CASCADE,

  -- Para qué sirve al mirarlo en enero. «Festivo», «Vacaciones», «Cita médica».
  motivo   TEXT,

  creado   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un profesional no puede descansar dos veces el mismo día.
CREATE UNIQUE INDEX IF NOT EXISTS descanso_prof
  ON descanso (fecha, profesional_id) WHERE profesional_id IS NOT NULL;

-- Y el local tampoco. Va como índice parcial aparte porque en un UNIQUE normal
-- los NULL cuentan como distintos entre sí, y se podrían meter veinte filas de
-- «cerrado el 25 de diciembre» sin que nada lo impidiera.
CREATE UNIQUE INDEX IF NOT EXISTS descanso_local
  ON descanso (fecha) WHERE profesional_id IS NULL;

CREATE INDEX IF NOT EXISTS descanso_fecha ON descanso (fecha);
