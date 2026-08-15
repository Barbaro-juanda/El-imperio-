-- =========================================================
-- Migración 07 — el segmento «Color y tratamiento» y las descripciones
-- =========================================================
-- Al conectar la página al panel salió una diferencia que llevaba tiempo
-- ahí sin que nadie la viera: el sitio anuncia 32 servicios y la base tiene
-- 29. Los tres que faltan son el segmento de color entero. Mientras la carta
-- venía escrita en el HTML daba igual; en cuanto la página lee de la base,
-- desaparecen de la web y dejan de poder reservarse.
--
-- Y ninguna descripción estaba cargada: la web las tenía escritas en su
-- archivo, pero el panel mostraba «Sin descripción» en los 29. Se rellenan
-- desde el mismo texto que hoy ve el cliente, para que el local pueda
-- editarlas desde el panel en vez de tener que pedir que se toque el código.

-- OJO CON LAS DURACIONES. Estos tres no tenían ninguna en el sitio porque van
-- «según diseño» y se hablan con el cliente. La agenda sí necesita un número:
-- de él salen los cupos que se ofrecen. Los de abajo son PROVISIONALES y los
-- puse errando por largo a propósito.
--
-- Quedarse corto es el error caro: un platinado agendado en media hora se come
-- las dos citas siguientes y hay que llamar a dos clientes a decirles que no.
-- Quedarse largo solo desaprovecha un hueco que se puede volver a abrir.
--
-- Ajústalos en el panel: Servicios → Editar → Duración.
INSERT INTO servicio (id, segmento, nombre, precio, minutos, activo) VALUES
  ('colorimetria',       'color', 'Colorimetría',               null, 120, TRUE),
  ('freestyle',          'color', 'Freestyle',                  null,  45, TRUE),
  ('hidrocauterizacion', 'color', 'Hidrocauterización capilar',  null,  90, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Los prestan los mismos que hacen cortes y barba: se copia de quién presta
-- el corte sencillo en vez de escribir ids a mano, que se rompen en cuanto
-- alguien entra o sale del equipo.
INSERT INTO servicio_profesional (servicio_id, profesional_id)
SELECT s.id, sp.profesional_id
  FROM servicio s
  CROSS JOIN servicio_profesional sp
 WHERE sp.servicio_id = 'corte-sencillo'
   AND s.id IN ('colorimetria', 'freestyle', 'hidrocauterizacion')
ON CONFLICT DO NOTHING;

-- Descripciones. Solo se escriben donde no hay ninguna: si el local ya
-- editó alguna desde el panel, su texto manda sobre este.
UPDATE servicio SET descripcion = 'Lavado de cabello y peinado.' WHERE id = 'corte-sencillo' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Bebida de cortesía, limpieza facial y vapor ozono.' WHERE id = 'corte-vip' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Corte y barba, con lavado y peinado.' WHERE id = 'corte-barba-senc' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Todo el VIP, con la barba incluida.' WHERE id = 'corte-barba-vip' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Limpieza facial, afeitado con vapor y diseño.' WHERE id = 'ritual-barba' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Diseño de barba y afeitado.' WHERE id = 'barba-sencilla' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Densifica barba o cuero cabelludo.' WHERE id = 'pigmentacion' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Platinados, rayos, plumillas y más.' WHERE id = 'colorimetria' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Dibujo tallado en el cuero cabelludo.' WHERE id = 'freestyle' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Sella la cutícula y controla el frizz.' WHERE id = 'hidrocauterizacion' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Las dos zonas en una sola sesión.' WHERE id = 'dep-nariz-oidos' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Depilación con cera.' WHERE id = 'dep-nasales' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Depilación con cera.' WHERE id = 'dep-oidos' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Depilación con hilo y diseño de cejas.' WHERE id = 'cejas-hilo' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Depilación con cuchilla y diseño de cejas.' WHERE id = 'cejas-cuchilla' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Vapor ozono, mascarillas, parches y masaje ocular.' WHERE id = 'ritual-facial' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Retira impurezas y exceso de grasa.' WHERE id = 'masc-negros' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Piel hidratada y de aspecto más joven.' WHERE id = 'masc-hialuronico' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Reduce líneas de expresión y ojeras.' WHERE id = 'masajeador' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Hidrata y mejora el contorno de ojos.' WHERE id = 'parches-ojeras' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Manicura y pedicura en una sola cita.' WHERE id = 'manos-pies' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Limado, cutícula y esmalte tradicional.' WHERE id = 'manos-tradicional' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Limado, cutícula y esmalte en los pies.' WHERE id = 'pies-tradicional' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Esmalte semipermanente, con brillo que dura semanas.' WHERE id = 'manos-semi' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Semipermanente en pies, de larga duración.' WHERE id = 'pies-semi' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Base rubber: uñas más fuertes y parejas.' WHERE id = 'rubber' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Extensiones aplicadas al momento, largo a elección.' WHERE id = 'press-on' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Diseño a mano, del detalle simple al completo.' WHERE id = 'decoracion' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Apliques y pedrería para rematar el diseño.' WHERE id = 'stiker' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Parafina tibia y masaje: nutre y suaviza.' WHERE id = 'velo' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Retiro cuidado, sin dañar la uña natural.' WHERE id = 'retiro-presson' AND descripcion IS NULL;
UPDATE servicio SET descripcion = 'Retiro del esmalte sin desgastar la uña.' WHERE id = 'retiro-semi' AND descripcion IS NULL;
