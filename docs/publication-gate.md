# Publication eligibility

`npm run inspect:publication -- CR-001 <room ID> <thread ID>` checks the proposed `chainroom/cr-001` branch against authenticated Switch history. It never pushes, creates a PR, merges or deploys. `node scripts/publish-pr.mjs CR-001 <room ID> <thread ID> <owner/demo-repository>` implements the publication step. A live successful review, human decision and GitHub publication remain pending.

The inspector resolves Engineer and Sentinel identities from Switch's room membership and accepts human decisions only from the authenticated builder. For Mattermost channel rooms it reads every room-history page, filters the original thread, and rechecks the latest sequence to detect decisions arriving during pagination. Switch 0.31's dedicated thread endpoint is gated to group chats. Local JSON exports cannot authorize publication.

Each role posts its test evidence as a separate message in the original incident thread. The entire message is the prefix `CHAINROOM_TEST`, a newline, and a JSON object with these fields:

```json
{
  "incident": "CR-001",
  "base_sha": "<full base commit SHA>",
  "commit_sha": "<full proposed commit SHA>",
  "command": "npm test",
  "cwd": "<absolute path to this role's own snapshot>",
  "exit_code": 0,
  "stdout": "<actual command output>",
  "stderr": "<actual command error output>",
  "timestamp": "<actual ISO timestamp>"
}
```

This is a schema example, not execution evidence. Both Engineer and Sentinel must independently post records for `npm test` and `git diff --check`. Include genuine failing baseline output separately. Never convert an unsuccessful or unavailable check into a zero exit code.

After its successful checks, Engineer posts `CHAINROOM_PROPOSAL`, a newline, and JSON containing `incident`, `base_sha`, `commit_sha`, and `evidence_message_ids` referencing its two actual Switch test messages. It may explain its diff and findings in separate messages.

After the proposal and its own checks, Sentinel posts `CHAINROOM_REVIEW`, a newline, and JSON containing `incident`, `commit_sha`, `verdict` (`PASS`, `FAIL` or `BLOCKED`), `findings`, and `evidence_message_ids` referencing its own two actual Switch test messages. A subsequent review or proposal invalidates an earlier decision as appropriate.

The builder then posts exactly `APPROVE CR-001 <full SHA>` or `REJECT CR-001 <full SHA> <reason>`. Agent messages, quoted approval commands, approvals before review, and decisions for an older commit do not pass. The last authorized decision for the incident wins.

The Git checks require the same branch commit, an ancestral base matching the clean demo baseline, a clean Engineer worktree, and a nonempty patch limited to added or modified source files under `src/`. The Engineer's snapshot is resolved from its authenticated proposal/test messages and may belong to an isolated clone. The proposed branch must be `chainroom/cr-001` at that exact SHA; the baseline repository is preserved. Deleting source or changing tests, dependencies, or scripts is refused. Each evidence directory is resolved physically, must be under its role's workspace, and must remain a clean snapshot at the exact proposed commit. This check does not establish an operating-system sandbox or prove historical command execution independently of the reporting agents.

The saved `.runtime/evidence/publication-eligibility.json` is a timestamped inspection result. The publisher rereads Switch history and rechecks the Git snapshot at each publication boundary, binds publication to incident/SHA, and checks for an existing PR before creating one. It pushes the exact commit and refuses to overwrite a different remote revision. This inspector alone does not enforce publication-time checks. A real human decision and PR remain required for the end-to-end milestone.

Automated validation covers approval identity, quoting, incident/thread/room binding, stale revisions, missing or failed tests/reviews, reused evidence, shared workspaces, later rejection, duplicate messages, complete pagination, changing history, and unsupported server responses. Run `npm test` from the Chainroom root. These tests use labeled fixtures and do not establish a live workflow.
