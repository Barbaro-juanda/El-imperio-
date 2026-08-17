-- =========================================================
-- Migración 13 — finanzas del negocio
-- =========================================================
-- Hasta ahora el panel sabía lo que ENTRA por servicios (los cobros de las
-- citas) y por productos (las ventas del inventario), pero no sabía nada de lo
-- que SALE: el arriendo, la cera que se repone, los guantes, la cuenta de la
-- luz. Con solo la mitad de la ecuación, la caja del día dice cuánto se
-- facturó, no cuánto se ganó, y son dos cifras distintas.
--
-- Esta tabla guarda lo que no cabe en las otras dos: los egresos, y los
-- ingresos que no vienen de una cita ni de una venta.

CREATE TABLE IF NOT EXISTS finanza (
  id       SERIAL PRIMARY KEY,

  tipo     TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),

  -- Qué fue. Obligatorio: un egreso sin nombre es una cifra que dentro de tres
  -- meses no le dice nada a nadie, ni siquiera a quien la anotó.
  concepto TEXT NOT NULL,

  -- En pesos enteros, como el resto del sistema. Siempre positivo: el signo lo
  -- pone `tipo`, no el número. Guardar egresos en negativo obliga a acordarse
  -- del convenio en cada consulta, y el día que alguien se olvide, la resta
  -- suma.
  monto    INTEGER NOT NULL CHECK (monto >= 0),

  -- La fecha del gasto, que no es la de cuando se anotó: el arriendo se paga
  -- el día 1 aunque se registre el 4, y cuadrar el mes exige la primera.
  fecha    DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Para agrupar sin obligar a nadie a escribir siempre lo mismo.
  categoria TEXT,

  nota     TEXT,

  -- Quién lo anotó, si fue un profesional. Sirve para preguntar.
  profesional_id INTEGER REFERENCES profesional(id),

  creado   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Se consulta siempre por rango de fechas, que es como se cuadra un mes.
CREATE INDEX IF NOT EXISTS finanza_fecha ON finanza (fecha, tipo);
