# Result Verification

FC26 MVP uses dual submission plus screenshot evidence.

Each participant submits structured home/away scores, claimed winner, optional note, and evidence references before the deadline. The API validates the submission against the immutable rule-set version and participant perspective.

- Equivalent submissions: outcome becomes verified automatically.
- Conflicting submissions: create a dispute exactly once.
- Missing submission: apply the configured no-show/timeout policy or route to review.
- Replacement before deadline: retain revision history; never overwrite evidence auditability.

Evidence is private, content-type/size constrained, malware-scanned through an abstraction, stored with generated object keys, and accessed with short-lived signed URLs after authorization. Retention and deletion are policy-driven.
