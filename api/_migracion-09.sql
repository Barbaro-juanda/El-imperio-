-- =========================================================
-- Migración 09 — las descripciones que se saltó la 07
-- =========================================================
-- La 07 rellenaba las descripciones con `AND descripcion IS NULL`, y eso dejó
-- fuera las que tenían cadena vacía. Parecen lo mismo al mirar el panel —las
-- dos se ven como «sin descripción»— pero para Postgres NULL y '' son valores
-- distintos, y la condición solo cogía uno de los dos.
--
-- La vacía la deja el panel: al crear o editar un servicio sin escribir nada
-- en el campo, lo que llega es '' y no NULL.
--
-- Se repite el relleno con la condición que cubre los dos casos. Lo que ya
-- tiene texto no se toca: si el local escribió una descripción propia, manda
-- sobre esta.

UPDATE servicio SET descripcion = 'Lavado de cabello y peinado.'
 WHERE id = 'corte-sencillo' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Bebida de cortesía, limpieza facial y vapor ozono.'
 WHERE id = 'corte-vip' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Corte y barba, con lavado y peinado.'
 WHERE id = 'corte-barba-senc' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Todo el VIP, con la barba incluida.'
 WHERE id = 'corte-barba-vip' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Limpieza facial, afeitado con vapor y diseño.'
 WHERE id = 'ritual-barba' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Diseño de barba y afeitado.'
 WHERE id = 'barba-sencilla' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Densifica barba o cuero cabelludo.'
 WHERE id = 'pigmentacion' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Platinados, rayos, plumillas y más.'
 WHERE id = 'colorimetria' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Dibujo tallado en el cuero cabelludo.'
 WHERE id = 'freestyle' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Sella la cutícula y controla el frizz.'
 WHERE id = 'hidrocauterizacion' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Las dos zonas en una sola sesión.'
 WHERE id = 'dep-nariz-oidos' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Depilación con cera.'
 WHERE id = 'dep-nasales' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Depilación con cera.'
 WHERE id = 'dep-oidos' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Depilación con hilo y diseño de cejas.'
 WHERE id = 'cejas-hilo' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Depilación con cuchilla y diseño de cejas.'
 WHERE id = 'cejas-cuchilla' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Vapor ozono, mascarillas, parches y masaje ocular.'
 WHERE id = 'ritual-facial' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Retira impurezas y exceso de grasa.'
 WHERE id = 'masc-negros' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Piel hidratada y de aspecto más joven.'
 WHERE id = 'masc-hialuronico' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Reduce líneas de expresión y ojeras.'
 WHERE id = 'masajeador' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Hidrata y mejora el contorno de ojos.'
 WHERE id = 'parches-ojeras' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Manicura y pedicura en una sola cita.'
 WHERE id = 'manos-pies' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Limado, cutícula y esmalte tradicional.'
 WHERE id = 'manos-tradicional' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Limado, cutícula y esmalte en los pies.'
 WHERE id = 'pies-tradicional' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Esmalte semipermanente, con brillo que dura semanas.'
 WHERE id = 'manos-semi' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Semipermanente en pies, de larga duración.'
 WHERE id = 'pies-semi' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Base rubber: uñas más fuertes y parejas.'
 WHERE id = 'rubber' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Extensiones aplicadas al momento, largo a elección.'
 WHERE id = 'press-on' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Diseño a mano, del detalle simple al completo.'
 WHERE id = 'decoracion' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Apliques y pedrería para rematar el diseño.'
 WHERE id = 'stiker' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Parafina tibia y masaje: nutre y suaviza.'
 WHERE id = 'velo' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Retiro cuidado, sin dañar la uña natural.'
 WHERE id = 'retiro-presson' AND (descripcion IS NULL OR descripcion = '');
UPDATE servicio SET descripcion = 'Retiro del esmalte sin desgastar la uña.'
 WHERE id = 'retiro-semi' AND (descripcion IS NULL OR descripcion = '');
