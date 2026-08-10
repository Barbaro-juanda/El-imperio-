# The Imperial Clasic Barber

Sitio de una sola página con flujo de reserva de 5 pasos, implementado a partir del
diseño de Claude Design `Imperial Clasic Barber.dc.html`.

HTML, CSS y JavaScript planos — sin build, sin dependencias.

```
index.html            página completa + overlay de reserva
assets/styles.css     tokens de diseño y layout responsive
assets/app.js         datos, calendario, validación y estado de la reserva
.design-src/          copia del diseño original importado (referencia)
.claude/              config del servidor local de previsualización
```

## Ver el sitio

Abrir `index.html` directamente funciona, pero conviene servirlo por HTTP:

```bash
node ".claude/serve.js"
```

Luego abrir http://localhost:4321.

## Correspondencia con el diseño

El diseño entrega tres artboards (escritorio 1440, flujo de reserva 900, móvil 390).
Aquí se resuelven como un único documento responsive:

| Diseño | Implementación |
|---|---|
| Escritorio 1440 — página completa | `index.html`, breakpoints en 720 / 860 / 900 px |
| Flujo de reserva, 5 pasos | Overlay `#booking`, un `<section data-step>` por paso |
| Móvil 390 — inicio y reserva | El mismo marcado; layout base móvil, mejorado hacia arriba |

Tokens (`assets/styles.css`, bloque `:root`): tinta `#0D0D0D`, crema `#EDE6D6`,
papel `#F4F1EA`, vino `#9B3040`, oro `#B9973F`. Tipografías Cormorant Garamond
y Jost desde Google Fonts.

## Qué es real y qué falta conectar

Funciona hoy:

- Selección de servicio y barbero, con estado compartido entre la página y el flujo.
- Calendario del mes en curso: domingos cerrados, días pasados deshabilitados,
  navegación de meses sin poder retroceder antes del mes actual.
- Franjas horarias por día y barbero, con sábado hasta las 17:00 y bloqueo de
  las horas que ya pasaron hoy.
- Validación del formulario (nombre, teléfono; correo opcional pero con formato).
- Descarga del `.ics` de la cita en el paso 5, con la duración real del servicio
  y zona horaria de Bogotá (UTC−5).
- Video de fondo en el hero (`assets/hero.mp4`), silenciado y en bucle, con
  póster de respaldo, pausa automática al salir de pantalla y respeto a
  `prefers-reduced-motion`.

### Recursos

`Recursos/` guarda los originales tal como los entregaste; nada de ahí se modifica.
`assets/` tiene las versiones optimizadas que sirve el sitio:

| Original | Servido | Peso |
|---|---|---|
| `Fotos/Ema.png` (2.0 MB) | `assets/barbero-ema.jpg` | 103 KB |
| `Fotos/Simon.png` (2.2 MB) | `assets/barbero-simon.jpg` | 114 KB |
| `Fotos/Trabajo reciente` (1.3 MB) | `assets/trabajo-1.jpg` | 89 KB |
| `Fotos/Trabajo reciente 2.png` (1.2 MB) | `assets/trabajo-2.jpg` | 93 KB |
| `Fotos/Trabajo reciente 3.png` (767 KB) | `assets/trabajo-3.jpg` | 60 KB |
| `Videos/Trabajo reciente 4.mp4` | `assets/trabajo-4.mp4` + póster | 573 KB |
| `Videos/Video para el ritual.mp4` | `assets/ritual.mp4` + póster | 3.5 MB |
| `Fotos/Captura de pantalla…png` (logo) | `assets/logo.png` | 43 KB |

**Logo.** Llegó como captura de pantalla con márgenes negros. Se recortó al
círculo y se le generó transparencia a partir de la luminancia, así que es
**blanco sobre transparente**: funciona sobre el nav y el footer, que son
oscuros. Sobre fondo claro haría falta invertirlo (`filter: invert(1)`) o
exportar una versión negra. De ahí salen también `favicon-32.png`,
`favicon-180.png` (compuestos sobre el negro de marca, porque un logo blanco
sobre transparente desaparece en una pestaña clara) y `og-image.jpg`, la tarjeta
1200×630 para redes.

Sustituyó al escudo "T" en vino que traía el diseño. El único escudo que queda
es la flor de lis del paso 5 del flujo de reserva, que es un remate decorativo,
no la marca.

Las fotos venían en PNG (formato sin pérdida, pensado para gráficos, no para
fotografía) y sumaban 7.5 MB. Convertidas a JPEG al 82% y redimensionadas al
tamaño en que realmente se muestran: **458 KB en total, 94% menos**, sin
diferencia visible. Al reemplazar una foto conviene repetir ese paso en vez de
subir el PNG directo.

Para regenerar todo desde los originales:

```bash
python3 - <<'EOF'
import cv2
jobs=[('Recursos/Fotos/Ema.png','assets/barbero-ema.jpg',900),
      ('Recursos/Fotos/Simon.png','assets/barbero-simon.jpg',900),
      ('Recursos/Fotos/Trabajo reciente','assets/trabajo-1.jpg',800),
      ('Recursos/Fotos/Trabajo reciente 2.png','assets/trabajo-2.jpg',800),
      ('Recursos/Fotos/Trabajo reciente 3.png','assets/trabajo-3.jpg',800)]
for src,dst,w in jobs:
    im=cv2.imread(src,cv2.IMREAD_COLOR)
    im=cv2.resize(im,(w,int(im.shape[0]*w/im.shape[1])),interpolation=cv2.INTER_AREA)
    cv2.imwrite(dst,im,[cv2.IMWRITE_JPEG_QUALITY,82,cv2.IMWRITE_JPEG_OPTIMIZE,1])
EOF
```

### Sobre el video del hero

El material original está en `Recursos/Videos/` y no se modificó. `assets/hero.mp4`
es una copia con nombre apto para web (el original tiene espacios, comas y tildes,
que algunos servidores y CDNs manejan mal).

Tres cosas a tener en cuenta:

- **Es vertical (720×1280).** En escritorio apaisado solo cabe ~30% del cuadro;
  en móvil se ve completo. `object-position: center` deja visible la franja donde
  ocurre la acción. Si el recorte molesta, la alternativa es un hero partido
  (texto a un lado, video en marco vertical al otro) — cambia el diseño original.
- **Los últimos 3.9s son una placa de logo** (verde y rosado, distinta del escudo
  vino del sitio). El bucle se corta en 14.2s vía `data-loop-end`, con ~600ms de
  margen porque `timeupdate` solo dispara ~4 veces por segundo. Verificado: el
  logo nunca aparece.
- **Pesa 3.4 MB.** Aceptable pero alto para un hero. Comprimirlo a ~1.5 MB
  (H.264 CRF 28, sin pista de audio, que no se usa) mejoraría la carga en datos
  móviles. Requiere ffmpeg, que no está instalado en este equipo.

Pendiente de conectar:

- **Disponibilidad real.** `bookedSlots()` en `assets/app.js` genera ocupación
  simulada pero estable por fecha y barbero. Reemplazarla por la consulta al backend.
- **Envío de la reserva.** `submitBooking()` solo hace `console.info` con el payload
  ya armado; ahí va el `fetch` al backend o a la API de WhatsApp Business.
- **Especialidad de cada barbero.** `BARBERS` en `assets/app.js` tiene `spec: ''`
  para Ema y Simon. Los nombres anteriores (Mateo/Samuel/Tomás) y sus
  especialidades eran relleno del diseño; no inventé las reales. Al llenar ese
  campo, la línea aparece sola bajo el nombre, en la página y en el paso 2 del
  flujo de reserva.
- **Reseñas textuales.** Ver la sección siguiente.
- **Correo de contacto.** Se quitó `hola@imperialclasic.co` (era de relleno). Hoy
  el contacto es teléfono y WhatsApp; si existe un correo real, va en la sección
  Ubicación y en el JSON-LD.
- **Horario semanal.** Lun–Vie 9–20 y Sáb 9–18 vienen del diseño. Google solo
  confirmó que el domingo cierra y que abre 9 a. m. el lunes; el resto está sin
  verificar.
- **Pedicure.** La publicación del dueño en Google lo menciona, pero no está en
  la carta que se entregó ni conozco su precio.
- **Duraciones.** Por decisión explícita no se muestran en ninguna parte. El
  calendario reparte espacios fijos, así que una cita de Corte VIP más varios
  adicionales puede quedar corta de tiempo en la agenda real.

### Carta de servicios

19 servicios en cuatro bloques. `assets/app.js` es la **fuente única**: el
arreglo `SERVICES` alimenta el flujo de reserva, y el bloque estático de
`index.html` y el `hasOfferCatalog` del JSON-LD se generaron desde ahí. Si
cambia la carta, editar `SERVICES` y regenerar los otros dos.

| Bloque | Cuántos | Cómo se ve en la portada |
|---|---|---|
| Cortes | 4 | Tarjetas en cuadrícula Sencillo vs VIP, con descripción |
| Rituales | 3 | Tarjetas compactas en fila, sin descripción |
| Súmale a tu cita | 12 | Fichas de nombre + precio, agrupadas en Barba y cejas / Piel / Mirada / Color |

La sección medía 2.465px (2,9 pantallas, 37% de la página). El grueso eran los
9 "detalles" a 86px cada uno, en una sola columna y todos con descripción, para
explicar cosas como "Depilación con cera". Pasó a **1.264px en escritorio (−49%)**
convirtiendo esos 12 complementos en fichas de una línea.

**Cada pieza es un botón que abre la reserva ya cargada:** un corte o ritual
salta al paso de adicionales; una ficha entra como extra (y si aún no hay
servicio, `openBooking()` baja al paso 1 conservando el extra). Así la sección
deja de ser una lista de precios y se vuelve el punto de entrada al flujo.

Las piezas aparecen en cascada al entrar en pantalla —el retardo se cuenta
dentro de cada grupo, no global, para que cada bloque arranque su propia
animación— y quedan quietas una vez visibles, porque encima hay precios que leer.
Se desactiva con `prefers-reduced-motion` y solo ocurre una vez.

**El video de la sección** (`assets/ritual.mp4`) va en la columna que quedaba
vacía a la derecha del texto, estirado al alto que marca el propio texto: en
escritorio suma solo 45px. En móvil pasa a formato banner 5:4 debajo del CTA —
a 9:16 completo casi duplicaba el alto de la sección, que es justo lo que se
pidió recortar. Como el del hero, termina en una placa de logo (desde 18.2s),
así que el bucle se corta en 17.6s con ~450ms de margen.

`object-position: center 75%`: con el valor inicial (35%) el encuadre caía sobre
el barbero. Medido sobre el recorte real de móvil, a 75% el cliente es el sujeto
durante casi todo el bucle y las manos del barbero siguen entrando.

**Tipografía del texto.** Los párrafos usan Jost, no Cormorant. La serif es de
display y en peso 300 sus trazos son demasiado finos para leer párrafos; el
contraste ya estaba en 10:1, así que el problema era el tipo, no el color. La
serif se queda para títulos y cifras. Nada dice "carta" en el texto visible: es
lenguaje de restaurante.

### Peso: el pendiente serio

Los assets suman **8.2 MB**, y 7.4 MB de eso son los tres videos:

| Archivo | Peso |
|---|---|
| `ritual.mp4` | 3.5 MB |
| `hero.mp4` | 3.3 MB |
| `trabajo-4.mp4` | 573 KB |

Los de galería y ritual usan `preload="none"` y solo se descargan al llegar a su
sección, así que no golpean la carga inicial —pero un visitante que recorra la
página entera se los baja todos. Comprimirlos con ffmpeg (H.264 CRF 28, sin
pista de audio, que no se usa porque van silenciados) los dejaría en torno a
1.5 MB cada uno. ffmpeg no está instalado en este equipo.

**Los rituales sí son agendables como servicio principal**, aunque se pidieron
como "adicionales": el Ritual Facial cuesta $56.000 —el segundo más caro de la
carta— y alguien puede venir solo por él. Están en el paso 1 junto a los cortes.

**Precio variable.** Colorimetría, Freestyle e Hidrocauterización llevan
`price: null`. No suman al total: el recibo muestra `$X + según diseño` y una
nota diciendo cuáles se cotizan en el local. Nunca se inventa una cifra.

### Manicura: doble rol y sin barbero

Es el único servicio que aparece **en las dos listas**: como principal en el
paso 1 y como adicional en el paso 2. Al elegirlo como principal se retira solo
de los adicionales, para no cobrarlo ni mostrarlo dos veces.

Y **la atiende una sola especialista**, así que cuando es el servicio principal
el paso de barbero desaparece: no hay nada que elegir. El flujo pasa de 6 a 5
pasos y la numeración se recalcula (`pasosActivos()`), de modo que dice
"Paso 3 de 5" en vez de saltar del 2 al 4; la barra de progreso también se
redibuja con cinco segmentos.

Consecuencias que hubo que cubrir:

- Cinco puntos del código leían `BARBERS[state.barber]` y reventaban con `null`
  (recibo, envío, `.ics`, analítica y resumen del encabezado). Todos protegidos.
- El recibo no inventa un nombre: dice **"Atiende: Nuestra especialista en
  manicura"**. Cuando llegue su nombre, va en `BARBERS` o en ese texto.
- La disponibilidad usa una agenda propia (`agendaDe()`), no la de Ema: es otra
  persona y por tanto otra ocupación.
- Cambiar de manicura a un corte —o al revés— recalcula los pasos y limpia el
  barbero, para que no quede uno pegado de una selección anterior.

**Falta el nombre de la especialista.** Hoy el recibo la nombra de forma
genérica; con el nombre real se puede mostrar igual que a Ema y Simon.

### Flujo de reserva: 6 pasos

`1 servicio → 2 adicionales → 3 barbero → 4 fecha y hora → 5 datos → 6 confirmación`

El paso 2 es opcional y de selección múltiple; si no se elige nada el botón dice
"Continuar sin adicionales" para que nadie sienta que le falta llenar algo. El
total se recalcula en vivo.

Al cambiar de 5 a 6 pasos hubo que mover, además del JS: la barra de progreso
(ahora se reparte por número de hijos, no con un `repeat(5, 1fr)` fijo, que tiraba
el sexto segmento a una segunda línea) y los selectores CSS de la pantalla de
confirmación, que apuntaban a `[data-step="5"]` y dejaban el paso 6 con fondo
oscuro y las etiquetas del recibo invisibles.

El `.ics` necesita hora de fin obligatoriamente, así que reserva un bloque de
`ICS_BLOQUE_MIN` (60 min) que **no se muestra en ninguna parte del sitio**; solo
evita generar un evento inválido en el calendario del cliente.

Los precios, servicios y barberos están en las constantes al inicio de
`assets/app.js` — editar ahí actualiza tanto la página como el flujo de reserva.

### Datos del perfil de Google

Tomados del perfil real (`cid=7884828445267517729`) y ya aplicados en la página,
el pie y el JSON-LD:

| Dato | Valor |
|---|---|
| Dirección | Cra. 46D #77 Sur-73, Prados de Sabaneta, Antioquia |
| Teléfono / WhatsApp | +57 314 583 2948 · `wa.me/573145832948` |
| Coordenadas | 6.1490772, −75.6226891 |
| Plus Code | 49XG+JW Sabaneta |
| Calificación | 5,0 |

El mapa es un `iframe` de Google sin API key, en carga diferida. Nota de
privacidad: ese iframe fija cookies de Google en cuanto se carga. Colombia no
exige banner de consentimiento como la UE, pero conviene mencionarlo en el aviso
de privacidad pendiente.

### Reseñas

Los tres testimonios del diseño (Julián O., Andrés R., Camilo T.) eran
**inventados** y se eliminaron: publicar testimonios falsos en el sitio de un
negocio real es publicidad engañosa y la SIC la sanciona.

Los reemplazan **tres reseñas reales** transcritas literalmente del perfil de
Google, más el dato verificado de **5,0 sobre 454 reseñas**. Se extrajeron desde
una sesión de Google con permiso del dueño; sin sesión iniciada Google sirve una
"vista limitada" sin pestaña de opiniones.

**Solo son tres de 454.** Google no permite paginar la lista por automatización
(la pestaña de reseñas no responde a clics programáticos y el scroll no dispara
la carga diferida). Para añadir más basta con copiar un `<li class="rev">` en
`index.html` con el texto y el autor; la cinta se ajusta sola.

La cita de Yampy termina en `…` porque Google la entrega truncada y no expande
el resto ni con el botón "Ver más". Es un recorte de Google, no una edición.

**Cómo funciona la cinta.** Las tarjetas van en HTML estático (indexables y
visibles sin JavaScript); `setupReviewsMarquee()` en `assets/app.js` clona la
pista una vez y desplaza el conjunto un −50%, de modo que el salto del bucle cae
exactamente sobre la copia y es invisible. La copia lleva `aria-hidden` para que
un lector de pantalla no lea las mismas reseñas dos veces. La velocidad se
calcula en píxeles por segundo (`PX_PER_SECOND`), así que el ritmo no cambia al
agregar reseñas. Se detiene al pasar el mouse, al enfocar con el teclado
(requisito 2.2.2 de WCAG), cuando la sección sale de pantalla y cuando el
visitante tiene activado "reducir movimiento" — en ese último caso se convierte
en una lista que se desplaza a mano.

Detalle de implementación: la pausa por scroll usa la clase `.is-offscreen`, no
`style.animationPlayState`. Un estilo inline gana sobre las reglas CSS y anulaba
la pausa de `:hover`.

**Para que se actualicen solas** hace falta la Places API de Google: `place_id` +
API key con facturación activa. Devuelve hasta 5 reseñas elegidas por Google y,
como el sitio es estático, necesitaría una función serverless que la llame y
guarde caché — llamarla desde el navegador expondría la API key.

**`aggregateRating` está incluido por decisión explícita del dueño** (5,0 con
454 reseñas). Conviene saber el riesgo: esa nota viene del perfil de Google, no
de reseñas recogidas en este sitio, y las políticas de datos estructurados de
Google piden que la calificación marcada sea propia. Replicar la de Google se
considera "self-serving markup" y puede costar una acción manual por marcado
engañoso, que retira los resultados enriquecidos. Para quitarlo basta con borrar
el bloque `aggregateRating` del `<head>`; queda señalado con un comentario ahí
mismo.

### Hallazgos del perfil de Google

Dos cosas que aparecieron al leer el perfil y conviene decidir:

- **Ya existe un sistema de reservas: `beunik.co/entity-view/1414`**, enlazado
  desde Google como sitio web. El flujo de reserva de esta página es
  independiente y `submitBooking()` todavía no envía a ningún lado. Hay que
  decidir si esta página reemplaza a Beunik, si le enlaza, o si el formulario
  debe integrarse contra su API.
- **Las tres reseñas más recientes hablan de manicura y uñas, y dos son de
  mujeres.** El sitio está redactado como "cuidado masculino"; la clientela real
  parece más amplia. Vale la pena revisar el texto de la portada.
