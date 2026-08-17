-- =========================================================
-- Migración 10 — la galería se administra desde el panel
-- =========================================================
-- Las cuatro piezas de «Trabajo Reciente» venían escritas en el HTML. Cambiar
-- una exigía tocar código y volver a publicar, que es justo lo que el local no
-- puede hacer — y la galería es lo que más se querrá cambiar: cada corte bueno
-- es una foto nueva.

CREATE TABLE IF NOT EXISTS galeria (
  id       SERIAL PRIMARY KEY,

  -- La imagen en base64 y su tipo por separado, en vez de una data: URL entera.
  -- Guardada así se puede devolver como imagen de verdad —con su Content-Type y
  -- su caché— en lugar de incrustarla en un JSON. La diferencia importa: una
  -- data: URL se descarga entera en cada visita, y una imagen servida aparte la
  -- guarda el navegador y no se vuelve a pedir.
  mime     TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  datos    TEXT NOT NULL,

  -- Describe la foto para quien no puede verla. No es opcional por capricho:
  -- son trabajos reales y no hay texto alrededor que cuente qué muestra cada
  -- una, así que sin esto la sección no existe para un lector de pantalla.
  alt      TEXT NOT NULL,

  -- En qué orden salen. Se deja con huecos (10, 20, 30…) para poder meter una
  -- entre dos sin renumerar las demás.
  orden    INTEGER NOT NULL DEFAULT 0,

  activo   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Cambia al reemplazar la imagen. Va en la URL que pide el navegador, y es lo
  -- que hace seguro cachear la foto para siempre: si cambia el contenido,
  -- cambia la dirección, y el navegador pide la nueva sin que nadie tenga que
  -- vaciar ninguna caché.
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS galeria_orden ON galeria (activo, orden, id);
