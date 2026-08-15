-- =========================================================
-- Migración 08 — ajustes del local que hoy viven en el código
-- =========================================================
-- La meta diaria de caja estaba escrita en assets/panel.js. Eso significa que
-- cambiarla exige editar un archivo y volver a publicar el sitio, cosa que el
-- local no puede hacer. Una cifra que se revisa cada temporada no puede
-- depender de eso.
--
-- Tabla de clave y valor en vez de una columna por ajuste: los ajustes de este
-- tipo aparecen de a uno y a destiempo, y añadir una fila es más barato que
-- una migración por cada uno. El valor va como texto y lo interpreta quien lo
-- lee: aquí solo hay un puñado y no compensa una columna por tipo.

CREATE TABLE IF NOT EXISTS ajuste (
  clave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL,
  -- Para qué sirve, en cristiano. Lo lee quien abra la tabla dentro de un año
  -- sin acordarse de nada.
  nota   TEXT
);

-- La cifra que había en el código. NO es un dato que el local haya fijado:
-- la puse yo como marcador para que la barra de progreso tuviera contra qué
-- medir. Que quede aquí es justamente para que se pueda corregir sin pedir
-- nada a nadie.
INSERT INTO ajuste (clave, valor, nota) VALUES
  ('meta_diaria', '300000', 'Meta de caja por día, en pesos. Marcador: falta que el local fije la suya.')
ON CONFLICT (clave) DO NOTHING;
