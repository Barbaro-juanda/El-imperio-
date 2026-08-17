#!/bin/bash
# Respaldo diario. Lo lanza launchd; ver scripts/com.imperial.respaldo.plist
#
# ---------------------------------------------------------------------------
# DÓNDE VIVE ESTE ARCHIVO
# La copia que corre de verdad NO es esta, sino la de
#   ~/Library/Application Support/ImperialRespaldo/
# porque macOS no deja que una tarea de fondo EJECUTE nada dentro de ~/Downloads
# —carpeta protegida—. Leer sí puede, y por eso el proyecto se queda donde está.
# Esta copia es la del repositorio, para que el archivo no se pierda; si se
# cambia, hay que volver a copiarla allí.
#
# DÓNDE ESCRIBE
# En Application Support, que la tarea sí puede escribir. Después INTENTA copiar
# a iCloud Drive, y si macOS lo impide se calla: mejor un respaldo en el disco
# que ningún respaldo por empeñarse en dejarlo en la nube.
# ---------------------------------------------------------------------------

PROY="/Users/juandavidescobarguiral/Downloads/Personal/The imperial classic "
CASA="$HOME/Library/Application Support/ImperialRespaldo/respaldos"
NUBE="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Respaldos El Imperio"

mkdir -p "$CASA" || exit 1
cd "$PROY" || exit 1

# Ruta completa a node: launchd no hereda el PATH de la terminal, y con `node`
# a secas la tarea fallaría en silencio todos los días.
NODE="$(command -v node || echo /usr/local/bin/node)"

{
  echo "=== $(date '+%Y-%m-%d %H:%M') ==="
  "$NODE" scripts/respaldo.mjs "$CASA" 2>&1
  echo
} >> "$CASA/registro.txt" 2>&1

# Se queda con las 30 últimas. Pasado un mes, una copia más vieja no dice nada
# que no diga la de ayer.
ls -t "$CASA"/imperial-*.json 2>/dev/null | tail -n +31 | while read -r f; do
  rm -f "$f"
done

# Intento de sacar la copia de esta máquina. Falla mientras la tarea no tenga
# permiso sobre iCloud; el respaldo local ya está hecho, así que no importa.
if mkdir -p "$NUBE" 2>/dev/null; then
  ULTIMO="$(ls -t "$CASA"/imperial-*.json 2>/dev/null | head -1)"
  [ -n "$ULTIMO" ] && cp "$ULTIMO" "$NUBE/" 2>/dev/null
  ls -t "$NUBE"/imperial-*.json 2>/dev/null | tail -n +31 | while read -r f; do
    rm -f "$f"
  done
fi

exit 0
