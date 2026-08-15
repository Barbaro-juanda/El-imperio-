-- =========================================================
-- Migración 06 — Simon entra al equipo, Jeronimo sale
-- =========================================================
-- La portada lleva desde el principio a Emanuel y a Simon en «Las Manos», pero
-- la base tenía a Emanuel y a Jeronimo. El visitante veía a Simon en la página
-- y no le aparecía al reservar.
--
-- Se hace en dos pasos y NO renombrando la fila de Jeronimo, que sería lo
-- corto. Renombrar convierte todas sus citas pasadas en citas de Simon: la
-- caja de meses anteriores pasaría a decir que las atendió alguien que no
-- estaba, y las comisiones ya liquidadas dejarían de cuadrar con lo que se
-- pagó. Son dos personas distintas y la base tiene que seguir diciéndolo.

INSERT INTO profesional (nombre, slug, foto, activo)
VALUES ('Simon', 'simon', 'assets/barbero-simon.jpg', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Los mismos servicios que ya presta el otro barbero, copiados de su fila en
-- vez de escritos a mano. Escribir la lista aquí la dejaría congelada en el
-- catálogo del día que se escribió: cualquier servicio creado después desde el
-- panel no le llegaría a Simon y nadie sabría por qué.
--
-- Se copia de Jeronimo aunque salga del equipo justo después: lo que interesa
-- es la lista de servicios de barbería, y es la suya la que la tiene completa.
INSERT INTO servicio_profesional (servicio_id, profesional_id)
SELECT sp.servicio_id, nuevo.id
  FROM servicio_profesional sp
  JOIN profesional jero  ON jero.slug  = 'jeronimo' AND sp.profesional_id = jero.id
  CROSS JOIN profesional nuevo
 WHERE nuevo.slug = 'simon'
ON CONFLICT DO NOTHING;

-- Jeronimo se desactiva, no se borra. Desactivado desaparece de la reserva y
-- del panel, que es lo que se busca, pero sus citas, sus cobros y sus
-- comisiones siguen en pie y el histórico sigue cuadrando. Borrarlo se llevaría
-- por delante todo eso.
--
-- Es reversible desde el panel: Disponibilidad → Profesionales → Reactivar.
UPDATE profesional SET activo = FALSE WHERE slug = 'jeronimo';

-- Comprobación: debe devolver a Emanuel, Simon y Valentina.
--   SELECT p.nombre, p.activo, count(sp.servicio_id) AS servicios
--     FROM profesional p
--     LEFT JOIN servicio_profesional sp ON sp.profesional_id = p.id
--    GROUP BY p.nombre, p.activo ORDER BY p.activo DESC, p.nombre;
