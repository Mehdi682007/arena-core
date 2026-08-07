'use client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Select, Textarea } from '@/components/ui';
import type { AppLocale } from '@/i18n/config';
import { browserApi } from '@/lib/api/browser-api-client';
import { competitionMessagesFor } from './messages';

export function DisputeForm({
  matchId,
  disputeId,
  locale,
}: {
  matchId: string;
  disputeId?: string;
  locale: AppLocale;
}) {
  const messages = competitionMessagesFor(locale).dispute;
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
      setMessage(messages.submitted);
    } catch {
      setMessage(messages.failed);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      {!disputeId ? (
        <>
          <Select name="reasonCode">
            <option value="SCORE_MISMATCH">{messages.scoreMismatch}</option>
            <option value="WRONG_WINNER">{messages.wrongWinner}</option>
            <option value="OPPONENT_NO_SHOW">{messages.opponentNoShow}</option>
            <option value="RULESET_VIOLATION">{messages.rulesetViolation}</option>
            <option value="OTHER">{messages.other}</option>
          </Select>
          <Select name="requestedOutcome">
            <option value="KEEP_CURRENT_RESULT">{messages.keepResult}</option>
            <option value="CORRECT_SCORE">{messages.correctScore}</option>
            <option value="VOID_MATCH">{messages.voidMatch}</option>
          </Select>
        </>
      ) : null}
      <Field name="statement" label={messages.statement}>
        <Textarea name="statement" minLength={1} maxLength={2000} required />
      </Field>
      {message ? <Alert>{message}</Alert> : null}
      <Button>{disputeId ? messages.respond : messages.open}</Button>
    </form>
  );
}
