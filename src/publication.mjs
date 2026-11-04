export async function publishReviewedPatch({ inspect, remoteHead, existingPr, push, createPr }) {
  const initial = await inspect();
  if (!initial.allowed) throw new Error(`Publication refused: ${initial.reason}`);
  const ensureCurrent = async () => {
    const current = await inspect();
    if (!current.allowed) throw new Error(`Publication refused: ${current.reason}`);
    for (const key of ['incident', 'commit_sha', 'base_sha', 'decision_message_id', 'review_message_id', 'human_actor']) {
      if (current[key] !== initial[key]) throw new Error('Publication refused: approval changed during publication.');
    }
  };
  const matchingPr = async () => {
    const pr = await existingPr();
    if (!pr) return null;
    if (pr.head_sha !== initial.commit_sha || pr.incident !== initial.incident || pr.base_sha !== initial.base_sha) {
      throw new Error('Publication refused: the existing pull request does not match the approved patch.');
    }
    return pr;
  };
  const existing = await matchingPr();
  if (existing) { await ensureCurrent(); return { ...existing, reused: true }; }
  const head = await remoteHead();
  if (head && head !== initial.commit_sha) throw new Error('Publication refused: the remote branch contains another commit.');
  await ensureCurrent();
  if (!head) await push(initial.commit_sha);
  await ensureCurrent();
  const concurrent = await matchingPr();
  if (concurrent) return { ...concurrent, reused: true };
  return { ...await createPr(initial), reused: false };
}
