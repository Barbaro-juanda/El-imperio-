#!/bin/bash
# Respaldo diario. Lo lanza launchd; ver scripts/com.imperial.respaldo.plist
#
# Guarda en iCloud Drive y no en el proyecto, a propósito: un respaldo que vive
# en el mismo disco que se puede dañar no es un respaldo. Al estar en iCloud
# sale de esta máquina sin que la contraseña de la base salga con él —la lee de
# .env.development.local, que se queda aquí—.

PROY="/Users/juandavidescobarguiral/Downloads/Personal/The imperial classic "
DEST="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Respaldos El Imperio"

mkdir -p "$DEST" || exit 1
cd "$PROY" || exit 1

# Ruta completa a node: launchd no hereda el PATH de la terminal, así que un
# `node` a secas no lo encuentra y la tarea falla en silencio todos los días.
NODE="$(command -v node || echo /usr/local/bin/node)"

echo "=== $(date '+%Y-%m-%d %H:%M') ===" >> "$DEST/registro.txt"
"$NODE" scripts/respaldo.mjs "$DEST" >> "$DEST/registro.txt" 2>&1
echo >> "$DEST/registro.txt"

# Se queda con los 30 últimos. Pasado un mes, una copia más vieja no dice nada
# que no diga la de ayer, y ocupan sitio en iCloud.
ls -t "$DEST"/imperial-*.json 2>/dev/null | tail -n +31 | while read -r f; do
  rm -f "$f"
done
