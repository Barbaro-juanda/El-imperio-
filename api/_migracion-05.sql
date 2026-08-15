-- =========================================================
-- Migración 05 — inventario y venta de productos
-- =========================================================
-- La barbería vende cera, shampoo, aceite de barba. Hasta ahora eso no
-- existía en ninguna parte: se cobraba de palabra y el dinero entraba a la
-- caja sin quedar registrado como venta, así que nadie sabía cuánto se vendió
-- ni cuánto queda en la vitrina.

CREATE TABLE IF NOT EXISTS producto (
  id           TEXT PRIMARY KEY,
  nombre       TEXT NOT NULL,
  marca        TEXT,
  descripcion  TEXT,
  -- Lo que paga el cliente y lo que le costó al local. El costo permite saber
  -- si vender el producto deja algo; sin él la caja dice cuánto entró pero no
  -- cuánto se ganó.
  precio       INTEGER NOT NULL CHECK (precio >= 0),
  costo        INTEGER          CHECK (costo >= 0),
  -- Nunca se escribe directo: sale de aplicar movimientos. Se guarda aquí
  -- porque recalcularlo sumando la tabla entera en cada pantalla es caro y
  -- porque el UPDATE condicional es lo que impide vender lo que no hay.
  existencias  INTEGER NOT NULL DEFAULT 0 CHECK (existencias >= 0),
  -- Debajo de esto el panel lo marca como «por pedir». Cero desactiva el aviso.
  minimo       INTEGER NOT NULL DEFAULT 0 CHECK (minimo >= 0),
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Todo lo que mueve el stock, en una sola tabla y en orden.
--   venta   → cantidad negativa, con precio y medio de pago
--   entrada → cantidad positiva, mercancía que llegó
--   ajuste  → corrección de conteo, en cualquier dirección
--
-- Se guarda el movimiento y no solo el saldo porque un inventario sin
-- historial es imposible de auditar: cuando el conteo físico no cuadra, lo
-- único que sirve es poder recorrer qué pasó y cuándo.
CREATE TABLE IF NOT EXISTS movimiento (
  id            SERIAL PRIMARY KEY,
  producto_id   TEXT NOT NULL REFERENCES producto(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('venta', 'entrada', 'ajuste')),
  cantidad      INTEGER NOT NULL CHECK (cantidad <> 0),
  -- Precio del día de la venta, copiado y no referenciado: si mañana sube el
  -- precio del producto, la venta de ayer no puede cambiar de valor sola.
  precio_unit   INTEGER,
  total         INTEGER,
  metodo_pago   TEXT CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
  -- Misma regla que en los cobros de citas: la transferencia no deja rastro en
  -- el local, así que sin foto no hay con qué cuadrar el día.
  comprobante   TEXT,
  profesional_id INTEGER REFERENCES profesional(id),
  nota          TEXT,
  creado        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La caja se arma recorriendo un rango de fechas; sin este índice cada cuadre
-- lee la tabla entera.
CREATE INDEX IF NOT EXISTS movimiento_creado ON movimiento (creado);
CREATE INDEX IF NOT EXISTS movimiento_producto ON movimiento (producto_id, creado DESC);
