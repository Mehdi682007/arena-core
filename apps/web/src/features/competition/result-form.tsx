'use client';
import { useUiMessages } from '@/i18n/ui-messages-client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
export function ResultForm({ matchId }: { matchId: string }) {
  const ui = useUiMessages();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const own = Number(data.get('ownScore'));
    const opponent = Number(data.get('opponentScore'));
    setPending(true);
    setMessage('');
    try {
      await browserApi(`/matches/${matchId}/result-submissions`, {
        method: 'POST',
        body: {
          result: {
            schemaVersion: 1,
            type: 'SCORE',
            scores: [
              { side: data.get('ownSide'), score: own },
              { side: data.get('ownSide') === 'SIDE_A' ? 'SIDE_B' : 'SIDE_A', score: opponent },
            ],
            outcome: own === opponent ? 'DRAW' : 'WIN_LOSS',
          },
        },
      });
      setMessage(ui.resultSubmittedTheFinalResultAppearsOnly);
    } catch {
      setMessage(ui.couldNotSubmitTheResult);
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Field name="ownSide" label={ui.yourSide}>
        <Select id="ownSide" name="ownSide">
          <option value="SIDE_A">{ui.sideA}</option>
          <option value="SIDE_B">{ui.bSide}</option>
        </Select>
      </Field>
      <Field name="ownScore" label={ui.yourScore}>
        <Input id="ownScore" name="ownScore" type="number" min={0} max={99} required />
      </Field>
      <Field name="opponentScore" label={ui.opponentSScore}>
        <Input id="opponentScore" name="opponentScore" type="number" min={0} max={99} required />
      </Field>
      {message ? <Alert>{message}</Alert> : null}
      <Button disabled={pending}>{ui.registering}</Button>
    </form>
  );
}
export function EvidenceForm({ matchId }: { matchId: string }) {
  const ui = useUiMessages();
  const [message, setMessage] = useState('');
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void browserApi(`/matches/${matchId}/evidence`, {
          method: 'POST',
          body: {
            evidence: {
              schemaVersion: 1,
              type: data.get('type'),
              description: data.get('description'),
            },
          },
        })
          .then(() => setMessage(ui.evidenceDeclarationSubmitted))
          .catch(() => setMessage(ui.couldNotSubmitTheEvidenceDeclaration));
      }}
    >
      <h2>{ui.statementOfEvidence}</h2>
      <p className="muted">{ui.fileUploadIsNotDoneOnlyThe}</p>
      <Select name="type">
        <option value="SCREENSHOT_DECLARATION">{ui.image}</option>
        <option value="VIDEO_DECLARATION">{ui.video}</option>
        <option value="MATCH_SUMMARY_DECLARATION">{ui.summaryOfTheMatch}</option>
        <option value="TEXT_STATEMENT">{ui.textStatement}</option>
      </Select>
      <Textarea name="description" maxLength={2000} required />
      {message ? <Alert>{message}</Alert> : null}
      <Button>{ui.recordStatement}</Button>
    </form>
  );
}
