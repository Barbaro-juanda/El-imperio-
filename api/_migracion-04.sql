-- =========================================================
-- Migración 04 — comprobante de transferencia y adicionales
-- =========================================================

-- Foto del comprobante, obligatoria cuando el cobro es por transferencia.
-- Se guarda como data: URL ya comprimida en el navegador, no como archivo en
-- un almacén aparte. Dos razones: no hay que contratar ni configurar un
-- servicio de blobs para tres fotos al día, y así el comprobante viaja y se
-- borra junto con la cita, sin quedar huérfano en ningún bucket.
ALTER TABLE cita ADD COLUMN IF NOT EXISTS comprobante TEXT;

-- Servicios que en la página del cliente aparecen como adicional y no como
-- motivo principal de la cita: son remates cortos que se suman a otra cosa.
ALTER TABLE servicio ADD COLUMN IF NOT EXISTS solo_adicional BOOLEAN NOT NULL DEFAULT FALSE;
