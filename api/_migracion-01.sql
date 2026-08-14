-- =========================================================
-- Migración 01 — citas creadas desde el panel
-- Correr una vez sobre la base. Es idempotente.
-- =========================================================

-- El local agenda a quien llama por teléfono o entra caminando, y muchas veces
-- solo tiene el nombre. Hasta ahora el teléfono era obligatorio porque toda
-- cita nacía del formulario de la web, donde sí se pide.
--
-- Sigue siendo UNIQUE: en Postgres una restricción de unicidad admite varios
-- NULL, así que dos clientes sin teléfono conviven y dos con el mismo número
-- se siguen fusionando en uno solo.
ALTER TABLE cliente ALTER COLUMN telefono DROP NOT NULL;

-- De dónde salió la cita. Sirve para saber cuánto está aportando la web frente
-- al mostrador, que es justo lo que hay que medir para saber si esto valió.
ALTER TABLE cita ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'web'
  CHECK (origen IN ('web', 'local'));

-- Las citas del mostrador pueden llevar una duración distinta a la del
-- catálogo: «dura 2 horas, pero yo también puedo cambiar la duración».
-- No hace falta columna: `fin` ya la guarda. Se deja constancia aquí para que
-- nadie asuma que fin - inicio siempre coincide con la suma de los servicios.
