'use client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
export function ResultForm({ matchId }: { matchId: string }) {
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
      setMessage('نتیجه ثبت شد. نتیجه نهایی فقط پس از تأیید سرور نمایش داده می‌شود.');
    } catch {
      setMessage('ثبت نتیجه ممکن نشد.');
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <Field name="ownSide" label="سمت شما">
        <Select id="ownSide" name="ownSide">
          <option value="SIDE_A">سمت A</option>
          <option value="SIDE_B">سمت B</option>
        </Select>
      </Field>
      <Field name="ownScore" label="امتیاز شما">
        <Input id="ownScore" name="ownScore" type="number" min={0} max={99} required />
      </Field>
      <Field name="opponentScore" label="امتیاز حریف">
        <Input id="opponentScore" name="opponentScore" type="number" min={0} max={99} required />
      </Field>
      {message ? <Alert>{message}</Alert> : null}
      <Button disabled={pending}>{pending ? 'در حال ثبت…' : 'ثبت نتیجه'}</Button>
    </form>
  );
}
export function EvidenceForm({ matchId }: { matchId: string }) {
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
          .then(() => setMessage('اظهار مدرک ثبت شد.'))
          .catch(() => setMessage('ثبت اظهار مدرک ممکن نشد.'));
      }}
    >
      <h2>اظهار مدرک</h2>
      <p className="muted">آپلود فایل انجام نمی‌شود؛ فقط وجود و توضیح مدرک اعلام می‌شود.</p>
      <Select name="type">
        <option value="SCREENSHOT_DECLARATION">تصویر</option>
        <option value="VIDEO_DECLARATION">ویدئو</option>
        <option value="MATCH_SUMMARY_DECLARATION">خلاصه مسابقه</option>
        <option value="TEXT_STATEMENT">اظهار متنی</option>
      </Select>
      <Textarea name="description" maxLength={2000} required />
      {message ? <Alert>{message}</Alert> : null}
      <Button>ثبت اظهار</Button>
    </form>
  );
}
