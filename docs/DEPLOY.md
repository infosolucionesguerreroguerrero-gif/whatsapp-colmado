# Manual de despliegue (producción)

## Recomendaciones generales

- Node.js LTS (>=18) en el servidor.
- SQL Server accesible (red/firewall) desde el servidor de la app.
- HTTPS obligatorio si se usa WhatsApp Cloud API (el webhook requiere TLS).
- Variables sensibles (`JWT_SECRET`, tokens, password de BD) en gestor de
  secretos o variables de entorno del SO, **nunca** en el repositorio.

## Variables de producción mínimas

```env
NODE_ENV=production
PORT=3000
WS_PORT=3001
JWT_SECRET=<secreto-fuerte-aleatorio>
DB_DRIVER=mssql
DB_HOST=...
DB_NAME=ColmadoDB
DB_USER=...
DB_PASSWORD=...
DB_ENCRYPT=true
WHATSAPP_PROVIDER=cloud   # o baileys
PRINTER_DRIVER=network
```

## Opción A — PM2

```bash
npm ci --omit=dev
npm install @whiskeysockets/baileys openai   # si aplican
npm i -g pm2
pm2 start src/index.js --name whatsapp-colmado
pm2 save && pm2 startup
```

## Opción B — Docker

`Dockerfile` sugerido:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000 3001
CMD ["node", "src/index.js"]
```

```bash
docker build -t whatsapp-colmado .
docker run -d --env-file .env -p 3000:3000 -p 3001:3001 \
  -v $(pwd)/auth_info_baileys:/app/auth_info_baileys \
  -v $(pwd)/tickets:/app/tickets \
  --name colmado whatsapp-colmado
```

> Monta volúmenes para la sesión de Baileys y los tickets para que persistan.

## Reverse proxy (Nginx) + HTTPS

```nginx
server {
  server_name colmado.midominio.com;
  location /api/ { proxy_pass http://127.0.0.1:3000; }
  location /ws/  { proxy_pass http://127.0.0.1:3001; proxy_http_version 1.1;
                   proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
}
```

Usa Certbot/Let's Encrypt para el certificado TLS.

## Base de datos

1. Crear la BD con `npm run db:setup` (o los scripts de `sql/`).
2. Programar backups (`BACKUP DATABASE ColmadoDB ...`).
3. Crear un usuario de aplicación con permisos mínimos (no usar `sa`).

## Checklist de seguridad

- [ ] `JWT_SECRET` fuerte y único.
- [ ] Usuario de BD con permisos mínimos; `DB_ENCRYPT=true`.
- [ ] Rate limiting ajustado (`RATE_LIMIT_*`).
- [ ] HTTPS + verify token del webhook.
- [ ] Logs centralizados y rotación.
- [ ] No commitear `.env`, `auth_info_baileys/`, ni `tickets/`.

## Monitoreo

- `GET /api/health` para health checks del balanceador.
- Logs estructurados (pino). En producción se emite JSON (sin pino-pretty).
- WebSocket `ws://host:3001` para el panel de caja en vivo.
