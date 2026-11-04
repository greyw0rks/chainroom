# Resume Chainroom

Project root: /home/greyw0rks/chainroom. November 4, 2026: Switch 0.31.0, Gateway and Mattermost are healthy. The signed controller is enrolled and online. The real Mattermost connection report received a Codex classification, and the three-agent room is provisioned.

Windows browser URLs use numeric loopback addresses:

- Mattermost: http://127.0.0.1:8066
- Gateway: http://127.0.0.1:8082
- Live evidence dashboard: http://127.0.0.1:3018

The loopback browser proxy runs scripts/browser-access.mjs. Container services remain on ports 8065, 8080 and 8000. Builder credentials are in ignored .env; never print them into logs or messages.

## Current incident

CR-001 room: `04784c53-cbba-42c3-8d14-33a8b6978c9f`.
Original human report/thread: `sw_c7eef0cc7bc1315a011120a29f3a032c`.
Triage's Engineer handoff: `sw_a1e7e56673034659b3651156bf8443e5`.
Demo baseline: `c719c0f5d7c56140dd7891f9a1ba63ad6b84d096`.

Earlier provider failures remain in the thread. Engineer's native Retry command `837ce8fa-182f-41c1-839e-48eb74735960` was applied at 20:35 UTC, reusing the handoff message and session. Engineer has resumed inspection in its own workspace. No additional report was posted for that retry. Its shell initially lacked rtk/npm/node in PATH; Engineer is resolving the runtime location and has recorded the environment failures.

Do not manually patch the demo: Engineer must reproduce, fix, test and commit, then Sentinel must independently review that exact commit through Switch. After the full evidence contract passes, ask the human for the exact-SHA decision. No decision, PR or submission is currently recorded.

## Controller and Retry

Run from the project root (prefix commands with /home/greyw0rks/ubuntu-to-debian-migration/bin/rtk proxy on this machine):

```sh
node scripts/run-controller.mjs
```

Keep the controller running. In another terminal:

```sh
npm run dashboard
node scripts/check-workflow.mjs
npm run retry
```

The dashboard offers Retry only for the latest failed or interrupted incident turn while the session is idle. It sends the native message.retry contract, preserving the original message/thread. Each request has an idempotency ID. Optional model selection sends native session.model.set before retrying. Available choices are the builder-confirmed gpt-6.1-sol, gpt-6-astra, and gpt-5.6-sol; keeping the current model is the default.

CLI equivalents:

```sh
npm run retry -- engineer
npm run retry -- engineer gpt-6-astra
```

The private session-host adapter uses a mode-0600 Unix socket and leaves the signed controller package unchanged. Its socket name uses 32 hash characters to fit Linux's 107-byte pathname limit. A cold session is warmed through Switch before retrying.

The selected credential is read from /home/greyw0rks/keys.txt, referenced by ignored .runtime/provider-key-source.json (index 1). The controller retains the existing AgentRouter URL and Responses API configuration in its separate .runtime/codex-provider home. The global Codex configuration and history are preserved. The diagnostic relay and fresh-conversation recovery flags are currently absent; do not reintroduce them without evidence they are needed.

## Verified and remaining work

All 59 automated checks pass, including publication failure cases, retry state, actual Unix-socket/IPC forwarding, model selection and duplicate-request handling. The live browser check passes on desktop/mobile and refuses unauthenticated state reads and decisions without origin/CSRF verification. .runtime/evidence stores live stack, connection and workflow exports and dashboard screenshots; these exports cannot authorize publication.

Remaining: Engineer baseline/patch/test records, Sentinel's independent exact-SHA review, human decision, live publication inspection and real GitHub PR, public project repository and actual demonstration video. Both local repositories currently have no GitHub remote. Publication target/access must be configured before publishing.

The current long-running tool sessions are controller 12629 and dashboard 24259; browser proxy from the preceding session is still running. Inspect existing processes before starting another listener.

## Independent review ready

Engineer completed the native retried turn and proposed commit 4972a245fefdb72792c42eb833b813136b8e3cfa in its own clone/worktree. Sentinel independently passed all six tests, whitespace checks, 666 balance cases across decimals 0..36, 83 invalid-input rejection cases and four explicit boundary/regression assertions. Review message: sw_2aea55b06e194e17a3336d7b0f2e236b. Live publication inspection resolves the physical snapshots and reports review_ready=true / human_decision_required. The browser verified the reviewed SHA, actual diff and approval controls without posting a decision.

The human should review http://127.0.0.1:3018 and click Approve this commit (or reject). The gate requires a decision on the exact reviewed SHA. The formatter fix changes only src/balance.ts. Nonblocking limitation: extra boundary probes are outside the committed demo suite; production integration was not tested. No public repositories or PR have been created.
