# AuditAvto VPS deployment runbook

This runbook fixes the stable production deployment path for the AuditAvto VPS.

Production project path:

```bash
/opt/auditappmini
```

## Main Deploy Command

Use the server deploy script as the default and preferred path:

```bash
cd /opt/auditappmini
./scripts/deploy-from-master.sh
```

Do not replace this with ad-hoc PM2 commands during a normal release. The deploy
script is the production entrypoint that keeps the backend, web build and PM2
process shape aligned.

## Expected Healthy State

After a successful deploy:

```txt
audit-backend online
audit-web online
backend listens on 3001
web listens on 127.0.0.1:3002
https://auditavto.ru returns 200 OK
https://auditavto.ru/dashboard returns 200 OK
https://auditavto.ru/demo returns 200 OK
https://api.auditavto.ru/api/health/ready returns ready:true
```

PM2 autostart should be enabled through `pm2-root`, and the process list should
be saved after process changes:

```bash
pm2 save
```

## 502 Bad Gateway Diagnostics

In the current infrastructure, `502 Bad Gateway` usually means nginx is running
but cannot reach the Next.js web process on `127.0.0.1:3002`.

Run:

```bash
pm2 status
ss -lntp | grep -E ':3001|:3002' || true
pm2 logs audit-web --lines 100 --nostream
```

Normal state:

```txt
audit-backend online
audit-web online
3001 is listening
3002 is listening
```

If `audit-web` is missing, errored, or port `3002` is not listening, redeploy
with the main deploy command:

```bash
cd /opt/auditappmini
./scripts/deploy-from-master.sh
```

If a manual process repair is required, use the PM2 ecosystem file:

```bash
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save
```

## PM2 Web Process Rule

Do not run production web with:

```bash
pm2 start npm --name audit-web -- start
```

The production web process must run Next.js directly:

```txt
cwd: /opt/auditappmini/web
script: ./node_modules/next/dist/bin/next
args: start -p 3002 -H 127.0.0.1
```

The template [`scripts/templates/ecosystem.config.vps.cjs`](../scripts/templates/ecosystem.config.vps.cjs)
shows the intended shape. On the production VPS, `ecosystem.config.cjs` may be a
server-local file and does not have to be committed if it contains absolute
server paths such as `/opt/auditappmini`.

## Next.js Server Actions Key

The VPS must have a stable Server Actions encryption key in:

```bash
web/.env.production
```

Required variable:

```env
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=
```

If this key is absent or changes unexpectedly between deployments, users may see
errors like:

```txt
Failed to find Server Action.
This request might be from an older or newer deployment.
```

Keep the key stable for the deployed web service. Do not commit the real value.

## Post-Deploy Checks

Use these checks after deploy or process repair:

```bash
pm2 status
ss -lntp | grep -E ':3001|:3002' || true
curl -I https://auditavto.ru
curl -I https://auditavto.ru/dashboard
curl -I https://auditavto.ru/demo
curl https://api.auditavto.ru/api/health/ready
git status --short
```

The working tree on the VPS should remain clean after deploy.
