'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Select, Textarea } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
export function DisputeForm({ matchId, disputeId }: { matchId: string; disputeId?: string }) {
  const ui = useUiMessages();
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      if (disputeId)
        await browserApi(`/matches/${matchId}/disputes/${disputeId}/respond`, {
          method: 'POST',
          body: { statement: data.get('statement'), evidenceIds: [] },
        });
      else
        await browserApi(`/matches/${matchId}/disputes`, {
          method: 'POST',
          body: {
            reasonCode: data.get('reasonCode'),
            claim: {
              schemaVersion: 1,
              statement: data.get('statement'),
              requestedOutcome: data.get('requestedOutcome'),
              evidenceIds: [],
            },
          },
        });
      setMessage(ui.requestSubmitted);
    } catch {
      setMessage(ui.couldNotSubmitTheRequest);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      {!disputeId ? (
        <>
          <Select name="reasonCode">
            <option value="SCORE_MISMATCH">{ui.scoreMismatch}</option>
            <option value="WRONG_WINNER">{ui.falseWinner}</option>
            <option value="OPPONENT_NO_SHOW">{ui.absenceOfTheOpponent}</option>
            <option value="RULESET_VIOLATION">{ui.violationOfTheRules}</option>
            <option value="OTHER">{ui.other}</option>
          </Select>
          <Select name="requestedOutcome">
            <option value="KEEP_CURRENT_RESULT">{ui.saveTheResult}</option>
            <option value="CORRECT_SCORE">{ui.scoreModification}</option>
            <option value="VOID_MATCH">{ui.cancellationOfTheMatch}</option>
          </Select>
        </>
      ) : null}
      <Textarea name="statement" minLength={1} maxLength={2000} required />
      {message ? <Alert>{message}</Alert> : null}
      <Button>{ui.postAReply}</Button>
    </form>
  );
}
