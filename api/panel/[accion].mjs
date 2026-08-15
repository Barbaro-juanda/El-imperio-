/* Punto único de entrada de /api/panel/*
   ==========================================================================
   El plan Hobby de Vercel admite 12 funciones serverless por despliegue y cada
   archivo bajo /api cuenta como una. Con once rutas de panel más las tres
   públicas eran catorce, y el despliegue fallaba entero —producción se quedó
   sirviendo una versión vieja sin que nada lo avisara—.

   Una ruta dinámica las agrupa: Vercel ve UNA función y aquí dentro se reparte
   según el segmento de la URL. Las direcciones no cambian —/api/panel/agenda
   sigue siendo /api/panel/agenda—, así que el navegador no se entera.

   Los módulos llevan guion bajo delante porque Vercel no convierte en ruta los
   archivos que empiezan así; sin él volverían a contar como funciones. */
import agenda    from './_agenda.mjs';
import ajustes   from './_ajustes.mjs';
import bloqueo   from './_bloqueo.mjs';
import caja      from './_caja.mjs';
import cita      from './_cita.mjs';
import clientes  from './_clientes.mjs';
import cobrar    from './_cobrar.mjs';
import crear     from './_crear.mjs';
import entrar    from './_entrar.mjs';
import mover     from './_mover.mjs';
import servicios from './_servicios.mjs';

const RUTAS = { agenda, ajustes, bloqueo, caja, cita, clientes, cobrar, crear, entrar, mover, servicios };

export default async function handler(req, res) {
  const fn = Object.prototype.hasOwnProperty.call(RUTAS, req.query.accion) ? RUTAS[req.query.accion] : null;
  if (!fn) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).send(JSON.stringify({ error: 'Ruta no encontrada' }));
    return;
  }
  return fn(req, res);
}
