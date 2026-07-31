# SSH lockout safety review

`create-operator-user.sh` creates/reuses the operator, installs the public key idempotently, and
enforces `.ssh=0700` and `authorized_keys=0600`. Prepare writes a managed drop-in with
`ExposeAuthInfo yes`, retains password login and `PermitRootLogin prohibit-password`, preserves the
configured port, runs `sshd -t`, and reloads SSH. UFW permits that port before enablement.

The independent session runs `verify-operator-session.sh`. It requires the expected user,
`SSH_CONNECTION`, a regular OpenSSH `SSH_USER_AUTH` evidence file, and a `publickey` record. It
creates a root-owned `0600` marker containing the user and method. Finalize rejects missing,
symlinked, incorrectly owned/mode, wrong-user, or non-publickey evidence. Only then does it disable
password and root login, validate, and reload. Interrupted prepare retains recovery access.
Timestamped SSH backups/provider console enable recovery. Repeated finalize is safe.
