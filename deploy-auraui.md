# DEPLOY-DOCKER — AuraUI VPS Monitor (Docker / Docker Compose)

## Arquitectura elegida
Un **solo contenedor** expone un único puerto `50505` con:
- API REST Express (`/api/*`)
- WebSocket real para terminal SSH (`/ws/terminal`)
- Frontend React pre-buildado servido estáticamente desde `/dist`
- Cualquier ruta que no sea `/api*` ni `/ws*` → SPA fallback a `index.html`

Esto permite poner detrás **nginx-proxy-manager** (que ya tienes en el puerto 80/443/80-81) y hacer
un **proxy_pass** directo al contenedor, sin CORS (mismo origen).

---

## Requisitos en la VPS destino
- Docker Engine 24+
- Docker Compose v2 (plugin `docker compose`)
- Suficiente RAM (~300–500 MB para Node 20 + 1 build Vite)

---

## Paso 1. Copiar el proyecto a tu VPS
```bash
# (Localmente)
scp -r ./AuraUI usuario@tu-vps:/opt/auraui
# o usa git:
ssh usuario@tu-vps
cd /opt
git clone <tu-repo> auraui
cd auraui
```

## Paso 2. (Opcional) Pre-configurar .env.prod
Por defecto AuraUI pide las credenciales de la VPS **en el navegador** (SettingsApp > Conexión VPS).
Esto es lo más normal y versátil: cada cliente mete su propia IP/user/pass/key.

Si quieres FORZAR que TODOS usen siempre la MISMA VPS sin tener que configurar nada:
```bash
cp .env.prod.example .env.prod
# edita .env.prod y rellena VPS_HOST, VPS_PORT, VPS_USER...
```

## Paso 3. Arrancar con Docker Compose
```bash
docker compose up -d --build
```
Esto:
1. Build multi-stage → imagen ~250 MB alpine.
2. Crea y arranca contenedor `auraui-vps-monitor`.
3. Publica `0.0.0.0:50505 -> 50505` (expone el puerto en TODAS las interfaces;
   así puedes usarlo directamente por IP o pasarlo por nginx-proxy-manager).
4. `restart: unless-stopped`: arranca automático al reboot.
5. Healthcheck contra `/api/health` cada 30s.
6. Logs: rotación max 10 MB x 5 ficheros.

### Para publicar solo en loopback (si usas NPM/nginx en el mismo host y NO quieres que sea público por IP):
Edita `docker-compose.yml` y cambia ports:
```yaml
ports:
  - "127.0.0.1:50505:50505"
```

## Paso 4. Conectar con nginx-proxy-manager (tu caso)
Tienes `nginx-proxy-manager` ya corriendo (puerto 80/8080/81). Crea un nuevo **Host**:
- Domain names: quieres. Ej: `panel.midominio.com`
- Scheme: `http`
- Forward Hostname / IP: `auraui-vps-monitor` (si npm está en la misma red)
  o si están en redes distintas, usa la IP del host + puerto expuesto `127.0.0.1:50505`.
- Forward port: `50505`
- ✅ Block Common Exploits
- ✅ Websockets Support (IMPORTANTE para la terminal SSH `ws://` / `wss://`)
- ✅ Cache Assets
- SSL: Let's Encrypt nuevo certificado para el subdominio.

> **Para que el Hostname `auraui-vps-monitor` sea accesible desde npm**, ambos contenedores
> deben estar en la MISMA red Docker. Añade al final de `docker-compose.yml`:
```yaml
networks:
  default:
    external: true
    name: npm_default   # o como se llame la red de tu nginx-proxy-manager
```
(O usa `docker network connect npm_default auraui-vps-monitor` temporalmente.)

## Paso 5. Comandos útiles
```bash
docker compose logs -f --tail=50 auraui     # ver logs en vivo
docker compose restart auraui               # reiniciar
docker compose down                         # parar y borrar contenedor
docker compose build --no-cache             # forzar rebuild limpio
docker compose ps                           # estado + health
```

## Paso 6. Verificar health
```bash
curl http://127.0.0.1:50505/api/health
# {"ok": true, "timestamp":"...", "pid":1}
```

## ¿Y VITE_API_BASE_URL?
Desde **agosto 2025** el valor por defecto es **cadena vacía**: rutas **relativas al mismo host/puerto** que carga la página.
Esto es lo que quieres en producción (Docker + NPM):
- Navegador pide  `/api/metrics`  → pasa por NPM → contenedor Express (mismo origen, SIN CORS)
- Navegador abre `/ws/terminal` → mismo host (WebSocket nativo)

### Cuándo SÍ necesitas rellenar VITE_API_BASE_URL
Solo en el caso **excepcional** de que sirvas el front (`dist/) en un host/puerto DISTINTO al servidor API (CDN externo, S3 static, split deploy).
Para deploy Docker standard MISMO-CONTENEDOR / MISMO-HOST → **NO la definas**, déjala comentada en `.env.example` / `.env.prod`.

### En desarrollo local (`pnpm dev`)
Tampoco necesitas configurarla manualmente: ahora [vite.config.ts](file:///d:/DesarrolloWeb/AuraUI/vite.config.ts#L21-L31) trae un **proxy integrado**
que reenvía `/api → http://localhost:50505` y `/ws → ws://localhost:50505` desde el dev server Vite (:3000).

## Seguridad
- El contenedor NO guarda NINGUNA credencial SSH (no hay base de datos).
- Las credenciales VPS se guardan en **localStorage del cliente** (navegador),
  salvo que explicitamente rellenes `VPS_HOST` etc en `.env.prod` (modo forzado).
- Usa siempre HTTPS delante del panel (Let's Encrypt vía NPM).
- Añade Autenticación HTTP básica / Cloudflare Access si el dominio es público.
