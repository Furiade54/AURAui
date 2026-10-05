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
#   export AURAI_INSTALL_DIR="/opt/auraui"
#   export AURAI_REPO="https://github.com/Furiade54/AURAui.git"
#   export AURAI_BRANCH="main"
#   export AURAI_INSTALL_DOCKER=1   # 1 = intentar instalar docker si falta, 0 = no
#   export AURAI_FORCE_REBUILD=1    # 1 = --no-cache siempre
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
AURAI_INSTALL_DIR="${AURAI_INSTALL_DIR:-/opt/auraui}"
AURAI_REPO="${AURAI_REPO:-https://github.com/Furiade54/AURAui.git}"
AURAI_BRANCH="${AURAI_BRANCH:-main}"
AURAI_INSTALL_DOCKER="${AURAI_INSTALL_DOCKER:-1}"
AURAI_FORCE_REBUILD="${AURAI_FORCE_REBUILD:-0}"

DOCKER_MIN_MAJOR=24
COMPOSE_MIN_V2=2

# =============================================================================
# PASO 0: requerimientos básicos
# =============================================================================
require_root
log "Iniciando despliegue AuraUI VPS Monitor..."
log "Directorio destino : ${AURAI_INSTALL_DIR}"
log "Repo               : ${AURAI_REPO} (rama ${AURAI_BRANCH})"
log "Instalar Docker?   : ${AURAI_INSTALL_DOCKER}"
log "Rebuild sin cache? : ${AURAI_FORCE_REBUILD}"
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
  if cmd_exists docker && cmd_exists docker; then
    local dv; dv="$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 0.0.0)"
    local dmj; dmj="$(echo "${dv}" | cut -d. -f1)"
    if [ "${dmj}" -ge "${DOCKER_MIN_MAJOR}" ]; then
      ok "Docker ${dv} detectado (>= ${DOCKER_MIN_MAJOR})"
    else
      warn "Docker ${dv} es antiguo (< ${DOCKER_MIN_MAJOR}). Intentaremos actualizarlo."
      install_docker_ubuntu
    fi
  else
    if [ "${AURAI_INSTALL_DOCKER}" = "1" ]; then
      log "Docker no detectado. Instalándolo automáticamente..."
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
    log "Actualizando código existente en ${AURAI_INSTALL_DIR} (git pull)..."
    cd "${AURAI_INSTALL_DIR}"
    # Asegurarse de que la rama correcta está trackeada
    git remote set-url origin "${AURAI_REPO}" 2>/dev/null || true
    git fetch --depth=1 origin "${AURAI_BRANCH}" 2>/dev/null || git fetch --depth=1 origin
    git reset --hard "origin/${AURAI_BRANCH}" 2>/dev/null || git reset --hard FETCH_HEAD
    git clean -fd
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
# PASO 3: Comprobar ficheros críticos y preparar .env.prod (si no existe)
# =============================================================================
[ -f "docker-compose.yml" ] || fail "Falta docker-compose.yml en el repo (commit erroneo?)."
[ -f "Dockerfile"         ] || fail "Falta Dockerfile en el repo."
[ -f ".env.prod.example"  ] || warn ".env.prod.example no encontrado — no hay plantilla de credenciales VPS fijas."

if [ ! -f ".env.prod" ] && [ -f ".env.prod.example" ]; then
  warn ".env.prod no existe → copiando plantilla .env.prod.example (edítala si quieres forzar VPS fija)."
  cp -n .env.prod.example .env.prod
fi

# =============================================================================
# PASO 4: Build + up
# =============================================================================
BUILD_ARGS=()
if [ "${AURAI_FORCE_REBUILD}" = "1" ]; then
  BUILD_ARGS+=(--no-cache)
fi

log "Deteniendo versión anterior (si la hay)..."
docker compose down || true

log "Construyendo imagen AuraUI (multi-stage alpine) — esto tarda 2–4 min..."
docker compose build "${BUILD_ARGS[@]}"
ok "Build completado"

log "Levantando contenedor auraui-vps-monitor..."
docker compose up -d
ok "Contenedor levantado"

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
echo "  Puerto     : 0.0.0.0:50505 -> 50505/tcp"
echo
if [ -n "${PUBLIC_IP}" ]; then
  echo "  Acceso directo (IP pública):  http://${PUBLIC_IP}:50505"
fi
echo
echo "  Si usas nginx-proxy-manager (NPM):"
echo "    · Forward Host : 127.0.0.1   (o mete AuraUI en la red npm_default)"
echo "    · Forward Port : 50505"
echo "    · ☑ Websockets Support (O BLIGATORIO para la terminal SSH)"
echo
echo "  Comandos rápidos:"
echo "    · Ver logs    : docker compose -f ${AURAI_INSTALL_DIR}/docker-compose.yml logs -f --tail=50 auraui"
echo "    · Reiniciar   : cd ${AURAI_INSTALL_DIR} && docker compose restart auraui"
echo "    · Parar       : cd ${AURAI_INSTALL_DIR} && docker compose down"
echo "    · Actualizar  : Volver a ejecutar ESTE MISMO script (hará git pull + rebuild + up)"
echo "=============================================================="
