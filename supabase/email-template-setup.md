# Supabase Auth Email Template Setup

Branded HTML templates for 27-0 live in `supabase/email-templates/`. Copy each file into the matching Supabase Auth email template in the dashboard.

## 1. Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your **27-0** project

## 2. Configure URL settings

Go to **Authentication → URL Configuration**.

**Site URL:**

```
https://27-0.co.uk
```

**Redirect URLs** (add all of these):

```
https://27-0.co.uk
https://27-0.co.uk/auth/callback
https://27-0.co.uk/auth/reset-password
https://www.27-0.co.uk
https://www.27-0.co.uk/auth/callback
https://www.27-0.co.uk/auth/reset-password
```

For local development you may also keep:

```
http://localhost:3000
http://localhost:3000/auth/callback
```

See also `supabase/AUTH_URL_CONFIG.md` for how the app uses `/auth/callback`.

## 3. Paste email templates

Go to **Authentication → Email Templates**.

For each template below:

1. Open the template in the dashboard
2. Set the **Subject** as listed
3. Paste the HTML from the project file into the **Body (HTML)** field
4. Save

| Dashboard template | Project file | Subject |
|-------------------|--------------|---------|
| Confirm signup | `email-templates/confirm-signup.html` | `Confirm your 27-0 coach account` |
| Reset password | `email-templates/reset-password.html` | `Reset your 27-0 password` |
| Magic Link | `email-templates/magic-link.html` | `Your 27-0 login link` |
| Change email address | `email-templates/change-email.html` | `Confirm your new 27-0 email` |

## 4. Supabase placeholders

These templates use Supabase Go-template variables:

| Placeholder | Usage |
|-------------|--------|
| `{{ .ConfirmationURL }}` | Primary CTA link for confirm, reset, magic link, and email change |

Do **not** remove `{{ .ConfirmationURL }}` from button `href` attributes or the plain-text fallback link.

Optional placeholders (`{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`) are not required for these templates.

## 5. Plain-text fallback (optional)

Supabase also supports a plain-text body. If you add one, mirror the HTML copy:

**Confirm signup:**

```
Welcome to 27-0.

Confirm your email to activate your coach account, save your stats online, and submit scores to the global leaderboards.

{{ .ConfirmationURL }}

If you did not request this email, you can safely ignore it.
```

**Reset password:**

```
You requested a password reset for your 27-0 coach account.

Click the link below to choose a new password and get back to building your squad.

{{ .ConfirmationURL }}

If you did not request this email, you can safely ignore it.
```

## 6. Design notes

- Dark pitch background (`#0a0f0d` / `#0f1814`)
- Neon green accent (`#22c55e`) for logo and CTA
- Table-based layout with inline CSS for Gmail, Outlook, Apple Mail, and mobile clients
- No external CSS or background images
- Fan-game disclaimer in footer

## 7. Test after publishing

1. Sign up with a test email and confirm the **Confirm signup** template renders correctly
2. Request a password reset and verify **Reset password**
3. If magic link login is enabled, test **Magic Link**
4. Confirm links land on `https://27-0.co.uk/auth/callback` and complete successfully
2. Request a password reset and verify the link opens `https://27-0.co.uk/auth/reset-password` with the new-password form
