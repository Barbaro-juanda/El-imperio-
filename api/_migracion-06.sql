-- =========================================================
-- Migración 06 — Simon entra al equipo reservable
-- =========================================================
-- La portada lleva desde el principio a Emanuel y a Simon en «Las Manos», pero
-- la base solo tenía a Emanuel y a Jeronimo. El resultado era que el visitante
-- veía a Simon en la página y no le aparecía al reservar.
--
-- Se añade sin tocar a Jeronimo. Quitar a alguien del equipo es un clic en el
-- panel (Disponibilidad → Profesionales → Quitar del equipo) y además es
-- reversible; borrarlo desde aquí no lo sería, y sus citas pasadas apuntan a
-- su fila.

INSERT INTO profesional (nombre, slug, foto, activo)
VALUES ('Simon', 'simon', 'assets/barbero-simon.jpg', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Los mismos servicios que ya presta el otro barbero, copiados de su fila en
-- vez de escritos a mano. Escribir la lista aquí la dejaría congelada en el
-- catálogo del día que se escribió: cualquier servicio creado después desde el
-- panel no le llegaría a Simon y nadie sabría por qué. Leyéndola de Jeronimo,
-- Simon queda con lo que de verdad se está prestando hoy.
INSERT INTO servicio_profesional (servicio_id, profesional_id)
SELECT sp.servicio_id, nuevo.id
  FROM servicio_profesional sp
  JOIN profesional jero  ON jero.slug  = 'jeronimo' AND sp.profesional_id = jero.id
  CROSS JOIN profesional nuevo
 WHERE nuevo.slug = 'simon'
ON CONFLICT DO NOTHING;

-- Comprobación: debe devolver a Emanuel, Jeronimo y Simon.
--   SELECT p.nombre, count(sp.servicio_id) AS servicios
--     FROM profesional p
--     LEFT JOIN servicio_profesional sp ON sp.profesional_id = p.id
--    WHERE p.activo GROUP BY p.nombre ORDER BY p.nombre;
