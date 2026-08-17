-- =========================================================
-- Migración 12 — la galería admite video
-- =========================================================
-- «Trabajo Reciente» ya enseñaba un video, pero era un archivo del repositorio:
-- para cambiarlo había que tocar código. Ahora se sube desde el panel como una
-- foto más.
--
-- El CHECK de la columna `mime` solo admitía imágenes, así que un video se
-- rechazaba en la base aunque el resto del camino lo dejara pasar.

ALTER TABLE galeria DROP CONSTRAINT IF EXISTS galeria_mime_check;

ALTER TABLE galeria ADD CONSTRAINT galeria_mime_check
  CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp',
                  'video/mp4', 'video/webm', 'video/quicktime'));
