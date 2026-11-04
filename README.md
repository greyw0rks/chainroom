# Chainroom

An engineering incident room where three Codex agents coordinate through Switch and Mattermost to reproduce a bug, propose a tested fix, independently review it and request a human decision.

Solo build for Flip the Switch's Best Business Workflow track. The initial fixture is an intentionally introduced USDC-decimals regression; this project does not claim a real customer incident.

The first live incident completed the report → Triage → Engineer → Sentinel → human approval → PR workflow. [Demo PR #1](https://github.com/greyw0rks/chainroom-demo/pull/1) contains the exact reviewed commit `4972a245fefdb72792c42eb833b813136b8e3cfa`; the demo's main branch preserves the failing baseline. Both roles passed all six tests independently, and Sentinel also passed 666 balance cases across decimals 0–36. Chainroom's 59 automated checks pass. See the [live milestone record](docs/live-milestone.md) for evidence and limits.

The [implementation blueprint](docs/implementation-blueprint.md) covers architecture, agent contracts, approval rules, build gates and first commands. The [Switch template](templates/chainroom.template.yaml) creates Triage, Engineer, Sentinel and a private Mattermost-backed room. The [demo repository](demo/README.md) has real TypeScript code and executable failing tests.

```sh
node scripts/bootstrap.mjs
node scripts/install-controller.mjs
node scripts/prepare-demo.mjs
docker compose --project-name chainroom --env-file .env \
  -f .tools/switch-compose.yml -f deploy/chainroom.override.yml \
  --profile collab --profile gateway up -d
```

Windows browser access on this machine: Gateway http://127.0.0.1:8082 and Mattermost http://127.0.0.1:8066. Use the numeric addresses. The container services remain on loopback ports 8080 and 8065. Local credentials are generated in ignored `.env`. Read the blueprint for controller enrollment and template import.

Run `npm run check:stack` before enrollment. It checks Switch readiness, the Gateway page and Mattermost's ping endpoint, saves a timestamped result to `.runtime/evidence/stack-health.json`, and exits unsuccessfully while any service is unavailable.

The [publication eligibility inspector](docs/publication-gate.md) checks authenticated authors, independent evidence, human approval and the proposed Git commit. The publication command repeats these checks before pushing the exact commit and opening a PR. Run its automated failure cases with `npm test`. The first live publication passed these checks; each future publication needs its own current review and approval.

Start the local evidence dashboard with `npm run dashboard`, then open http://127.0.0.1:3018. It shows live Switch history, failed-turn Retry and reviewed-commit decisions. Retry sends the controller's native `message.retry` command for the original message, preserving the incident thread. Choose the current model or one of `gpt-6.1-sol`, `gpt-6-astra`, and `gpt-5.6-sol`. Running and completed turns cannot be retried. The CLI equivalent is `npm run retry -- engineer` or `npm run retry -- engineer gpt-6-astra`.

The controller retains the existing Codex provider URL and auth configuration. Its private key selection references `/home/greyw0rks/keys.txt` through ignored `.runtime/provider-key-source.json`; keys never enter the dashboard or Switch messages. Run the controller through `node scripts/run-controller.mjs` to enable the local Retry adapter. See [resume instructions](docs/RESUME.md) for the current workflow.

MVP is complete only after a real Mattermost report becomes an independently verified GitHub PR with a human decision. See [build status](docs/build-status.md) for what has actually been verified.
