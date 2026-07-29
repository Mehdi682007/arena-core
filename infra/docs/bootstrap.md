# Bootstrap

Copy the example outside Git and fill only non-secret values:

```bash
cp infra/inventory/staging.env.example ~/arena-staging.env
ssh-keygen -t ed25519 -f ~/.ssh/arena-staging
```

The VPS password is entered only into the SSH client's prompt:

```bash
infra/scripts/bootstrap-remote.sh ~/arena-staging.env
```

Alternatively copy the bundle manually and run on the VPS:

```bash
sudo ./infra/scripts/bootstrap.sh /secure/path/arena-staging.env
```

Bootstrap uses the `prepare` SSH policy and keeps password/root recovery available. Open a separate
terminal with the operator key, then run:

```bash
sudo infra/scripts/verify-operator-session.sh /secure/path/arena-staging.env
sudo infra/scripts/configure-ssh.sh /secure/path/arena-staging.env finalize
```

Never close the original session before the second session and `sshd -t` both succeed.
