# Operación

Cómo se corre, se despliega y se arregla esto. El `README.md` cuenta el sitio y
su contenido; este archivo cuenta la máquina.

Está escrito para alguien que llega sin haber hablado con nadie.

---

## Qué es cada cosa

| Ruta | Qué es |
|---|---|
| `index.html`, `assets/app.js`, `assets/styles.css` | El sitio del cliente. Sin compilación: lo que hay en el archivo es lo que llega al navegador |
| `panel.html`, `assets/panel.js`, `assets/panel.css` | El panel del local |
| `api/*.mjs` | Funciones del servidor |
| `api/_*.mjs` | Módulos compartidos. **El guion bajo no es estilo**: Vercel no convierte en ruta los archivos que empiezan así, y por eso no cuentan contra el tope de funciones |
| `api/_migracion-NN.sql` | Cambios de la base, en orden |
| `scripts/` | Herramientas que se corren a mano. **Nunca bajo `api/`**, por lo mismo del tope |

Una sola dependencia: `@neondatabase/serverless`. No hay framework, ni empaque,
ni paso de compilación. Es deliberado: dentro de tres años esto sigue corriendo
sin que nadie actualice nada.

### El tope de las doce funciones

El plan admite **12 funciones serverless** y cada archivo bajo `api/` cuenta
como una. Con catorce, el despliegue falla **entero** y producción se queda
sirviendo una versión vieja sin que nada lo avise — ya pasó, y costó días
entenderlo.

Hoy hay **5**: `catalogo`, `disponibilidad`, `profesionales`, `reservar` y
`panel/[accion]`. Las once rutas del panel viven dentro de esa última, que
reparte según el segmento de la URL.

> **Si añades una ruta al panel**, ponla como `api/panel/_loquesea.mjs` y
> regístrala en `api/panel/[accion].mjs`. No crees archivos nuevos bajo `api/`.

---

## Correr en local

```bash
npm install
npx vercel env pull .env.development.local
```

El servidor local **entrega archivos y no ejecuta `/api`**. Eso significa que en
`http://localhost:4321` el sitio se ve, pero **la reserva no funciona** y el
panel no habla con la base. No es un fallo: es lo que hay.

Para probar el flujo completo hay que usar el sitio publicado.

El panel tiene un **modo demostración** con datos inventados, que se activa solo
en `localhost` o añadiendo `?demo=1`:

```
https://…/panel.html?demo=1
```

En ese modo **nada sale del navegador**: no se llama a la API, no se abre sesión
y no se toca la base. Si alguien reporta que «el panel no muestra sus datos», lo
primero que hay que mirar es si tiene ese `?demo=1` puesto.

---

## Comandos

```bash
npm test        # 14 pruebas, sin base de datos ni red
npm run migrar  # aplica las migraciones que falten
npm run respaldo # copia la base a respaldos/
```

---

## Migraciones

```bash
npm run migrar
```

Aplica en orden las de `api/_migracion-NN.sql` que falten, anota cuáles ya se
hicieron en la tabla `migracion` y no repite ninguna. **Correrlo dos veces
seguidas es seguro**: la segunda no hace nada.

Para añadir un cambio de base: crear `api/_migracion-NN.sql` con el número
siguiente y correr el comando. Escribirlas de forma que se puedan repetir sin
daño (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) — cuesta lo mismo y evita el
día malo.

> **Cuidado con `''` y `NULL`.** La migración 07 rellenaba descripciones con
> `AND descripcion IS NULL` y se saltó las que tenían cadena vacía. En el panel
> las dos se ven igual —«sin descripción»— pero para Postgres son valores
> distintos, y el panel escribe `''` cuando el campo se deja en blanco. Al
> comparar campos de texto que el panel puede dejar vacíos, van los dos casos.

> **El código nuevo no puede dar por hecha una migración recién escrita.**
> Ha pasado dos veces: una consulta contra una tabla que aún no existía tumbó
> primero la vista de Facturas entera y luego el inventario. Si una consulta
> toca algo que quizá no está, va en su propio `try` y devuelve vacío.

---

## Respaldos

```bash
npm run respaldo
```

Escribe un JSON en `respaldos/`, que está ignorada por Git — un respaldo con
teléfonos de clientes no puede acabar en un repositorio público.

### Automático, en este Mac

Hay una tarea programada que lo saca todos los días a las 14:00 y lo guarda en
**iCloud Drive → «Respaldos El Imperio»**, quedándose con los 30 últimos. Se
activa una sola vez:

```bash
cp scripts/com.imperial.respaldo.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.imperial.respaldo.plist
```

A las 14:00 y no de madrugada a propósito: un portátil a las 3 a.m. está dormido
y la tarea no correría nunca.

Guarda en iCloud y no en el proyecto porque un respaldo que vive en el mismo
disco que se puede dañar no es un respaldo. Y la contraseña de la base **no sale
de esta máquina**: el script la lee de `.env.development.local`.

En `registro.txt`, dentro de esa misma carpeta, queda lo que imprimió cada
ejecución. Si un día deja de haber archivos nuevos, ahí está el motivo.

### Automático, en GitHub (alternativa, sin activar)

`.github/workflows/respaldo.yml` hace lo mismo desde los servidores de GitHub,
con la ventaja de que corre aunque el Mac esté apagado. Necesita crear el
secreto `DATABASE_URL` en Settings → Secrets and variables → Actions. Mientras
no exista, el trabajo falla a propósito y GitHub avisa por correo, que es mejor
que fingir que hay respaldos.

El JSON trae `orden_de_restauracion`: hay que insertar en ese orden o las claves
foráneas lo rechazan.

---

## Desplegar

Se despliega solo al empujar a `main`. Tarda alrededor de un minuto.

Para comprobar que llegó, mirar la versión de los archivos:

```bash
curl -s https://el-imperio-lime.vercel.app/ | grep -o 'app.js?v=[0-9]*'
```

> **Al cambiar `assets/*.js` o `assets/*.css` hay que subir el `?v=` en el HTML
> que los enlaza.** Si no, los navegadores que ya visitaron el sitio siguen
> usando la versión vieja y el cambio «no se ve» aunque esté desplegado.

---

## La base de datos

El sitio usa el proyecto de Neon llamado **Barbaroneon** (`dark-paper-95451464`).
Está escrito aquí porque hay **otro proyecto llamado `imperial-db`**
(`young-hat-88354020`) con las mismas tablas y datos parecidos, y ya provocó un
error caro: se le aplicaron tres migraciones creyendo que era la buena.

> La señal para distinguirlas es la columna `servicio.descripcion`: la de
> producción la tiene, la otra no. Y el nombre del proyecto NO sirve como
> señal: la duplicada tiene el nombre que parece el correcto.

`imperial-db` ya se borró. Neon rechazaba el borrado —«organization is managed
by Vercel»— porque la base es un recurso del Marketplace, y esos se gestionan
desde Vercel:

```bash
npx vercel integration-resource remove <nombre>
```

Quedó un respaldo suyo en `respaldos/imperial-db-antes-de-borrar/`.

### Cómo se saca la conexión

La `DATABASE_URL` está marcada como sensible en Vercel, así que **no se puede
copiar desde su panel ni bajar con `vercel env pull`** —viene censurada como
`[SENSITIVE]`—. El camino que funciona es la herramienta de Neon:

```bash
npx neonctl auth        # una vez, autoriza en el navegador
npx neonctl connection-string --project-id dark-paper-95451464 \
    --org-id org-delicate-sky-73333076
```

Ya está guardada en `.env.development.local` (ignorada por Git, permisos 600),
así que `npm run migrar` y `npm run respaldo` funcionan sin más.

---

## Secretos

Tres variables, en Vercel → Settings → Environment Variables:

| | |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. La inyecta la integración |
| `PANEL_CLAVE` | La clave del dueño |
| `PANEL_SECRETO` | Cadena larga y aleatoria para firmar la cookie. Nadie la teclea |

Las claves de cada profesional **no** son variables: viven cifradas en su fila y
se ponen desde el panel, en Disponibilidad → Profesionales.

Ninguna de las tres puede acabar en el repositorio. Es público, y Git guarda el
historial para siempre: un commit por error no se arregla borrando el archivo.

---

## Reglas que parecen detalles y no lo son

Cosas que un cambio razonable rompería sin avisar.

**El rol va dentro de la firma de la cookie.** Si se saca fuera, cualquiera se
asciende a dueño editando su cookie. Hay una prueba que falla si eso ocurre.

**Los permisos se comprueban en el servidor**, con `protegido(handler, {
soloDueno: true })`. Esconder botones no es seguridad: quien sepa la dirección
llama la ruta desde la consola.

**Que dos citas no se solapen lo impide Postgres**, con una restricción de
exclusión, no el código. Por eso no hay forma de saltárselo con un error de
programación. El error `23P01` es eso, y se traduce a un 409.

**Las horas se calculan con la zona nombrada**, nunca con un `-5` fijo. Hay
prueba.

**El dinero de un cobro se guarda copiado, no referenciado.** Si mañana sube el
precio de un servicio, la venta de ayer no puede cambiar de valor sola.

**No se reintentan las escrituras.** Repetir un POST crearía la cita o el cobro
dos veces. Las lecturas sí, porque la base se suspende y la primera consulta
tras el reposo a veces devuelve 500.

**Lo escrito en el HTML es el respaldo, no la fuente.** El sitio arranca con la
carta y el equipo escritos en `index.html` y `app.js`, y los reemplaza con lo que
diga la base cuando llega. Así se ve al instante, se indexa y sigue funcionando
si la base no responde. Al revés —página vacía esperando a la API— cualquier
tropiezo deja al visitante mirando un hueco.

---

## Cuando algo falla

| Síntoma | Causa casi siempre |
|---|---|
| «El panel no muestra mis datos» | Está en `?demo=1` |
| «La reserva no carga los barberos» en local | El servidor local no ejecuta `/api`. Usar el sitio publicado |
| Un 500 suelto que al recargar ya no sale | La base estaba suspendida y la primera consulta pagó el despertar. Las lecturas ya reintentan solas |
| «Cambié un precio y no se ve» | El sitio relee al volver a la pestaña o al abrir la reserva. Una pestaña quieta tarda hasta 20 segundos |
| Una vista entera vacía | Una consulta contra una tabla de una migración sin correr. `npm run migrar` |
| El despliegue no llega | Puede haber pasado de 12 funciones. Mirar el registro en Vercel |
| Un cambio de CSS o JS «no se ve» | Falta subir el `?v=` en el HTML |

---

## Lo que sigue pendiente

Cosas que solo puede hacer el dueño, porque exigen sus accesos o su criterio:

- **Repartir las claves del equipo** y borrar `claves-equipo.txt`. Están
  generadas y puestas; el archivo está ignorado por Git y solo lo puede leer el
  dueño. Se cambian desde Disponibilidad → Profesionales.
- **Activar la tarea de respaldo** con los dos comandos de arriba (una vez).
- Opcional: el secreto `DATABASE_URL` en GitHub, si se quiere que el respaldo
  corra también con el Mac apagado.
- **El secreto `DATABASE_URL` en GitHub**, para que el respaldo diario corra.
- **Fotos** de quien no la tenga. Sin foto se enseña su inicial, que funciona,
  pero no es lo mismo.
- **Confirmar el horario del domingo.** La base dice cerrado; el perfil que el
  local usa dice 9:00–14:00. Hoy el sitio rechaza reservas ese día.
- **Las duraciones de colorimetría, freestyle e hidrocauterización** están
  puestas erradas por largo a propósito, porque la agenda necesita un número y
  esos servicios van «según diseño». Ajustarlas en Servicios → Editar.
- **La base duplicada y vacía** en Neon, ocupando un cupo.
