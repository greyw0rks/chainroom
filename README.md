# Chainroom

An engineering incident room where three Codex agents coordinate through Switch and Mattermost to reproduce a bug, propose a tested fix, independently review it and request a human decision.

Solo build for Flip the Switch's Best Business Workflow track. The initial fixture is an intentionally introduced USDC-decimals regression; this project does not claim a real customer incident.

The [implementation blueprint](docs/implementation-blueprint.md) covers architecture, agent contracts, approval rules, build gates and first commands. The [Switch template](templates/chainroom.template.yaml) creates Triage, Engineer, Sentinel and a private Mattermost-backed room. The [demo repository](demo/README.md) has real TypeScript code and executable failing tests.

```sh
node scripts/bootstrap.mjs
node scripts/install-controller.mjs
node scripts/prepare-demo.mjs
docker compose --project-name chainroom --env-file .env \
  -f .tools/switch-compose.yml -f deploy/chainroom.override.yml \
  --profile collab --profile gateway up -d
```

Gateway: http://localhost:8080. Mattermost: http://localhost:8065. Local credentials are generated in ignored `.env`. Read the blueprint for controller enrollment and template import.

MVP is complete only after a real Mattermost report becomes an independently verified GitHub PR with a human decision. See [build status](docs/build-status.md) for what has actually been verified.
