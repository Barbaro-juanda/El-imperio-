-- =========================================================
-- Migración 02 — cobros y catálogo editable
-- Correr después de la 01. Es idempotente.
-- =========================================================

-- Qué se cobró de verdad y cómo.
--
-- NO es facturación electrónica. Una factura ante la DIAN tiene requisitos
-- legales —numeración autorizada, firma, envío— que esto no cumple ni pretende
-- cumplir. Es el registro interno de caja: sirve para cuadrar el día y liquidar
-- comisiones, no para entregarle un documento fiscal al cliente.
ALTER TABLE cita ADD COLUMN IF NOT EXISTS cobrado INTEGER;
ALTER TABLE cita ADD COLUMN IF NOT EXISTS metodo_pago TEXT
  CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'otro'));
ALTER TABLE cita ADD COLUMN IF NOT EXISTS cobrado_en TIMESTAMPTZ;

-- El total de la cita es lo que valía al reservar; `cobrado` es lo que entró.
-- Se separan a propósito: un descuento, una propina o un servicio que se alargó
-- hacen que difieran, y machacar el original perdería la referencia.

CREATE INDEX IF NOT EXISTS cita_cobrado_idx ON cita (cobrado_en)
  WHERE cobrado_en IS NOT NULL;

-- Comisión por profesional, para liquidar. Porcentaje sobre lo cobrado.
ALTER TABLE profesional ADD COLUMN IF NOT EXISTS comision NUMERIC(4,3) NOT NULL DEFAULT 0.500
  CHECK (comision >= 0 AND comision <= 1);
