'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, EmptyState, Field, Input, Select } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
import { redactAdminValue, safeAdminHref } from './privacy';

const scopes = ['USER', 'GAME_ACCOUNT', 'MATCH', 'NOTIFICATION', 'WALLET', 'RATING'] as const;
export function AdminSearchForm() {
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [resultScope, setResultScope] = useState<(typeof scopes)[number] | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const scope = String(data.get('scope'));
        const term = String(data.get('term')).trim();
        if (
          term.length < 2 ||
          term.length > 128 ||
          !scopes.includes(scope as (typeof scopes)[number])
        ) {
          setError(true);
          return;
        }
        void (async () => {
          setPending(true);
          setError(false);
          try {
            setResultScope(scope as (typeof scopes)[number]);
            setItems(
              await browserApi(
                `/admin/search?scope=${encodeURIComponent(scope)}&term=${encodeURIComponent(term)}&limit=25`,
              ),
            );
          } catch {
            setError(true);
          } finally {
            setPending(false);
          }
        })();
      }}
    >
      <div className="admin-filter">
        <Field name="scope" label="دامنه">
          <Select id="scope" name="scope">
            {scopes.map((scope) => (
              <option key={scope}>{scope}</option>
            ))}
          </Select>
        </Field>
        <Field name="term" label="عبارت جستجو">
          <Input id="term" name="term" minLength={2} maxLength={128} required />
        </Field>
        <Button disabled={pending}>{pending ? 'در حال جستجو…' : 'جستجو'}</Button>
      </div>
      {error ? <Alert error>جستجو انجام نشد؛ ورودی یا دسترسی را بررسی کنید.</Alert> : null}
      {items?.length === 0 ? <EmptyState title="نتیجه‌ای یافت نشد" /> : null}
      {items?.map((item, index) => {
        const safe = redactAdminValue(item) as Record<string, unknown>;
        const id = typeof safe.id === 'string' ? safe.id : null;
        const referenceId =
          resultScope === 'MATCH'
            ? id
            : typeof safe.userId === 'string'
              ? safe.userId
              : resultScope === 'USER'
                ? id
                : null;
        const href = referenceId
          ? safeAdminHref(resultScope === 'MATCH' ? 'match' : 'user', referenceId)
          : null;
        return (
          <section className="card" key={id ?? index}>
            <pre className="admin-json ltr">{JSON.stringify(safe, null, 2)}</pre>
            {href ? <Link href={href}>بازکردن Timeline</Link> : null}
          </section>
        );
      })}
    </form>
  );
}
