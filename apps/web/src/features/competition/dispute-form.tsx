'use client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Select, Textarea } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
export function DisputeForm({ matchId, disputeId }: { matchId: string; disputeId?: string }) {
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
      setMessage('درخواست ثبت شد.');
    } catch {
      setMessage('ثبت درخواست ممکن نشد.');
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      {!disputeId ? (
        <>
          <Select name="reasonCode">
            <option value="SCORE_MISMATCH">عدم تطابق امتیاز</option>
            <option value="WRONG_WINNER">برنده نادرست</option>
            <option value="OPPONENT_NO_SHOW">عدم حضور حریف</option>
            <option value="RULESET_VIOLATION">نقض قوانین</option>
            <option value="OTHER">سایر</option>
          </Select>
          <Select name="requestedOutcome">
            <option value="KEEP_CURRENT_RESULT">حفظ نتیجه</option>
            <option value="CORRECT_SCORE">اصلاح امتیاز</option>
            <option value="VOID_MATCH">باطل‌کردن مسابقه</option>
          </Select>
        </>
      ) : null}
      <Textarea name="statement" minLength={1} maxLength={2000} required />
      {message ? <Alert>{message}</Alert> : null}
      <Button>{disputeId ? 'ارسال پاسخ' : 'بازکردن اعتراض'}</Button>
    </form>
  );
}
