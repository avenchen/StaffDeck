# Skill Agent Loop Service

End-to-end MVP for an enterprise Skill Agent Loop service.

## Projects

- `backend`: FastAPI service with skill runtime, model config, tool execution, chat API, and trace APIs.
- `frontend-enterprise`: React/Vite enterprise console for skills, models, tools, and persona configuration.
- `frontend-chat`: React/Vite user chat client.
- `docs`: API and schema notes.

## Quick Start

Use the root dev scripts to run all three services. `scripts/dev_up.sh` starts a
foreground supervisor, writes real process IDs under `.dev/`, and writes logs
under `.dev/logs/`.

```bash
scripts/dev_up.sh
```

Leave that terminal open while developing. To start in the background from a
normal shell, use:

```bash
DETACH=1 scripts/dev_up.sh
```

Stop or inspect the services:

```bash
scripts/dev_status.sh
scripts/dev_down.sh
```

Default URLs:

- backend: `http://127.0.0.1:8000/docs`
- enterprise: `http://127.0.0.1:5173/enterprise/dashboard`
- chat: `http://127.0.0.1:5174/chat`

For public tunnel testing, pass the public backend URL to the frontends and the
public frontend origins to the backend:

```bash
VITE_API_BASE_URL="http://<public-host>:<backend-port>" \
PUBLIC_ENTERPRISE_ORIGIN="http://<public-host>:<enterprise-port>" \
PUBLIC_CHAT_ORIGIN="http://<public-host>:<chat-port>" \
scripts/dev_up.sh
```

For one-port tunnel testing, build both frontends and let the backend serve
the static bundles and API on the same origin:

```bash
npm run build --prefix frontend-enterprise
npm run build --prefix frontend-chat
cd backend
uvicorn single_port_app:app --host 0.0.0.0 --port 8888
```

Then open `/enterprise/dashboard` or `/chat` on that single public origin. This
avoids browsers rewriting frontend requests to `127.0.0.1` on external clients.

Set `DEMO_MODEL_API_KEY` in `backend/.env` before first startup if you want to seed the demo OpenAI-compatible model config. The key is encrypted before it is stored in the database and is never committed.

## Manual Starts

Manual starts are still supported for single-service debugging:

```bash
cd backend
uvicorn app.main:app --reload

cd frontend-enterprise
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev

cd frontend-chat
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```
