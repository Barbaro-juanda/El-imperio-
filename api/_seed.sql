-- Semilla. Generada desde SERVICES en assets/app.js — no editar a mano:
-- si cambia la carta, regenerar. Correr después de _schema.sql.

INSERT INTO profesional (id, nombre, slug, foto) VALUES
  (1, 'Emanuel Gómez',   'emanuel',  'assets/barbero-ema.jpg'),
  (2, 'Jeronimo Garcia', 'jeronimo', NULL),
  (3, 'Valentina Romero','valentina',NULL)
ON CONFLICT (id) DO NOTHING;
SELECT setval('profesional_id_seq', 3);

-- Horario del local, hora de Bogotá. Domingo abierto media jornada.
INSERT INTO horario (dow, abre, cierra, abierto) VALUES
  (0,'09:00','14:00',TRUE), (1,'09:00','20:00',TRUE), (2,'09:00','20:00',TRUE),
  (3,'09:00','20:00',TRUE), (4,'09:00','20:00',TRUE), (5,'09:00','20:00',TRUE),
  (6,'09:00','20:00',TRUE)
ON CONFLICT (dow) DO UPDATE SET abre=EXCLUDED.abre, cierra=EXCLUDED.cierra, abierto=EXCLUDED.abierto;

INSERT INTO servicio (id, segmento, nombre, precio, minutos) VALUES
  ('corte-sencillo','cortes','Corte Sencillo',35000,45),
  ('corte-vip','cortes','Corte VIP',45000,60),
  ('corte-barba-senc','cortes','Corte y Barba Sencillo',48000,60),
  ('corte-barba-vip','cortes','Corte y Barba VIP',60000,90),
  ('ritual-barba','cortes','Ritual de Barba',26000,30),
  ('barba-sencilla','cortes','Barba Sencilla',15000,30),
  ('pigmentacion','cortes','Pigmentación',20000,30),
  ('dep-nariz-oidos','depilacion','Depilación de nariz y oídos',25000,15),
  ('dep-nasales','depilacion','Depilación de fosas nasales',15000,15),
  ('dep-oidos','depilacion','Depilación de oídos',15000,15),
  ('cejas-hilo','cejas','Cejas con hilo',20000,20),
  ('cejas-cuchilla','cejas','Cejas con cuchilla',10000,15),
  ('ritual-facial','facial','Ritual Facial',56000,45),
  ('masc-negros','facial','Mascarilla de puntos negros',16000,15),
  ('masc-hialuronico','facial','Mascarilla de hialurónico',20000,15),
  ('masajeador','facial','Masajeador ocular',20000,10),
  ('parches-ojeras','facial','Parches para ojeras',10000,30),
  ('manos-pies','unas','Manos y pies',NULL,120),
  ('manos-tradicional','unas','Manos Tradicionales',30000,45),
  ('pies-tradicional','unas','Pies Tradicional',35000,45),
  ('manos-semi','unas','Manos Semipermanentes',40000,60),
  ('pies-semi','unas','Pies Semipermanente',45000,60),
  ('rubber','unas','Manicura con Base Rubber',65000,60),
  ('press-on','unas','Extensión Press-on',100000,120),
  ('decoracion','unas','Decoración y diseño de uñas',NULL,30),
  ('stiker','unas','Stiker y pedrería',3000,5),
  ('velo','unas','Velo Terapia',6000,5),
  ('retiro-presson','unas','Retiro de Press-on',15000,30),
  ('retiro-semi','unas','Retiro de Semipermanente',5000,10)
ON CONFLICT (id) DO UPDATE SET precio=EXCLUDED.precio, minutos=EXCLUDED.minutos, nombre=EXCLUDED.nombre;

-- Quién presta qué. Los tres hacen base rubber, press-on y su retiro;
-- el resto de uñas es solo de Valentina. Cortes y demás: Emanuel y Jeronimo.
INSERT INTO servicio_profesional (servicio_id, profesional_id) VALUES
  ('corte-sencillo',1),
  ('corte-sencillo',2),
  ('corte-vip',1),
  ('corte-vip',2),
  ('corte-barba-senc',1),
  ('corte-barba-senc',2),
  ('corte-barba-vip',1),
  ('corte-barba-vip',2),
  ('ritual-barba',1),
  ('ritual-barba',2),
  ('barba-sencilla',1),
  ('barba-sencilla',2),
  ('pigmentacion',1),
  ('pigmentacion',2),
  ('dep-nariz-oidos',1),
  ('dep-nariz-oidos',2),
  ('dep-nasales',1),
  ('dep-nasales',2),
  ('dep-oidos',1),
  ('dep-oidos',2),
  ('cejas-hilo',1),
  ('cejas-hilo',2),
  ('cejas-cuchilla',1),
  ('cejas-cuchilla',2),
  ('ritual-facial',1),
  ('ritual-facial',2),
  ('masc-negros',1),
  ('masc-negros',2),
  ('masc-hialuronico',1),
  ('masc-hialuronico',2),
  ('masajeador',1),
  ('masajeador',2),
  ('parches-ojeras',1),
  ('parches-ojeras',2),
  ('manos-pies',3),
  ('manos-tradicional',3),
  ('pies-tradicional',3),
  ('manos-semi',3),
  ('pies-semi',3),
  ('rubber',1),
  ('rubber',2),
  ('rubber',3),
  ('press-on',1),
  ('press-on',2),
  ('press-on',3),
  ('decoracion',3),
  ('stiker',3),
  ('velo',3),
  ('retiro-presson',1),
  ('retiro-presson',2),
  ('retiro-presson',3),
  ('retiro-semi',3)
ON CONFLICT DO NOTHING;
