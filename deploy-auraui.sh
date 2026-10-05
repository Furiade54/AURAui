#!/usr/bin/env bash
# =============================================================================
# deploy-auraui.sh
# Script de despliegue TODO-EN-UNO para AuraUI VPS Monitor
#   - Compatible con: Ubuntu 22.04+, Debian 12+, cualquier distro con bash + apt
#   - Qué hace: (opcional) instala Docker Engine + plugin compose ->
#               clona o actualiza el repo desde GitHub -> docker compose build + up
#               -> healthcheck /api/health -> te imprime la URL final
#
# USO DENTRO DE TU VPS (una sola línea):
#   curl -fsSL https://raw.githubusercontent.com/Furiade54/AURAui/main/deploy-auraui.sh | sudo bash
#
# O si ya copiaste el script a la VPS:
#   chmod +x ./deploy-auraui.sh
#   sudo ./deploy-auraui.sh
#
# VARIABLES DE ENTORNO QUE PUEDES SOBREESCRIBIR (antes de ejecutar):
#   export AURAI_INSTALL_DIR="/opt/AURAui"
#   export AURAI_REPO="https://github.com/Furiade54/AURAui.git"
#   export AURAI_BRANCH="main"
#   export AURAI_INSTALL_DOCKER=0   # 1 = instalar docker si falta (VPS NUEVA).  0 = NO tocar Docker (DEFAULT)
#   export AURAI_FORCE_REBUILD=1    # 1 = --no-cache siempre
#   export AURAI_BIND_ADDRESS="127.0.0.1"   # "127.0.0.1" = solo loopback / NPM  (DEFAULT, segura)
#                                           # "0.0.0.0"   = público por IP:50505
#   export AURAI_USE_NPM_NETWORK=0          # 1 = integrar AuraUI en la red docker de NPM (docker-compose network,
#                                           #     NO docker network connect manual; sobrevive a recreaciones del contenedor).
#   export AURAI_NPM_NETWORK="npm_default"  # nombre de la red docker de nginx-proxy-manager
# =============================================================================
set -eo pipefail

# --------------------------
# Colores / helpers
# --------------------------
if [ -t 1 ]; then
  C_RED=$'\033[0;31m'; C_GREEN=$'\033[0;32m'; C_AMBER=$'\033[0;33m'; C_BLUE=$'\033[0;34m'; C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_AMBER=""; C_BLUE=""; C_RESET=""
fi
log()    { echo -e "${C_BLUE}[AuraUI]${C_RESET} $*"; }
ok()     { echo -e "${C_GREEN}[OK]${C_RESET}     $*"; }
warn()   { echo -e "${C_AMBER}[WARN]${C_RESET}   $*"; }
fail()   { echo -e "${C_RED}[FAIL]${C_RESET}   $*"; exit 1; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "Ejecuta este script con sudo (necesitamos instalar paquetes y tocar /opt)."
  fi
}

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

# --------------------------
# Valores por defecto
# --------------------------
AURAI_INSTALL_DIR="${AURAI_INSTALL_DIR:-/opt/AURAui}"
AURAI_REPO="${AURAI_REPO:-https://github.com/Furiade54/AURAui.git}"
AURAI_BRANCH="${AURAI_BRANCH:-main}"

# Seguridad por defecto: NO INSTALAMOS Docker automáticamente.
# Así no se modifica por accidente una VPS con múltiples apps ya corriendo.
# Solo instala Docker si EXPLÍCITAMENTE ejecutas:  AURAI_INSTALL_DOCKER=1 sudo ./deploy-auraui.sh
AURAI_INSTALL_DOCKER="${AURAI_INSTALL_DOCKER:-0}"

AURAI_FORCE_REBUILD="${AURAI_FORCE_REBUILD:-0}"

# Bind address del puerto 50505. Se pasa directamente a docker-compose
# por interpolación ${AURAI_BIND_ADDRESS:-127.0.0.1}  (NO usamos sed,
# no modificamos el YAML original).
AURAI_BIND_ADDRESS="${AURAI_BIND_ADDRESS:-127.0.0.1}"

# Red Nginx Proxy Manager: cuando AURAI_USE_NPM_NETWORK=1 creamos
# docker-compose.override.yml que une el servicio a la red NPM externa.
# Así sobrevive a `docker compose up -d` (no se pierde al recrear el
# contenedor, a diferencia de `docker network connect` manual).
AURAI_USE_NPM_NETWORK="${AURAI_USE_NPM_NETWORK:-0}"
AURAI_NPM_NETWORK="${AURAI_NPM_NETWORK:-npm_default}"

DOCKER_MIN_MAJOR=24
COMPOSE_MIN_V2=2

# Exportamos todas las variables de AuraUI para que docker-compose
# pueda interpolarlas en el YAML sin tener que declararlas en env_file.
export AURAI_BIND_ADDRESS AURAI_USE_NPM_NETWORK AURAI_NPM_NETWORK

# =============================================================================
# PASO 0: requerimientos básicos
# =============================================================================
require_root
log "Iniciando despliegue AuraUI VPS Monitor..."
log "Directorio destino : ${AURAI_INSTALL_DIR}"
log "Repo               : ${AURAI_REPO} (rama ${AURAI_BRANCH})"
log "Instalar Docker?   : ${AURAI_INSTALL_DOCKER}  (0 = seguro, no toca paquetes)"
log "Rebuild sin cache? : ${AURAI_FORCE_REBUILD}"
log "Bind address :50505: ${AURAI_BIND_ADDRESS}   (pasado por var env a Compose, sin sed)"
log "Red NPM (externa)  : ${AURAI_USE_NPM_NETWORK}  (red=${AURAI_NPM_NETWORK}, vía override.yml)"
echo

# =============================================================================
# PASO 1: Instalar Docker + plugin compose (si falta y AURAI_INSTALL_DOCKER=1)
# =============================================================================
install_docker_ubuntu() {
  log "Actualizando índice apt..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  log "Añadiendo repositorio oficial Docker (apt)..."
  local keyring="/etc/apt/keyrings/docker.asc"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o "${keyring}" 2>/dev/null || \
  curl -fsSL https://download.docker.com/linux/debian/gpg  | gpg --dearmor -o "${keyring}" 2>/dev/null || true
  chmod a+r "${keyring}"

  local distro; distro="$(lsb_release -is 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  if [ -z "${distro}" ]; then distro="ubuntu"; fi
  local codename; codename="$(lsb_release -cs 2>/dev/null || echo jammy)"

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=${keyring}] https://download.docker.com/linux/${distro} ${codename} stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null

  apt-get update -y -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

ensure_docker() {
  if cmd_exists docker; then
    local dv; dv="$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 0.0.0)"
    local dmj; dmj="$(echo "${dv}" | cut -d. -f1)"
    if [ "${dmj}" -ge "${DOCKER_MIN_MAJOR}" ]; then
      ok "Docker ${dv} detectado (>= ${DOCKER_MIN_MAJOR})"
    else
      # Punto 3 del feedback: si existe Docker pero es < 24 y NO queremos que el
      # script toque paquetes (AURAI_INSTALL_DOCKER=0), fallamos y salimos.
      # No podemos garantizar compatibilidad con versiones antiguas.
      if [ "${AURAI_INSTALL_DOCKER}" = "1" ]; then
        warn "Docker ${dv} es antiguo (< ${DOCKER_MIN_MAJOR}). AURAI_INSTALL_DOCKER=1 → actualizando..."
        install_docker_ubuntu
      else
        fail "La versión de Docker instalada (${dv}) es < ${DOCKER_MIN_MAJOR} y no es compatible.
  Actualiza Docker manualmente o vuelve a ejecutar con AURAI_INSTALL_DOCKER=1 para actualizarla automáticamente:
      AURAI_INSTALL_DOCKER=1 sudo $(basename "$0")"
      fi
    fi
  else
    if [ "${AURAI_INSTALL_DOCKER}" = "1" ]; then
      log "Docker no detectado. AURAI_INSTALL_DOCKER=1 → instalando..."
      install_docker_ubuntu
    else
      fail "Docker no está instalado y AURAI_INSTALL_DOCKER=0. Instálalo manualmente o usa el modo 1."
    fi
  fi

  # docker compose plugin (v2)
  if docker compose version >/dev/null 2>&1; then
    local cv; cv="$(docker compose version --short 2>/dev/null || echo v0.0.0)"
    ok "Docker Compose plugin detectado: ${cv}"
  else
    fail "No está disponible el plugin 'docker compose' (v2). Reinstala Docker via apt oficial."
  fi
}
ensure_docker

# =============================================================================
# PASO 2: Descargar / actualizar el código desde GitHub
# =============================================================================
fetch_code() {
  if [ -d "${AURAI_INSTALL_DIR}/.git" ]; then
    log "Actualizando código existente en ${AURAI_INSTALL_DIR} (git fetch + reset hard)..."
    cd "${AURAI_INSTALL_DIR}"
    # Asegurarse de que la rama correcta está trackeada
    git remote set-url origin "${AURAI_REPO}" 2>/dev/null || true
    git fetch --depth=1 origin "${AURAI_BRANCH}" 2>/dev/null || git fetch --depth=1 origin
    # ---------------------------------------------------------------------
    # 🚨 NO HACEMOS `git clean -fd` PORQUE BORRARÍA .env.prod y OTROS
    # archivos locales NO versionados (y .env.prod NO DEBE estar en Git).
    # Solo hacemos reset --hard: actualiza tracked files; ignora untracked.
    # ---------------------------------------------------------------------
    git reset --hard "origin/${AURAI_BRANCH}" 2>/dev/null || git reset --hard FETCH_HEAD
    ok "Código actualizado a origin/${AURAI_BRANCH}"
  else
    log "Clonando repo por primera vez en ${AURAI_INSTALL_DIR}..."
    mkdir -p "$(dirname "${AURAI_INSTALL_DIR}")"
    if [ -d "${AURAI_INSTALL_DIR}" ]; then
      warn "${AURAI_INSTALL_DIR} ya existe pero no es un repo git. Hacemos backup a ${AURAI_INSTALL_DIR}.bak.$$"
      mv "${AURAI_INSTALL_DIR}" "${AURAI_INSTALL_DIR}.bak.$$"
    fi
    git clone --depth=1 --branch "${AURAI_BRANCH}" "${AURAI_REPO}" "${AURAI_INSTALL_DIR}"
    ok "Repo clonado"
  fi
  cd "${AURAI_INSTALL_DIR}"
}
fetch_code

# =============================================================================
# PASO 3: Comprobar ficheros críticos y preparar .env.prod
# =============================================================================
[ -f "docker-compose.yml" ] || fail "Falta docker-compose.yml en el repo (commit erroneo?)."
[ -f "Dockerfile"         ] || fail "Falta Dockerfile en el repo."

# ---------------------------------------------------------------------------
# .env.prod ES OBLIGATORIO porque docker-compose.yml declara
#   env_file:  - .env.prod
# Si no existiera, Docker Compose FALLA con:
#   Couldn't find env file: .../.env.prod
#
# Solución robusta, en este orden de preferencia:
#   a) Si .env.prod ya EXISTE          → NO lo tocamos (tiene credenciales reales).
#   b) Si existe .env.example          → lo copiamos como plantilla informativa.
#   c) Si no hay NINGUNA plantilla     → creamos .env.prod VACÍO.
# ---------------------------------------------------------------------------
if [ -f ".env.prod" ]; then
  ok ".env.prod detectado (conservando tus valores locales)."
else
  if [ -f ".env.example" ]; then
    log ".env.prod no existe → copiando plantilla .env.example"
    log "  📝 Nota: es OPCIONAL editarla. Si la dejas como está, cada usuario"
    log "     introduce sus credenciales VPS en Ajustes > Conexión VPS (UI)."
    cp -n .env.example .env.prod
  else
    warn "No se encontró ninguna plantilla de entorno."
    warn "Creando .env.prod VACÍO para que docker-compose no falle..."
    : > .env.prod
  fi
fi

# ---------------------------------------------------------------------------
# PASO 3.5: docker-compose.override.yml  ←  RED EXTERNA DE NGINX PROXY MANAGER
# -----------------------------------------------------------------------------
# SI AURAI_USE_NPM_NETWORK=1  →  creamos/actualizamos docker-compose.override.yml
#   que une el servicio "auraui" a la red externa de NPM.
#
# ✅ VENTAJAS FRENTE A `docker network connect` manual:
#   a) docker-compose LO APLICA AUTOMÁTICAMENTE en cada `up -d`.
#   b) SOBREVIVE a recreaciones del contenedor (no se pierde la conexión).
#   c) NO modificamos el docker-compose.yml original de Git.
#
# NOTA:  Si AURAI_USE_NPM_NETWORK=0 y docker-compose.override.yml existe
#        → LO BORRAMOS para no aplicar la red NPM por accidente.
# -----------------------------------------------------------------------------
apply_npm_network_override() {
  local OVERRIDE="docker-compose.override.yml"

  if [ "${AURAI_USE_NPM_NETWORK}" = "1" ]; then
    # 1) Asegurarse de que la red docker EXISTA. Si no, fallar con mensaje claro.
    if ! docker network inspect "${AURAI_NPM_NETWORK}" >/dev/null 2>&1; then
      fail "AURAI_USE_NPM_NETWORK=1 pero la red docker '${AURAI_NPM_NETWORK}' no existe.
  Crea la red primero (si la crea NPM al instalarse ya debería existir) o comprueba el nombre con:
       docker network ls | grep npm
  También puedes desactivar la opción:  AURAI_USE_NPM_NETWORK=0 y usar el forward por 127.0.0.1."
    fi

    log "AURAI_USE_NPM_NETWORK=1 → creando ${OVERRIDE} que une servicio a red externa '${AURAI_NPM_NETWORK}'..."
    cat > "${OVERRIDE}" <<YAML
# ---------------------------------------------------------------------------
# GENERADO AUTOMÁTICAMENTE POR deploy-auraui.sh
#   Redockerize este archivo con:  AURAI_USE_NPM_NETWORK=0  (se borra solo)
# ---------------------------------------------------------------------------
services:
  auraui:
    networks:
      - default
      - npmnet

networks:
  npmnet:
    name: ${AURAI_NPM_NETWORK}
    external: true
YAML
    ok "${OVERRIDE} generado. Forward host en NPM = auraui-vps-monitor (hostname red docker)."
  else
    if [ -f "${OVERRIDE}" ]; then
      warn "AURAI_USE_NPM_NETWORK=0 y existe ${OVERRIDE} → lo borramos para no mantener la conexión NPM."
      rm -f "${OVERRIDE}"
    fi
  fi
}
apply_npm_network_override

# =============================================================================
# PASO 4: Build PRIMERO, después up -d (cero downtime)
# -----------------------------------------------------------------------------
# ORDEN ANTES (down → build → up):  downtime durante TODO el build (minutos).
# ORDEN AHORA (build → up -d):      el contenedor ANTIGUO SIGUE CORRIENDO
#                                    mientras construimos la imagen nueva.
#                                    docker compose up -d recrea el contenedor
#                                    ~1s cuando la imagen ya está lista.
# =============================================================================
BUILD_ARGS=()
if [ "${AURAI_FORCE_REBUILD}" = "1" ]; then
  BUILD_ARGS+=(--no-cache)
fi

log "Construyendo imagen AuraUI (multi-stage alpine) — esto tarda 2–4 min..."
log "  (el contenedor anterior sigue en marcha mientras se construye ✔)"
docker compose build "${BUILD_ARGS[@]}"
ok "Build completado"

log "Aplicando nueva imagen (docker compose up -d)..."
docker compose up -d
ok "Contenedor recreado con la nueva imagen"

# =============================================================================
# PASO 5: Esperar a que arranque + healthcheck /api/health
# =============================================================================
HEALTH_URL="http://127.0.0.1:50505/api/health"
log "Esperando a que la API esté lista (max 60s)..."
READY=0
for i in $(seq 1 30); do
  sleep 2
  HC="$(curl -fsS --max-time 2 "${HEALTH_URL}" 2>/dev/null || true)"
  if echo "${HC}" | grep -q '"ok"\s*:\s*true'; then
    READY=1
    break
  fi
done

echo
if [ "${READY}" = "1" ]; then
  ok "Healthcheck API: ${HC}"
else
  warn "Healthcheck no respondió ok después de 60s. Consulta los logs:"
  echo "       docker compose -f ${AURAI_INSTALL_DIR}/docker-compose.yml logs -f --tail=80 auraui"
fi

# =============================================================================
# PASO 6: Resumen + URLs
# =============================================================================
PUBLIC_IP=""
if cmd_exists hostname; then
  # Mejor: usa varias fuentes (evita dependencias de curl a 3ros si no hay)
  if cmd_exists curl; then
    PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
              || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
              || echo "")"
  fi
fi

echo
echo "=============================================================="
echo "  ☁️   AURAUI VPS MONITOR — DESPLIEGUE FINALIZADO"
echo "=============================================================="
echo "  Contenedor : auraui-vps-monitor"
echo "  Directorio : ${AURAI_INSTALL_DIR}"
echo "  Health     : ${HEALTH_URL}"
echo "  Bind addrs : ${AURAI_BIND_ADDRESS}:50505 -> 50505/tcp"
echo

if [ -n "${PUBLIC_IP}" ] && [ "${AURAI_BIND_ADDRESS}" = "0.0.0.0" ]; then
  echo "  Acceso directo por IP     :  http://${PUBLIC_IP}:50505"
elif [ -n "${PUBLIC_IP}" ]; then
  echo "  (bind 127.0.0.1 → NO accesible directo por IP pública)"
  echo "  Entra por nginx-proxy-manager o usa ssh tunel:"
  echo "      ssh -L 50505:127.0.0.1:50505 ist@${PUBLIC_IP}"
  echo "      y abre en tu navegador:  http://127.0.0.1:50505"
fi
echo
echo "  Si usas nginx-proxy-manager (NPM):"
if [ "${AURAI_USE_NPM_NETWORK}" = "1" ]; then
  echo "    · Forward Host : auraui-vps-monitor   (por red docker '${AURAI_NPM_NETWORK}')"
  echo "    · Forward Port : 50505"
  echo "    · ☑ Websockets Support (O BLIGATORIO para la terminal SSH)"
else
  echo "    · Forward Host : 127.0.0.1"
  echo "         o vuelve a ejecutar con  AURAI_USE_NPM_NETWORK=1  para integrar la red"
  echo "    · Forward Port : 50505"
  echo "    · ☑ Websockets Support (O BLIGATORIO para la terminal SSH)"
fi
echo
echo "  Comandos rápidos:"
echo "    · Ver logs    : docker compose -f ${AURAI_INSTALL_DIR}/docker-compose.yml logs -f --tail=50 auraui"
echo "    · Reiniciar   : cd ${AURAI_INSTALL_DIR} && docker compose restart auraui"
echo "    · Parar       : cd ${AURAI_INSTALL_DIR} && docker compose down"
echo "    · Actualizar  : sudo ${AURAI_INSTALL_DIR}/deploy-auraui.sh"
echo "                    o el one-liner curl desde GitHub (mismo resultado)."
echo "=============================================================="
