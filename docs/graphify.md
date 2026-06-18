# Graphify Integration

Graphify is integrated as a project-scoped Codex skill for architecture and
cross-file codebase questions. It is not a runtime dependency of the backend,
web app, or mobile app.

## Installed Pieces

- `.codex/skills/graphify/` contains the project-scoped Graphify skill and
  references.
- `.codex/hooks.json` registers the Graphify Codex hook.
- `AGENTS.md` tells agents to query the knowledge graph for codebase questions
  when `graphify-out/graph.json` exists.
- `graphify-out/` is ignored because it is generated output and can be large.

## Commands

Install or refresh the project integration:

```powershell
uv tool install graphifyy
npm run graphify:install
```

Build the graph:

```powershell
npm run graphify:extract
```

Refresh after code changes:

```powershell
npm run graphify:update
```

Ask a codebase question:

```powershell
npm run graphify:query -- "How does inspection completion validate readiness?"
```

Export a call-flow architecture page:

```powershell
npm run graphify:callflow
```

## Notes

- The official PyPI package is `graphifyy`; the CLI command is `graphify`.
- Some extraction modes may require an LLM backend/API key. If no backend is
  configured, keep the integration committed and build the graph in the
  operator environment that has the required credentials.
- Do not commit `graphify-out/`, API keys, or generated local graph artifacts.
