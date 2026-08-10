'use client';

import { useUiFormatters, useUiMessages } from '../../i18n/ui-messages-client';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}

export function IconButton({
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className="button secondary" aria-label={label} title={label} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="password" autoComplete="current-password" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input" {...props} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" {...props} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return <label htmlFor={htmlFor}>{children}</label>;
}

export function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <FormError id={`${name}-error`}>{error}</FormError> : null}
    </div>
  );
}

export function FormError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="error">
      {children}
    </p>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Alert({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div role={error ? 'alert' : 'status'} className={`alert ${error ? 'error' : ''}`}>
      {children}
    </div>
  );
}

export function Spinner() {
  const ui = useUiMessages();
  return <span>{ui.loading}</span>;
}

export function Skeleton() {
  return <div className="skeleton" />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function ErrorState({ requestId }: { requestId?: string | undefined }) {
  const ui = useUiMessages();

  return (
    <div className="error-state">
      <p>{ui.itWasNotPossibleToReceiveInformation}</p>
      {requestId ? (
        <p>
          {ui.trackingId}: {requestId}
        </p>
      ) : null}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  const format = useUiFormatters();

  return (
    <span className="avatar" title={format.avatarLabel(name)}>
      {name.trim().slice(0, 1) || 'A'}
    </span>
  );
}

export function Separator() {
  return <hr />;
}

export function Tabs({ items }: { items: readonly { href: string; label: string }[] }) {
  return (
    <nav>
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function Tooltip({ children }: { label: string; children: ReactNode }) {
  return <>{children}</>;
}

export function Dropdown({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details>
      <summary>{label}</summary>
      {children}
    </details>
  );
}
