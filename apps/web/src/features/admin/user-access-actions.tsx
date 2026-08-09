'use client';
import { useUiFormatters, useUiMessages } from '@/i18n/ui-messages-client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui';
import { browserApi } from '@/lib/api/browser-api-client';
import { adminDictionaries } from '@/i18n/admin-dictionary';
import type { AppLocale } from '@/i18n/config';
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
  locale,
}: {
  user: AdminUserDetail;
  availableRoles: AdminRole[];
  permissions: AdminPermission[];
  preview: boolean;
  locale: AppLocale;
}) {
  const ui = useUiMessages();
  const format = useUiFormatters();
  const router = useRouter();
  const dictionary = adminDictionaries[locale];
  const statusDialog = useRef<HTMLDialogElement>(null);
  const emailDialog = useRef<HTMLDialogElement>(null);
  const deletionDialog = useRef<HTMLDialogElement>(null);
  const sessionDialog = useRef<HTMLDialogElement>(null);
  const roleDialog = useRef<HTMLDialogElement>(null);

  const [state, setState] = useState<ActionState>('idle');

  const [message, setMessage] = useState<string | null>(null);

  const effectivePermissions = [...user.effectivePermissions, ...permissions];

  const normalizedPermissions = new Set(effectivePermissions);

  const canManageStatus = normalizedPermissions.has('users.manage_status');

  const canVerifyEmail = normalizedPermissions.has('users.verify_email');

  const canManageDeletion = normalizedPermissions.has('users.manage_deletion');

  const canManageSessions = normalizedPermissions.has('users.manage_sessions');

  const canAssignRoles = normalizedPermissions.has('roles.assign');

  const lifecycle = user.lifecycle;

  const execute = async (operation: () => Promise<unknown>, successMessage: string) => {
    if (preview) {
      setState('success');
      setMessage(ui.thisOperationWasSimulatedInPreviewMode);
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
      setMessage(ui.theOperationFailedCheckPermissionsAccountStatus);
    }
  };

  return (
    <section className="admin-user-actions">
      <div className="admin-section-heading">
        <div>
          <span className="admin-console-eyebrow">{dictionary.users.title}</span>
          <h2>{dictionary.users.manualOperations}</h2>
        </div>

        <span className="admin-user-security-version">
          {dictionary.users.securityVersion} {user.securityVersion}
        </span>
      </div>

      {message !== null ? <Alert error={state === 'error'}>{message}</Alert> : null}

      <div className="admin-user-action-grid">
        {canManageStatus && lifecycle.canSuspend ? (
          <button
            className="button"
            type="button"
            onClick={() => statusDialog.current?.showModal()}
          >
            {dictionary.users.suspend}
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
            {user.emailVerifiedAt === null
              ? dictionary.users.verifyEmail
              : dictionary.users.emailAlreadyVerified}
          </button>
        ) : null}

        {canManageDeletion && (lifecycle.canDelete || lifecycle.canRestore) ? (
          <button
            className={user.deletedAt === null ? 'button danger' : 'button secondary'}
            type="button"
            disabled={state === 'pending'}
            onClick={() => {
              deletionDialog.current?.showModal();
            }}
          >
            {lifecycle.canRestore ? dictionary.users.restore : dictionary.users.delete}
          </button>
        ) : null}

        {canManageSessions ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => sessionDialog.current?.showModal()}
          >
            {dictionary.users.revokeSessions}
          </button>
        ) : null}

        {canAssignRoles ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => roleDialog.current?.showModal()}
          >
            {dictionary.users.addRole}
          </button>
        ) : null}
      </div>

      {!canManageStatus &&
      !canVerifyEmail &&
      !canManageDeletion &&
      !canManageSessions &&
      !canAssignRoles ? (
        <p className="muted">{ui.thisAccountIsReadOnlyForYou}</p>
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
              dictionary.users.emailVerifiedSuccessfully,
            );

            emailDialog.current?.close();
          }}
        >
          <h2 id="user-email-dialog-title">{dictionary.users.verifyEmailTitle}</h2>

          <p>
            {dictionary.users.verifyEmailDescriptionBefore} <strong>{user.email ?? '?'}</strong>{' '}
            {dictionary.users.verifyEmailDescriptionAfter}
          </p>

          <label>
            {dictionary.users.reasonCode}
            <input
              name="reasonCode"
              defaultValue="ADMIN_EMAIL_VERIFIED"
              pattern="[A-Z0-9_]+"
              required
              maxLength={64}
            />
          </label>

          <label>
            {dictionary.users.administratorNote}
            <textarea
              name="note"
              maxLength={500}
              placeholder={dictionary.users.verifyEmailNotePlaceholder}
            />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              {dictionary.users.verifyEmail}
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => {
                emailDialog.current?.close();
              }}
            >
              {dictionary.actions.cancel}
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={deletionDialog} aria-labelledby="user-deletion-dialog-title">
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const data = new FormData(event.currentTarget);
            const reasonCode = String(data.get('reasonCode')).trim();
            const note = String(data.get('note') ?? '').trim();
            const restoring = user.deletedAt !== null;

            void execute(
              () =>
                browserApi(
                  restoring
                    ? `/admin/users/${encodeURIComponent(user.id)}/restore`
                    : `/admin/users/${encodeURIComponent(user.id)}`,
                  {
                    method: restoring ? 'POST' : 'DELETE',
                    body: {
                      reasonCode,
                      ...(note.length > 0 ? { note } : {}),
                    },
                  },
                ),
              restoring
                ? dictionary.users.restoreSuccessfully
                : dictionary.users.deleteSuccessfully,
            );

            deletionDialog.current?.close();
          }}
        >
          <h2 id="user-deletion-dialog-title">
            {user.deletedAt === null ? dictionary.users.delete : dictionary.users.restore}
          </h2>

          <p>
            {user.deletedAt === null
              ? dictionary.users.deleteDescription
              : dictionary.users.restoreDescription}
          </p>

          <label>
            {dictionary.users.reasonCode}
            <input
              name="reasonCode"
              defaultValue={user.deletedAt === null ? 'ADMIN_USER_DELETED' : 'ADMIN_USER_RESTORED'}
              pattern="[A-Z0-9_]+"
              required
              maxLength={64}
            />
          </label>

          <label>
            {dictionary.users.administratorNote}
            <textarea
              name="note"
              maxLength={500}
              placeholder={dictionary.users.deletionNotePlaceholder}
            />
          </label>

          <div className="cluster">
            <button
              className={user.deletedAt === null ? 'button danger' : 'button'}
              disabled={state === 'pending'}
            >
              {user.deletedAt === null ? dictionary.users.delete : dictionary.users.restore}
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => {
                deletionDialog.current?.close();
              }}
            >
              {dictionary.actions.cancel}
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
              ui.accountStatusUpdatedSuccessfully,
            );

            statusDialog.current?.close();
          }}
        >
          <h2 id="user-status-dialog-title">{ui.changeAccountStatus}</h2>

          <label>
            {ui.newStatus}
            <select name="status" defaultValue={user.status} required>
              <option value="ACTIVE">{ui.active}</option>
              <option value="SUSPENDED">{ui.temporarySuspension}</option>
              <option value="BANNED">{ui.permanentlyBlocked}</option>
            </select>
          </label>

          <label>
            {ui.reasonCode}
            <input
              name="reasonCode"
              placeholder="ADMIN_POLICY_VIOLATION"
              pattern="[A-Z0-9_]+"
              maxLength={64}
            />
          </label>

          <label>
            {ui.endOfSuspension}
            <input name="suspendedUntil" type="datetime-local" />
          </label>

          <label>
            {ui.managerSExplanation}
            <textarea
              name="note"
              maxLength={500}
              placeholder={ui.recordTheReasonAndNecessaryEvidence}
            />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              {ui.confirmTheChange}
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => statusDialog.current?.close()}
            >
              {ui.optOut}
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
              ui.allActiveUserSessionsWereClosed,
            );

            sessionDialog.current?.close();
          }}
        >
          <h2 id="user-session-dialog-title">{ui.closeAllActiveSessions}</h2>

          <p>{ui.thisWillLogOutAllTheUser}</p>

          <label>
            {ui.reasonCode}
            <input
              name="reasonCode"
              defaultValue="ADMIN_SECURITY_RESET"
              pattern="[A-Z0-9_]+"
              required
              maxLength={64}
            />
          </label>

          <label>
            {ui.explanation}
            <textarea name="note" maxLength={500} />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              {ui.closingMeetings}
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => sessionDialog.current?.close()}
            >
              {ui.optOut}
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
              ui.roleAssignedToTheUser,
            );

            roleDialog.current?.close();
          }}
        >
          <h2 id="user-role-dialog-title">{ui.addARole}</h2>

          <label>
            {ui.role}
            <select name="roleId" required>
              <option value="">{ui.choose}</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({role.key})
                </option>
              ))}
            </select>
          </label>

          <label>
            {ui.expirationDate}
            <input name="expiresAt" type="datetime-local" />
          </label>

          <div className="cluster">
            <button className="button" disabled={state === 'pending'}>
              {ui.registerRole}
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={() => roleDialog.current?.close()}
            >
              {ui.optOut}
            </button>
          </div>
        </form>
      </dialog>

      {canAssignRoles && user.roles.length > 0 ? (
        <div className="admin-user-role-actions">
          <h3>{ui.deleteAnExistingRole}</h3>

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
                  const approved = window.confirm(format.removeRoleConfirmation(role.name));

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
                    ui.roleRemovedFromTheUser,
                  );
                }}
              >
                {ui.deleteRole}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
