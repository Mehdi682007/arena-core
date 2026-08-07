'use client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { browserApi } from '@/lib/api/browser-api-client';
import { competitionMessagesFor } from './messages';

export function ResultForm({ matchId, locale }: { matchId: string; locale: AppLocale }) {
  const messages = competitionMessagesFor(locale).result;
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
      setMessage(messages.submitted);
    } catch {
      setMessage(messages.submitFailed);
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Field name="ownSide" label={messages.ownSide}>
        <Select id="ownSide" name="ownSide">
          <option value="SIDE_A">{messages.sideA}</option>
          <option value="SIDE_B">{messages.sideB}</option>
        </Select>
      </Field>
      <Field name="ownScore" label={messages.ownScore}>
        <Input id="ownScore" name="ownScore" type="number" min={0} max={99} required />
      </Field>
      <Field name="opponentScore" label={messages.opponentScore}>
        <Input id="opponentScore" name="opponentScore" type="number" min={0} max={99} required />
      </Field>
      {message ? <Alert>{message}</Alert> : null}
      <Button disabled={pending}>{pending ? messages.submitting : messages.submit}</Button>
    </form>
  );
}

export function EvidenceForm({ matchId, locale }: { matchId: string; locale: AppLocale }) {
  const messages = competitionMessagesFor(locale).result;
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
          .then(() => setMessage(messages.evidenceSubmitted))
          .catch(() => setMessage(messages.evidenceFailed));
      }}
    >
      <h2>{messages.evidenceTitle}</h2>
      <p className="muted">{messages.evidenceNotice}</p>
      <Select name="type">
        <option value="SCREENSHOT_DECLARATION">{messages.screenshot}</option>
        <option value="VIDEO_DECLARATION">{messages.video}</option>
        <option value="MATCH_SUMMARY_DECLARATION">{messages.matchSummary}</option>
        <option value="TEXT_STATEMENT">{messages.textStatement}</option>
      </Select>
      <Field name="description" label={messages.evidenceDescription}>
        <Textarea name="description" maxLength={2000} required />
      </Field>
      {message ? <Alert>{message}</Alert> : null}
      <Button>{messages.submitEvidence}</Button>
    </form>
  );
}
