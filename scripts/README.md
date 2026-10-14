# Administrator test-account bootstrap

The one-time `bootstrap-admin.mjs` utility reads `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` from the current process environment. Set them in the shell before running the utility; it never prints credential values. It refuses to run unless the project ID is exactly `hemolink-ai`.

Run a dry-run by supplying exactly one target email:

```text
node scripts/bootstrap-admin.mjs <target-email>
```

Without `--apply`, the utility only verifies the Authentication account and its matching Firestore profile, then reports the outcome without modifying Firebase. Review the target email, UID, project ID, and successful validation outcome before proceeding.

To apply an approved bootstrap, repeat the same invocation with the explicit `--apply` flag. Do so only after reviewing a successful dry-run. The utility updates the verified profile role first, then adds the `admin: true` custom claim while preserving unrelated claims. If the claim update fails after the role update, administrator access is incomplete and must not be used until the role and claim are reconciled.
