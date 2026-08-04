'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
import type { AdminPermission } from './types';
import type { AdminRole, AdminUserDetail } from './user-access-types';

type ActionState = 'idle' | 'pending' | 'success' | 'error';

const toIsoDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }

  return date.toISOString();
};

export function UserAccessActions({
  user,
  availableRoles,
  permissions,
  preview,
}: {
  user: AdminUserDetail;
  availableRoles: AdminRole[];
  permissions: AdminPermission[];
  preview: boolean;
}) {
  const router = useRouter();
  const statusDialog = useRef<HTMLDialogElement>(null);
  const emailDialog = useRef<HTMLDialogElement>(null);
  const sessionDialog = useRef<HTMLDialogElement>(null);
  const roleDialog = useRef<HTMLDialogElement>(null);

  const [state, setState] = useState<ActionState>('idle');

  const [message, setMessage] = useState<string | null>(null);

  const canManageStatus = permissions.includes('users.manage_status');

  const canVerifyEmail = permissions.includes('users.verify_email');

  const canManageSessions = permissions.includes('users.manage_sessions');

  const canAssignRoles = permissions.includes('roles.assign');

  const execute = async (operation: () => Promise<unknown>, successMessage: string) => {
    if (preview) {
      setState('success');
      setMessage('این عملیات در حالت پیش‌نمایش شبیه‌سازی شد و داده‌ای تغییر نکرد.');
      return;
    }

    setState('pending');
    setMessage(null);

    try {
      await operation();
      setState('success');
      setMessage(successMessage);
      router.refresh();
    } catch {
      setState('error');
      setMessage('عملیات انجام نشد. مجوز، وضعیت حساب و ارتباط با API را بررسی کنید.');
    }
  };

  return (
    <section className="admin-user-actions">
      <div className="admin-section-heading">
        <div>
          <span className="admin-console-eyebrow">Manual operations</span>
          <h2>عملیات دستی مدیر</h2>
        </div>

        <span className="admin-user-security-version">نسخه امنیتی {user.securityVersion}</span>
      </div>

      {message !== null ? <Alert error={state === 'error'}>{message}</Alert> : null}

      <div className="admin-user-action-grid">
        {canManageStatus ? (
          <button
            className="button"
            type="button"
            onClick={() => statusDialog.current?.showModal()}
          >
            تغییر وضعیت حساب
          </button>
        ) : null}

        {canVerifyEmail && user.email !== null ? (
          <button
            className="button secondary"
            type="button"
            disabled={user.emailVerifiedAt !== null || state === 'pending'}
            onClick={() => {
              emailDialog.current?.showModal();
            }}
          >
            {user.emailVerifiedAt === null ? '????? ?????' : '????? ????? ??? ???'}
          </button>
        ) : null}

        {canManageSessions ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => sessionDialog.current?.showModal()}
          >
            بستن همه نشست‌ها
          </button>
        ) : null}

        {canAssignRoles ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => roleDialog.current?.showModal()}
          >
            افزودن نقش
          </button>
        ) : null}
      </div>

      {!canManageStatus && !canVerifyEmail && !canManageSessions && !canAssignRoles ? (
        <p className="muted">این حساب برای شما فقط خواندنی است.</p>
      ) : null}

      <dialog ref={emailDialog} aria-labelledby="user-email-dialog-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const data = new FormData(event.currentTarget);
            const reasonCode = String(data.get('reasonCode')).trim();
            const note = String(data.get('note') ?? '').trim();

            void execute(
              () =>
                browserApi(`/admin/users/${encodeURIComponent(user.id)}/email/verify`, {
                  method: 'POST',
                  body: {
                    reasonCode,
                    ...(note.length > 0 ? { note } : {}),
                  },
                }),
              '????? ????? ?? ?????? ????? ??.',
            );

            emailDialog.current?.close();
          }}
        >
          <h2 id="user-email-dialog-title">????? ???? ?????</h2>

          <p>
            ????? <strong>{user.email ?? '?'}</strong> ??????? ???? ????? ??????. ??? ?????? ??
            ????????? ????? ??? ????? ??.
          </p>

          <label>
            ?? ????
            <input
              name="reasonCode"
              defaultValue="ADMIN_EMAIL_VERIFIED"
              pattern="[A-Z0-9_]+"
              required
              maxLength={64}
            />
          </label>

          <label>
            ????? ????
            <textarea name="note" maxLength={500} placeholder="???? ????? ???? ?? ??? ????." />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              ????? ?????
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => {
                emailDialog.current?.close();
              }}
            >
              ??????
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={statusDialog} aria-labelledby="user-status-dialog-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const data = new FormData(event.currentTarget);
            const status = String(data.get('status'));
            const reasonCode = String(data.get('reasonCode') ?? '').trim();
            const note = String(data.get('note') ?? '').trim();
            const suspendedUntil = String(data.get('suspendedUntil') ?? '').trim();

            const body: Record<string, unknown> = {
              status,
            };

            if (reasonCode.length > 0) {
              body.reasonCode = reasonCode;
            }

            if (note.length > 0) {
              body.note = note;
            }

            if (status === 'SUSPENDED' && suspendedUntil.length > 0) {
              body.suspendedUntil = toIsoDate(suspendedUntil);
            }

            void execute(
              () =>
                browserApi(`/admin/users/${encodeURIComponent(user.id)}/status`, {
                  method: 'PATCH',
                  body,
                }),
              'وضعیت حساب با موفقیت تغییر کرد.',
            );

            statusDialog.current?.close();
          }}
        >
          <h2 id="user-status-dialog-title">تغییر وضعیت حساب</h2>

          <label>
            وضعیت جدید
            <select name="status" defaultValue={user.status} required>
              <option value="ACTIVE">فعال</option>
              <option value="SUSPENDED">تعلیق موقت</option>
              <option value="BANNED">مسدود دائمی</option>
            </select>
          </label>

          <label>
            کد دلیل
            <input
              name="reasonCode"
              placeholder="ADMIN_POLICY_VIOLATION"
              pattern="[A-Z0-9_]+"
              maxLength={64}
            />
          </label>

          <label>
            پایان تعلیق
            <input name="suspendedUntil" type="datetime-local" />
          </label>

          <label>
            توضیح مدیر
            <textarea name="note" maxLength={500} placeholder="دلیل و شواهد لازم را ثبت کنید." />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              تأیید تغییر
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => statusDialog.current?.close()}
            >
              انصراف
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={sessionDialog} aria-labelledby="user-session-dialog-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const data = new FormData(event.currentTarget);
            const reasonCode = String(data.get('reasonCode')).trim();
            const note = String(data.get('note') ?? '').trim();

            void execute(
              () =>
                browserApi(`/admin/users/${encodeURIComponent(user.id)}/sessions/revoke`, {
                  method: 'POST',
                  body: {
                    reasonCode,
                    ...(note.length > 0 ? { note } : {}),
                  },
                }),
              'همه نشست‌های فعال کاربر بسته شدند.',
            );

            sessionDialog.current?.close();
          }}
        >
          <h2 id="user-session-dialog-title">بستن همه نشست‌های فعال</h2>

          <p>این کار تمام دستگاه‌های کاربر را خارج و نسخه امنیتی حساب را افزایش می‌دهد.</p>

          <label>
            کد دلیل
            <input
              name="reasonCode"
              defaultValue="ADMIN_SECURITY_RESET"
              pattern="[A-Z0-9_]+"
              required
              maxLength={64}
            />
          </label>

          <label>
            توضیح
            <textarea name="note" maxLength={500} />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              بستن نشست‌ها
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => sessionDialog.current?.close()}
            >
              انصراف
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={roleDialog} aria-labelledby="user-role-dialog-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const data = new FormData(event.currentTarget);
            const roleId = String(data.get('roleId'));
            const expiresAt = String(data.get('expiresAt') ?? '').trim();

            void execute(
              () =>
                browserApi(`/admin/users/${encodeURIComponent(user.id)}/roles`, {
                  method: 'POST',
                  body: {
                    roleId,
                    ...(expiresAt.length > 0
                      ? {
                          expiresAt: toIsoDate(expiresAt),
                        }
                      : {}),
                  },
                }),
              'نقش برای کاربر ثبت شد.',
            );

            roleDialog.current?.close();
          }}
        >
          <h2 id="user-role-dialog-title">افزودن نقش</h2>

          <label>
            نقش
            <select name="roleId" required>
              <option value="">انتخاب کنید</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.key})
                </option>
              ))}
            </select>
          </label>

          <label>
            تاریخ انقضا
            <input name="expiresAt" type="datetime-local" />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              ثبت نقش
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => roleDialog.current?.close()}
            >
              انصراف
            </button>
          </div>
        </form>
      </dialog>

      {canAssignRoles && user.roles.length > 0 ? (
        <div className="admin-user-role-actions">
          <h3>حذف نقش موجود</h3>

          {user.roles.map((role) => (
            <div key={role.id}>
              <span>
                {role.name} <code>{role.key}</code>
              </span>

              <button
                className="button secondary"
                type="button"
                disabled={state === 'pending'}
                onClick={() => {
                  const approved = window.confirm(`نقش ${role.name} از کاربر حذف شود؟`);

                  if (!approved) {
                    return;
                  }

                  void execute(
                    () =>
                      browserApi(
                        `/admin/users/${encodeURIComponent(user.id)}/roles/${encodeURIComponent(role.id)}`,
                        {
                          method: 'DELETE',
                        },
                      ),
                    'نقش از کاربر حذف شد.',
                  );
                }}
              >
                حذف نقش
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
