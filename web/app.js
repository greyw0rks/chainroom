let current, busy = false;
const retryModels = new Map();
const $ = id => document.getElementById(id);
const phrases = { missing_proposal: 'Waiting for Engineer proposal', missing_review: 'Waiting for Sentinel review',
  missing_human_decision: 'Independent review passed. Human decision required.', human_decision_required: 'Independent review passed. Human decision required.',
  human_rejected: 'The human rejected this commit.', waiting_for_proposed_commit: 'Waiting for a proposed Git commit.',
  waiting_for_report: 'Waiting for a human report.', waiting_for_proposal: 'Waiting for Engineer evidence.' };
async function refresh() {
  if (busy) return;
  try {
    const response = await fetch('/api/state'); const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    current = data;
    $('connection').textContent = '● Live · Switch';
    $('timestamp').textContent = `Checked ${new Date(data.checked_at).toLocaleTimeString()}${data.has_more ? ' · Recent messages; full approval history is checked separately.' : ''}`;
    $('gate').textContent = data.gate.allowed ? 'Approved commit is eligible for the publication command.' : phrases[data.gate.reason] ?? data.gate.reason.replaceAll('_', ' ');
    $('status').textContent = data.gate.allowed ? 'APPROVED' : data.review?.review_ready ? 'AWAITING APPROVAL' : data.report ? 'IN PROGRESS' : 'REPORTED';
    const actions = $('retry-actions'); actions.replaceChildren();
    const failed = data.retries?.filter(turn => turn.retryable) ?? [];
    $('retry-status').textContent = failed.length ? 'Retry a failed turn using the same session and incident thread.' : data.retries?.some(turn => turn.busy) ? 'Agents are working. Retry becomes available if a turn fails.' : 'No failed turn needs a retry.';
    for (const turn of failed) {
      const label = document.createElement('label'), select = document.createElement('select');
      label.textContent = `Model for ${turn.role} `;
      select.setAttribute('aria-label', `Model for ${turn.role}`);
      const same = document.createElement('option'); same.value = ''; same.textContent = 'Keep current model'; select.append(same);
      for (const model of data.provider_models ?? []) {
        const option = document.createElement('option'); option.value = model; option.textContent = model; select.append(option);
      }
      select.value = retryModels.get(turn.role) ?? '';
      select.addEventListener('change', () => retryModels.set(turn.role, select.value));
      label.append(select);
      const button = document.createElement('button');
      button.textContent = `Retry ${turn.role[0].toUpperCase() + turn.role.slice(1)}`;
      button.addEventListener('click', () => retry(turn, button, select));
      actions.append(label, button);
    }
    const timeline = $('timeline'); timeline.replaceChildren();
    for (const m of data.messages) {
      const article = document.createElement('article'), header = document.createElement('header');
      const author = document.createElement('strong'), time = document.createElement('time'), body = document.createElement('p');
      author.textContent = m.sender.name; time.textContent = `${m.source} · ${new Date(m.sentAt).toLocaleTimeString()}`; body.textContent = m.body;
      if (m.body.startsWith('CHAINROOM_')) body.className = 'evidence';
      header.append(author, time); article.append(header, body); timeline.append(article);
    }
    $('review').hidden = !data.review?.review_ready;
    $('diff-panel').hidden = !data.diff;
    $('diff').textContent = data.diff;
    if (data.review?.review_ready) {
      $('sha').textContent = data.review.commit_sha;
      $('viewer').textContent = `Your decision will be recorded in the incident thread as ${data.viewer}, your authenticated Gateway account.`;
      $('approve').disabled = data.gate.allowed;
    }
  } catch (error) { $('connection').textContent = '● Disconnected'; $('gate').textContent = error.message; $('review').hidden = true; }
}
async function retry(turn, button, select) {
  busy = true; button.disabled = true; select.disabled = true;
  const requestId = crypto.randomUUID();
  try {
    const response = await fetch('/api/retry', { method: 'POST', headers: { 'content-type': 'application/json', 'x-chainroom-csrf': current.csrf },
      body: JSON.stringify({ role: turn.role, message_id: turn.message_id, thread: current.thread_id, request_id: requestId, model: select.value }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? result.receipt?.message);
    if (!['accepted', 'applied'].includes(result.receipt?.status)) throw new Error('The session host did not confirm Retry.');
    $('retry-result').textContent = 'Retry accepted. The agent is continuing the failed turn.';
  } catch (error) { $('retry-result').textContent = error.message; }
  finally { busy = false; await refresh(); }
}
async function decide(decision) {
  const sha = current?.review?.commit_sha; if (!sha) return;
  const reason = decision === 'REJECT' ? prompt('Reason for rejecting this commit:') : undefined;
  if (decision === 'REJECT' && !reason) return;
  busy = true; $('approve').disabled = true; $('reject').disabled = true;
  try {
    const response = await fetch('/api/decision', { method: 'POST', headers: { 'content-type': 'application/json', 'x-chainroom-csrf': current.csrf },
      body: JSON.stringify({ decision, sha, thread: current.thread_id, reason }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    $('decision-result').textContent = `${decision === 'APPROVE' ? 'Approval' : 'Rejection'} recorded in Switch.`;
  } catch (error) { $('decision-result').textContent = error.message; }
  finally { busy = false; $('reject').disabled = false; await refresh(); }
}
$('approve').addEventListener('click', () => decide('APPROVE'));
$('reject').addEventListener('click', () => decide('REJECT'));
refresh(); setInterval(refresh, 5000);
