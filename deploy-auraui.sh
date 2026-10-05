#!/usr/bin/env bash
# =============================================================================
# deploy-auraui.sh  —  v2  (estándar checklist calidad zmejoras.md, 18 items)
# =============================================================================
# Script de despliegue para AuraUI VPS Monitor.
#   - Compatible: Ubuntu 22.04+, Debian 12+, cualquier bash + apt.
#   - 1 servicio en compose: "auraui"  (Express + SPA same-port + websocket).
#   - MODELO DE PARTIDA: Modelo A (HTTP healthcheck, sin proxy Nginx interno;
#     el proxy NPM es externo en su propio contenedor).
#
# =============================================================================
# USO RÁPIDO EN LA VPS:
#   curl -fsSL https://raw.githubusercontent.com/Furiade54/AURAui/main/deploy-auraui.sh | sudo bash -s -- -f
#
# O si ya está clonado en /opt/AURAui:
#   chmod +x ./deploy-auraui.sh
#   sudo ./deploy-auraui.sh            # early exit si no hay cambios nuevos
#   sudo ./deploy-auraui.sh -f         # forzar rebuild / redeploy sin cambios
#   sudo ./deploy-auraui.sh -h         # ayuda
# =============================================================================
# VARIABLES DE ENTORNO SOBREESCRIBIBLES (además de los CLI flags):
#   AURAI_INSTALL_DIR=/opt/AURAui          # ruta donde vive el repo en la VPS
#   AURAI_REPO=https://github.com/Furiade54/AURAui.git
#   AURAI_BRANCH=main
#   AURAI_INSTALL_DOCKER=0   # 1 = instalar / actualizar Docker por apt si falta
#   AURAI_BIND_ADDRESS=127.0.0.1   # 127.0.0.1 = solo loopback (segura, NPM)
#                                  # 0.0.0.0   = pública por IP:50505
#   AURAI_USE_NPM_NETWORK=0        # 1 = crea docker-compose.override.yml uniendo
#                                  #     el servicio a red externa ${AURAI_NPM_NETWORK}
#   AURAI_NPM_NETWORK=npm_default  # nombre red Docker de nginx-proxy-manager
#   AURAI_CLOBBER_NON_GIT=0        # 1 = permite que si /opt/AURAui existe y NO es
#                                  #     git, haga mv a .bak.PID + clonar limpio
#                                  #     (conserva .env.prod / override.yml en backup)
# =============================================================================

# --------- 1. Strict mode  (Eeuo: -E activa trap ERR en funciones/subshells) ----
set -Eeuo pipefail

# =============================================================================
# 0. CONSTANTES ESPECÍFICAS DEL PROYECTO (edita aquí si cambia el compose)
# =============================================================================
PROJECT_DIR="${AURAI_INSTALL_DIR:-/opt/AURAui}"
COMPOSE_FILE="docker-compose.yml"
BRANCH="${AURAI_BRANCH:-main}"
AURAI_REPO_REMOTE="${AURAI_REPO:-https://github.com/Furiade54/AURAui.git}"
BACKEND_PORT=50505
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/api/health"
SERVICES=(auraui)                        # nombres de los servicios en compose
REQUIRED_VARS=()                         # AuraUI modo UI normal NO necesita
                                         # NINGUNA variable obligatoria en .env
WARN_VARS=()                             # vars recomendadas pero no bloqueantes
DOCKER_MIN_MAJOR=24

# --------- 2. Helpers con TIMESTAMP + colores -------------------------------
ts()      { date '+%Y-%m-%d %H:%M:%S'; }
if [ -t 1 ]; then
  C_RED=$'\033[0;31m';   C_GREEN=$'\033[0;32m'
  C_AMBER=$'\033[0;33m'; C_BLUE=$'\033[0;34m'
  C_RESET=$'\033[0m'
else
  C_RED=""; C_GREEN=""; C_AMBER=""; C_BLUE=""; C_RESET=""
fi
log()     { echo          "[$(ts)] ${C_BLUE}[INFO]${C_RESET}  $*"; }
ok()      { echo          "[$(ts)] ${C_GREEN}[ OK ]${C_RESET}  $*"; }
warn()    { echo >&2      "[$(ts)] ${C_AMBER}[WARN]${C_RESET}  $*"; }
err()     { echo >&2      "[$(ts)] ${C_RED}[ERR ]${C_RESET}  $*"; }
success() { echo          "[$(ts)] ${C_GREEN}[✔]${C_RESET}     $*"; }
warning() { echo          "[$(ts)] ${C_AMBER}[!]${C_RESET}     $*"; }
error()   { echo          "[$(ts)] ${C_RED}[✖]${C_RESET}     $*"; }
cmd_exists(){ command -v "$1" >/dev/null 2>&1; }

FAILED=0   # variable global: 0 = OK, >0 = algún fallo en health/logs/status

# =============================================================================
# --------- 3. TRAP ERR con comandos pre-cocinados para el admin estresado ---
# =============================================================================
trap 'err "Fallo en la línea $LINENO. Código exit: $?";
      echo;
      echo "Comandos útiles para depurar:";
      echo "  ${DC[*]} -f $PROJECT_DIR/$COMPOSE_FILE logs --tail=120 auraui";
      echo "  ${DC[*]} -f $PROJECT_DIR/$COMPOSE_FILE ps";
      echo "  cd $PROJECT_DIR && ${DC[*]} config --quiet";
      exit 1' ERR

# =============================================================================
# --------- 4. CLI: -f / --force   y   -h / --help -------------------------
# =============================================================================
FORCE=0
usage(){
  cat <<EOF
Uso: $0 [-f|--force] [-h|--help]

  -f, --force      Fuerza rebuild + redeploy aunque el repo ya esté
                   al día (no hace early exit por LOCAL==REMOTE).
  -h, --help       Muestra esta ayuda.

Variables de entorno (AuraUI específicas, opcionales):
  AURAI_INSTALL_DIR      Ruta del proyecto (default: /opt/AURAui)
  AURAI_REPO             URL del repo Git remoto
  AURAI_BRANCH           Rama a deployar (default: main)
  AURAI_INSTALL_DOCKER   1 = instalar/actualizar Docker por apt (default: 0)
  AURAI_BIND_ADDRESS     Bind address del puerto 50505 en Compose
                         (default: 127.0.0.1, seguro para NPM proxy)
  AURAI_USE_NPM_NETWORK  1 = unir servicio a red Docker NPM (default: 0)
  AURAI_NPM_NETWORK      Nombre red externa NPM (default: npm_default)
  AURAI_CLOBBER_NON_GIT  1 = consentir mv a backup + clone limpio si
                         /opt/AURAui existe pero NO es un repo Git (default: 0)

Ejemplos:
  sudo $0                 # deploy normal (early exit si no hay cambios)
  sudo $0 -f              # forzar rebuild completo
  curl ... | sudo bash -s -- -f
EOF
  exit 0
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--force) FORCE=1; shift ;;
    -h|--help)  usage ;;
    *)          err "Opción desconocida: $1"; usage ;;
  esac
done

# Backwards-compat: AURAI_FORCE_REBUILD=1 → equivalente a -f
if [[ "${AURAI_FORCE_REBUILD:-0}" == "1" ]]; then FORCE=1; fi

# =============================================================================
# --------- 5. Detectar Docker Compose: plugin v2 O standalone legacy -------
# =============================================================================
# detect_docker_compose(): escribe el array DC por referencia (global)
#   - Devuelve 0 si encontró alguno, 1 si ninguno.
#   - Popula el array GLOBAL DC[] con "docker" "compose"  o  "docker-compose"
# =============================================================================
detect_docker_compose(){
  if docker compose version >/dev/null 2>&1; then
    DC=(docker compose)
  elif cmd_exists docker-compose; then
    DC=(docker-compose)
  else
    DC=()
    return 1
  fi
  return 0
}
detect_docker_compose || true
(( ${#DC[@]} == 0 )) && { err "No se detectó Docker Compose (plugin v2 ni docker-compose standalone). Instálalo primero o ejecuta con AURAI_INSTALL_DOCKER=1."; exit 1; }
dc(){ "${DC[@]}" -f "$COMPOSE_FILE" "$@"; }

# =============================================================================
# Funciones auxiliares específicas de AuraUI
# =============================================================================
require_root(){
  if [[ "$(id -u)" -ne 0 ]]; then
    err "Ejecuta este script con sudo (necesitamos tocar /opt y Docker)."
    exit 1
  fi
}

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
  [[ -z "${distro}" ]] && distro="ubuntu"
  local codename; codename="$(lsb_release -cs 2>/dev/null || echo jammy)"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=${keyring}] https://download.docker.com/linux/${distro} ${codename} stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -y -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

ensure_docker(){
  if cmd_exists docker; then
    local dv; dv="$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 0.0.0)"
    local dmj; dmj="$(echo "${dv}" | cut -d. -f1)"
    if [[ "${dmj}" -ge "${DOCKER_MIN_MAJOR}" ]]; then
      ok "Docker ${dv} detectado (>= ${DOCKER_MIN_MAJOR})"
    else
      # checklist item 3: si versión < mínima y flag=0 fallamos; si flag=1 actualizamos
      if [[ "${AURAI_INSTALL_DOCKER:-0}" == "1" ]]; then
        warn "Docker ${dv} antiguo (< ${DOCKER_MIN_MAJOR}). AURAI_INSTALL_DOCKER=1 → actualizando..."
        install_docker_ubuntu
      else
        err "Docker ${dv} < ${DOCKER_MIN_MAJOR} y AURAI_INSTALL_DOCKER=0. Actualiza manualmente o usa:"
        echo "    AURAI_INSTALL_DOCKER=1 sudo $0"
        exit 1
      fi
    fi
  else
    if [[ "${AURAI_INSTALL_DOCKER:-0}" == "1" ]]; then
      log "Docker no detectado. AURAI_INSTALL_DOCKER=1 → instalando..."
      install_docker_ubuntu
    else
      err "Docker no instalado y AURAI_INSTALL_DOCKER=0. Instálalo manualmente o usa AURAI_INSTALL_DOCKER=1."
      exit 1
    fi
  fi
  # Re-detectar Compose (por si acabamos de actualizar Docker con plugin v2)
  detect_docker_compose || true
  (( ${#DC[@]} == 0 )) && { err "Aún no hay Docker Compose tras instalar Docker. Revisa la instalación."; exit 1; }
  ok "Docker Compose OK: $("${DC[@]}" version --short 2>/dev/null || true)"
}

# Clona el repo POR PRIMERA VEZ si el directorio destino no existe o no es git
clone_repo_first_time(){
  if [[ -d "${PROJECT_DIR}/.git" ]]; then return 0; fi
  if [[ ! -d "$(dirname "${PROJECT_DIR}")" ]]; then
    install -d -m 0755 "$(dirname "${PROJECT_DIR}")"
  fi
  if [[ -d "${PROJECT_DIR}" ]]; then
    local BACKUP_DIR="${PROJECT_DIR}.bak.$$"
    local ENV_BACKUP="" OVER_BACKUP=""
    [[ -f "${PROJECT_DIR}/.env.prod"                  ]] && ENV_BACKUP="${PROJECT_DIR}/.env.prod"
    [[ -f "${PROJECT_DIR}/docker-compose.override.yml" ]] && OVER_BACKUP="${PROJECT_DIR}/docker-compose.override.yml"
    echo
    error "=============================================================="
    error "  ${PROJECT_DIR} existe pero NO es un repositorio Git."
    error "  Para evitar pérdida de datos la acción requiere consentimiento."
    error "  · Se movería el directorio actual a backup:"
    error "      ${BACKUP_DIR}"
    error "  · Se clonaría ${BRANCH} desde ${AURAI_REPO_REMOTE}"
    error "  · Se CONSERVARÍAN automáticamente (si existen):"
    [[ -n "$ENV_BACKUP"  ]] && echo "        ✅ .env.prod"
    [[ -n "$OVER_BACKUP" ]] && echo "        ✅ docker-compose.override.yml"
    error "=============================================================="
    echo "  Para CONFIRMAR esta operación, vuelve a ejecutar con:"
    echo "      AURAI_CLOBBER_NON_GIT=1 sudo $0 $*"
    echo "  O borra/mueve manualmente ${PROJECT_DIR} antes de ejecutar."
    echo
    if [[ "${AURAI_CLOBBER_NON_GIT:-0}" != "1" ]]; then
      exit 1
    fi
    # Usuario dio consentimiento: proceder
    mv "${PROJECT_DIR}" "${BACKUP_DIR}"
    log "Directorio movido a backup OK: ${BACKUP_DIR}"

    log "Clonando por primera vez ${AURAI_REPO_REMOTE}#${BRANCH} → ${PROJECT_DIR}"
    git clone --depth=1 --branch "${BRANCH}" "${AURAI_REPO_REMOTE}" "${PROJECT_DIR}"

    # Restaurar archivos locales IMPORTANTES desde el backup (nunca pisar si ya existen en clone)
    if [[ -n "$ENV_BACKUP"  ]] && [[ ! -f "${PROJECT_DIR}/.env.prod" ]]; then
      cp -p "${BACKUP_DIR}/.env.prod" "${PROJECT_DIR}/"
      ok ".env.prod restaurado desde backup (${BACKUP_DIR})."
    fi
    if [[ -n "$OVER_BACKUP" ]] && [[ ! -f "${PROJECT_DIR}/docker-compose.override.yml" ]]; then
      cp -p "${BACKUP_DIR}/docker-compose.override.yml" "${PROJECT_DIR}/"
      ok "docker-compose.override.yml restaurado desde backup."
    fi
    ok "Repo clonado + datos locales conservados."
    return 0
  fi
  log "Clonando por primera vez ${AURAI_REPO_REMOTE}#${BRANCH} → ${PROJECT_DIR}"
  git clone --depth=1 --branch "${BRANCH}" "${AURAI_REPO_REMOTE}" "${PROJECT_DIR}"
  ok "Repo clonado."
}

# Apply/teardown docker-compose.override.yml para red externa NPM
apply_npm_network_override(){
  local OVERRIDE="docker-compose.override.yml"
  if [[ "${AURAI_USE_NPM_NETWORK:-0}" == "1" ]]; then
    if ! docker network inspect "${AURAI_NPM_NETWORK:-npm_default}" >/dev/null 2>&1; then
      err "AURAI_USE_NPM_NETWORK=1, pero la red Docker '${AURAI_NPM_NETWORK:-npm_default}' no existe."
      echo "  Comprueba:   docker network ls | grep npm"
      echo "  O desactiva:  AURAI_USE_NPM_NETWORK=0 (usa forward 127.0.0.1 desde NPM)"
      exit 1
    fi
    log "Creando ${OVERRIDE} → une el servicio a red Docker NPM '${AURAI_NPM_NETWORK:-npm_default}'."
    cat > "${OVERRIDE}" <<YAML
# GENERADO AUTOMÁTICAMENTE POR deploy-auraui.sh
# Elimina este archivo o usa AURAI_USE_NPM_NETWORK=0 para deshacer.
services:
  auraui:
    networks:
      - default
      - npmnet
networks:
  npmnet:
    name: ${AURAI_NPM_NETWORK:-npm_default}
    external: true
YAML
    ok "${OVERRIDE} creado. Forward host en NPM: auraui-vps-monitor (container hostname)."
  else
    if [[ -f "${OVERRIDE}" ]]; then
      warn "AURAI_USE_NPM_NETWORK=0 y existe ${OVERRIDE} → borrado para deshacer conexión NPM."
      rm -f "${OVERRIDE}"
    fi
  fi
}

# =============================================================================
require_root
ensure_docker

# ------ 1ª vez: clonar el repo si no existe -------------------------------
clone_repo_first_time

# =============================================================================
# --------- 6. Validación básica: comandos + directorio + git + compose -----
# =============================================================================
for cmd in git docker curl; do
  cmd_exists "$cmd" || { err "Falta comando requerido: $cmd"; exit 1; }
done
[[ -d "$PROJECT_DIR" ]] || { err "No existe directorio proyecto: $PROJECT_DIR"; exit 1; }
cd "$PROJECT_DIR"
[[ -d ".git"         ]] || { err "$PROJECT_DIR no es un repositorio Git"; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { err "No existe $COMPOSE_FILE en $PROJECT_DIR"; exit 1; }
ok "Validación básica OK (comandos, dir, .git, compose)."

# =============================================================================
# --------- 7. Guardia: cambios locales SIN commit (ignora el propio .sh) ---
# =============================================================================
# Se permite untracked a archivos locales esperados:
#   deploy-auraui.sh            (propio script: chmod, CR/LF, edición manual)
#   .env.prod                   (gitignore, credenciales VPS modo dedicado)
#   docker-compose.override.yml (generado automáticamente por este mismo script)
DIRTY="$(git status --porcelain | grep -vE '^.{0,2}[[:space:]]+deploy-auraui\.sh$|^.{0,2}[[:space:]]+\.env\.prod$|^.{0,2}[[:space:]]+docker-compose\.override\.yml$' || true)"
if [[ -n "${DIRTY}" ]]; then
  err "Hay cambios locales sin commit (distintos de deploy-auraui.sh / .env.prod / override.yml). Cancelando por seguridad."
  git status --short
  exit 1
fi
ok "Working tree limpio (o cambios permitidos)."

# Export bind address para interpolación Compose del yaml
export AURAI_BIND_ADDRESS="${AURAI_BIND_ADDRESS:-127.0.0.1}"
export AURAI_USE_NPM_NETWORK AURAI_NPM_NETWORK

# =============================================================================
# --------- 8. Fetch + early exit si LOCAL == REMOTE y sin --force ---------
# =============================================================================
log "git fetch origin ${BRANCH}..."
git remote set-url origin "${AURAI_REPO_REMOTE}" 2>/dev/null || true
git fetch origin "${BRANCH}"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/${BRANCH}")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] && (( ! FORCE )); then
  warn "El proyecto ya está al día (commit $(git rev-parse --short HEAD)). Nada que hacer. Usa -f para forzar rebuild."
  # Aplicar override NPM (por si el user activó flag aunque no haya nuevos commits)
  apply_npm_network_override
  dc ps
  exit 0
fi

# =============================================================================
# --------- 9. git reset --hard origin/<branch>  (garantiza estado idéntico,
#            pisa tracked files divergentes, NUNCA toca untracked/.gitignore)
# =============================================================================
if ! (( FORCE )); then
  log "Nuevos commits desde $(git rev-parse --short "$LOCAL_SHA") → $(git rev-parse --short "$REMOTE_SHA"):"
  git --no-pager log --oneline "${LOCAL_SHA}..${REMOTE_SHA}" 2>/dev/null | sed 's/^/ • /' || true
fi
git reset --hard "origin/${BRANCH}"
ok "reset --hard origin/${BRANCH} completado → $(git rev-parse --short HEAD)"

# =============================================================================
# --------- 10. Validación .env.prod con REQUIRED_VARS + WARN_VARS ---------
# =============================================================================
# .env.prod es OBLIGATORIO que EXISTA para docker-compose (declara env_file),
# pero AuraUI modo normal NO requiere NINGÚN valor concreto (credenciales VPS
# por la UI). Si el usuario quiere "panel dedicado" puede rellenar VPS_HOST.
if [[ ! -f ".env.prod" ]]; then
  if [[ -f ".env.example" ]]; then
    warn ".env.prod no existe → copiando plantilla .env.example (no es necesario editarla)."
    cp -n .env.example .env.prod
  else
    warn "No existe .env.example → creando .env.prod VACÍO para Compose."
    : > .env.prod
  fi
fi

# REQUIRED_VARS: en subshell (set -a / set +a), NO contaminar entorno con secrets
if (( ${#REQUIRED_VARS[@]} > 0 )); then
  (
  set -a; . ./.env.prod 2>/dev/null || true; set +a
  for v in "${REQUIRED_VARS[@]}"; do
    val="${!v:-}"; [[ -z "$val" ]] && echo "$v"
  done
  ) > /tmp/.missing.vars.$$ 2>/dev/null || true
  mapfile -t MISSING < /tmp/.missing.vars.$$
  rm -f /tmp/.missing.vars.$$
  (( ${#MISSING[@]} > 0 )) && { err "Faltan REQUIRED_VARS en .env.prod: ${MISSING[*]}"; exit 1; }
fi
# WARN_VARS
if (( ${#WARN_VARS[@]} > 0 )); then
  (
  set -a; . ./.env.prod 2>/dev/null || true; set +a
  for v in "${WARN_VARS[@]}"; do
    val="${!v:-}"; [[ -z "$val" ]] && warn "Variable $v vacía en .env.prod (recomendado rellenar)."
  done
  ) || true
fi
ok ".env.prod validado."

# Aplicar NPM override (crea override.yml si es necesario) DESPUÉS del reset --hard
apply_npm_network_override

# =============================================================================
# --------- 11. dc config --quiet (detecta YAMLs mal indentados en 2s) -----
# =============================================================================
dc config --quiet >/dev/null
ok "$COMPOSE_FILE sintaxis Compose válida."

# =============================================================================
# --------- 12. dc build (--no-cache si -f) ----------------------------------
# =============================================================================
BUILD_ARGS=()
(( FORCE )) && BUILD_ARGS+=(--no-cache)
log "Construyendo imagen AuraUI (multi-stage alpine) — tarda 2-4 min..."
dc build "${BUILD_ARGS[@]}"
ok "Build completado."

# =============================================================================
# --------- 13. dc up -d --remove-orphans ------------------------------------
# =============================================================================
log "Recreando contenedores (dc up -d --remove-orphans)..."
dc up -d --remove-orphans
ok "Contenedor(s) levantados con la nueva imagen."

# =============================================================================
# --------- 14. Healthcheck Modelo A: wait_for_http -------------------------
# =============================================================================
HEALTH_TIMEOUT_SECONDS=60; HEALTH_POLL_EVERY=2
wait_for_http(){
  local url="$1" name="$2"
  local end=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
  while (( $(date +%s) < end )); do
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")"
    case "$code" in
      000|502|503|504) : ;;
      *) success "${name} HTTP ${code} OK"; return 0 ;;
    esac
    sleep $HEALTH_POLL_EVERY
  done
  error "Timeout ${HEALTH_TIMEOUT_SECONDS}s esperando ${name} (${url})"
  FAILED=1
}
wait_for_http "${HEALTH_URL}" "AuraUI API health"

# =============================================================================
# --------- 15. Revisión logs recientes backend (SINCE 5m, NO tail) ---------
# =============================================================================
BACKEND_LOGS_SINCE="5m"
BACKEND_LOGS="$(dc logs auraui --since "$BACKEND_LOGS_SINCE" 2>/dev/null || true)"

if [[ -z "${BACKEND_LOGS}" ]]; then
  ok "AuraUI: sin logs nuevos en los últimos ${BACKEND_LOGS_SINCE} (contenedor ya running, sin restart detectado)."
else
  # 15a) Genérico (chequeo patrones de error)
  if echo "${BACKEND_LOGS}" | grep -qiE "ERROR|Fallo|No se pudo|Exception|EADDRINUSE|ECONNREFUSED"; then
    error "Patrones de error detectados en logs de auraui (últimos ${BACKEND_LOGS_SINCE}):"
    echo "${BACKEND_LOGS}" | grep -iE "ERROR|Fallo|No se pudo|Exception|EADDRINUSE|ECONNREFUSED" | head -15 | sed 's/^/    /'
    FAILED=1
  else
    ok "Logs auraui: sin errores conocidos (últimos ${BACKEND_LOGS_SINCE})."
  fi

  # 15b) ESPECÍFICO AURAUI: marcas de arranque correcto del backend Express
  #      (server/index.js:169  imprime "[server] AuraUI VPS Monitor running on http://HOST:PORT")
  if echo "${BACKEND_LOGS}" | grep -qE '\[server\] AuraUI VPS Monitor running on http'; then
    success "AuraUI backend: arranque correcto detectado en logs (listening on HOST:PORT)."
  else
    warning "AuraUI backend: no se detectó el mensaje de arranque OK '[server] AuraUI VPS Monitor running on http'. Revisa logs si el health fallara."
  fi
fi

# =============================================================================
# --------- 16. Estado final de cada servicio (healthy/running/KO) ----------
#            Usa Go-template en lugar de JSON para máxima compatibilidad
#            Compose v2 plugin / v1 standalone / docker ps fallback
# =============================================================================
for svc in "${SERVICES[@]}"; do
  # 1) Intentar compose ps (v2 o v1) con Go-template pipe-separado
  STATUS_LINE="$(dc ps --format '{{.Name}}|{{.State}}|{{.Health}}' "$svc" 2>/dev/null || true)"
  # 2) Fallback: si vacío, usar docker ps por container_name hardcodeado (auraui-vps-monitor)
  #    Algunos compose antiguos devuelven vacío por nombre de servicio; docker ps siempre tiene el nombre contenedor.
  if [[ -z "$STATUS_LINE" ]]; then
    STATUS_LINE="$(docker ps -a --format '{{.Names}}|{{.State}}|{{.Health}}' --filter "name=^/auraui-vps-monitor$" 2>/dev/null || true)"
  fi
  STATE="$(echo "$STATUS_LINE" | awk -F'|' '{print $2}' | tr '[:upper:]' '[:lower:]' || true)"
  HEALTH="$(echo "$STATUS_LINE" | awk -F'|' '{print $3}' | tr '[:upper:]' '[:lower:]' || true)"

  if   [[ "$HEALTH" == *"healthy"* ]]; then success "$svc healthy (${STATE})"
  elif [[ "$STATE"  == *"running"* ]]; then warning "$svc running (health=${HEALTH:-no-check})"
  else
    error "$svc KO (state=${STATE:-unknown}, health=${HEALTH:-n/a})"
    FAILED=1
  fi
done

# =============================================================================
# --------- 17. Prune condicional: SÓLO imágenes dangling, SÓLO si FAILED=0 -
# =============================================================================
if (( FAILED == 0 )); then
  BEFORE="$(docker images -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ')"
  docker image prune -f --filter "dangling=true" >/dev/null 2>&1 || true
  AFTER="$(docker images -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ')"
  REMOVED=$(( BEFORE - AFTER ))
  if   (( REMOVED > 0 )); then log "docker image prune: liberadas ${REMOVED} imágenes dangling (<none>)."
  else                            log "docker image prune: nada que limpiar."
  fi
else
  warning "Hubo fallos. Se OMITE el prune por seguridad (conservamos imagen anterior para rollback manual)."
  warning "  Cuando lo arregles:  docker image prune -f --filter dangling=true"
fi

# =============================================================================
# --------- 18. Resumen final + exit 0 / exit 1 -----------------------------
# =============================================================================
echo
dc ps
echo

# Detectar IP pública para imprimir URLs si es necesario
PUBLIC_IP=""
if cmd_exists curl; then
  PUBLIC_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
           || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null \
           || echo "")"
fi

if (( FAILED == 0 )); then
  echo "=============================================================="
  echo "  ☁️   DESPLIEGUE AURAUI OK"
  echo "=============================================================="
  echo "  Commit     : $(git rev-parse --short HEAD)"
  echo "  Proyecto   : ${PROJECT_DIR}"
  echo "  Rama       : ${BRANCH}"
  echo "  Compose    : ${COMPOSE_FILE}"
  echo "  Health     : ${HEALTH_URL}"
  echo "  Bind addr  : ${AURAI_BIND_ADDRESS}:${BACKEND_PORT} → 50505/tcp"
  echo
  if [[ -n "${PUBLIC_IP}" && "${AURAI_BIND_ADDRESS}" == "0.0.0.0" ]]; then
    echo "  Acceso directo IP  : http://${PUBLIC_IP}:${BACKEND_PORT}/"
  elif [[ -n "${PUBLIC_IP}" ]]; then
    echo "  (bind 127.0.0.1 → NO es público. Usa NPM Proxy Manager o SSH tunnel:)"
    echo "      ssh -L ${BACKEND_PORT}:127.0.0.1:${BACKEND_PORT} ist@${PUBLIC_IP}"
    echo "      y abre http://127.0.0.1:${BACKEND_PORT}/"
  fi
  echo
  if [[ "${AURAI_USE_NPM_NETWORK:-0}" == "1" ]]; then
    echo "  NPM Proxy Manager → Forward Host: auraui-vps-monitor   Port: ${BACKEND_PORT}"
  else
    echo "  NPM Proxy Manager → Forward Host: 127.0.0.1               Port: ${BACKEND_PORT}"
    echo "                        (o ejecuta de nuevo con AURAI_USE_NPM_NETWORK=1)"
  fi
  echo "  ☑ Websockets Support en NPM es OBLIGATORIO para la terminal SSH."
  echo "=============================================================="
  exit 0
else
  err "=============================================================="
  err "  ✖   DESPLIEGUE AURAUI CON FALLOS"
  err "=============================================================="
  echo "  Commit     : $(git rev-parse --short HEAD)"
  echo "  Proyecto   : ${PROJECT_DIR}"
  echo "  Rama       : ${BRANCH}"
  echo
  echo "  Comandos útiles:"
  echo "   ${DC[*]} -f ${PROJECT_DIR}/${COMPOSE_FILE} logs --tail=120 auraui"
  echo "   ${DC[*]} -f ${PROJECT_DIR}/${COMPOSE_FILE} ps"
  echo "   cd ${PROJECT_DIR} && ${DC[*]} config --quiet"
  echo "=============================================================="
  exit 1
fi

# =============================================================================
#  CHECKLIST BLOQUEANTE (zmejoras.md, 21 puntos)
# =============================================================================
# [x]  1. Shebang = #!/usr/bin/env bash (no /bin/bash)
# [x]  2. set -Eeuo pipefail
# [x]  3. trap ERR con comandos logs pre-cocinados
# [x]  4. CLI -f/--force y -h/--help funcionan
# [x]  5. detect_docker_compose() existe y prueba v2 y legacy
# [x]  6. Valida $PROJECT_DIR, .git, $COMPOSE_FILE
# [x]  7. Guarda git status --porcelain e IGNORA el propio deploy-auraui.sh + .env.prod + override.yml
# [x]  8. Fetch + early exit cuando local==remote y sin --force
# [x]  9. git fetch + git reset --hard origin/<branch> (no diverge, NO toca untracked/.gitignore)
# [x] 10. .env.prod validado; REQUIRED_VARS bloqueante + WARN_VARS warning en subshell
# [x] 11. dc config --quiet antes de build
# [x] 12. dc build (con --no-cache si FORCE)
# [x] 13. dc up -d --remove-orphans
# [x] 14. Healthcheck HTTP wait_for_http con timeout (60s)
# [x] 15. Revisión logs auraui --since 5m; chequeo genérico ERROR + bloque específico AuraUI ([server] running on http)
# [x] 16. dc ps / docker ps fallback Go-template (Name|State|Health), marca healthy/running/KO
# [x] 17. Prune condicional solo si FAILED==0 (dangling images)
# [x] 18. Resumen final: URLs/commit/rama, exit 0 o exit 1 con comandos
# [ ] 19. (lo haces manualmente en la VPS) bash -n deploy-auraui.sh → exit 0
# [ ] 20. (lo haces manualmente) ./deploy-auraui.sh early exit OK
# [ ] 21. (lo haces manualmente) ./deploy-auraui.sh --force rebuild + deploy OK
