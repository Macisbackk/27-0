# Supabase Auth URL Configuration

Update these settings manually in the **Supabase Dashboard** under
**Authentication → URL Configuration**.

## Site URL

```
https://27-0.co.uk
```

## Redirect URLs

Add all of the following (remove `http://localhost:*` from production if present):

```
https://27-0.co.uk
https://27-0.co.uk/auth/callback
https://27-0.co.uk/auth/reset-password
https://www.27-0.co.uk
https://www.27-0.co.uk/auth/callback
https://www.27-0.co.uk/auth/reset-password
```

For local development only, you may also keep:

```
http://localhost:3000
http://localhost:3000/auth/callback
```

## Application code

Sign-up uses `emailRedirectTo: ${origin}/auth/callback`, which resolves to the
live site in production and localhost during local dev.

The `/auth/callback` route exchanges the session and redirects to:

```
/?emailConfirmed=1
```

Password reset emails use `redirectTo: ${origin}/auth/reset-password`. That page
exchanges the recovery code, shows a new-password form, then redirects to
`/login?passwordReset=1` after a successful update.
