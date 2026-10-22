/**
 * Builds the Supabase Auth email templates (supabase/email-templates/*.html) from one layout,
 * in the 27-0 "Floodlit lime" look (neutral black, lime actions, scoreboard logo). Run: node scripts/build-email-templates.mjs
 * Email-safe: tables + inline styles, no external CSS, works in Gmail, Outlook, Apple Mail and on phones.
 */
import { writeFileSync } from "node:fs";

const C = {
  ground: "#0e0f10",
  surface: "#191a1c",
  raised: "#232527",
  line: "#2a2c2f",
  panel: "#060707",
  text: "#ffffff",
  muted: "#a6a9ad",
  faint: "#74777c",
  accent: "#b6f23d",
  onAccent: "#0e1400",
  gold: "#fcd34d",
};
const SITE = "https://27-0.co.uk";
const FONT = "Barlow,'Segoe UI',Helvetica,Arial,sans-serif";
const COND = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";
const DISPLAY = "Anton,Impact,'Arial Black',sans-serif";

const button = (label) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 8px 0;">
  <tr><td align="center">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{{ .ConfirmationURL }}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="28%" fillcolor="${C.accent}" stroke="f"><center style="color:${C.onAccent};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
    <!--[if !mso]><!-->
    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:block;max-width:320px;margin:0 auto;background-color:${C.accent};color:${C.onAccent};font-family:${COND};font-size:18px;font-weight:700;line-height:52px;text-align:center;text-decoration:none;border-radius:14px;">${label}</a>
    <!--<![endif]-->
  </td></tr>
</table>`;

const featureRows = (rows) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 4px 0;background-color:${C.raised};border-radius:16px;">
  ${rows
    .map(
      ([icon, title, body], i) => `<tr><td style="padding:${i === 0 ? "16px" : "4px"} 18px ${i === rows.length - 1 ? "16px" : "10px"} 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td width="40" valign="top" style="font-family:${DISPLAY};font-size:20px;line-height:24px;color:${C.accent};">${icon}</td>
      <td valign="top" style="font-family:${FONT};">
        <p style="margin:0;font-family:${COND};font-size:17px;font-weight:700;line-height:21px;color:${C.text};">${title}</p>
        <p style="margin:2px 0 0 0;font-size:13px;line-height:19px;color:${C.muted};">${body}</p>
      </td>
    </tr></table>
  </td></tr>`
    )
    .join("")}
</table>`;

function layout({ title, preheader, eyebrow, heading, intro, cta, extra = "", note }) {
  return `<!DOCTYPE html>
<html lang="en-GB" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@700&display=swap" rel="stylesheet" />
  <style>
    body { margin:0; padding:0; background-color:${C.ground}; }
    a { color:${C.accent}; }
    @media (max-width:520px) { .card-pad { padding-left:22px !important; padding-right:22px !important; } .h1 { font-size:26px !important; line-height:32px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${C.ground};color:${C.text};font-family:${FONT};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ground};">${preheader}&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.ground};">
    <tr><td align="center" style="padding:28px 12px 36px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <!-- Logo -->
        <tr><td align="center" style="padding:0 0 18px 0;">
          <!-- Scoreboard mark: "27" lime and "0" white on two dark panels -->
          <a href="${SITE}" target="_blank" style="text-decoration:none;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
              <td style="background-color:${C.panel};border:1px solid #2f3134;border-radius:4px;padding:4px 8px 2px 8px;font-family:${DISPLAY};font-size:36px;line-height:40px;letter-spacing:1px;color:${C.accent};">27</td>
              <td style="padding:0 7px;font-family:${DISPLAY};font-size:30px;line-height:40px;color:${C.text};">-</td>
              <td style="background-color:${C.panel};border:1px solid #2f3134;border-radius:4px;padding:4px 8px 2px 8px;font-family:${DISPLAY};font-size:36px;line-height:40px;letter-spacing:1px;color:${C.text};">0</td>
            </tr></table>
          </a>
        </td></tr>
        <!-- Card -->
        <tr><td style="background-color:${C.surface};border-radius:20px;overflow:hidden;">
          <!-- Lime touchline across the top of the card -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background-color:${C.accent};">&nbsp;</td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="card-pad" style="padding:30px 32px 30px 32px;font-family:${FONT};">
              <p style="margin:0 0 10px 0;font-family:${COND};font-size:16px;font-weight:700;line-height:20px;color:${C.accent};">${eyebrow}</p>
              <h1 class="h1" style="margin:0;font-family:${COND};font-size:32px;font-weight:700;line-height:36px;color:${C.text};">${heading}</h1>
              <p style="margin:14px 0 0 0;font-size:15px;line-height:23px;color:${C.muted};">${intro}</p>
              ${button(cta)}
              ${extra}
              <p style="margin:22px 0 6px 0;font-size:12px;line-height:18px;color:${C.faint};">Button not working? Copy this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:18px;word-break:break-all;"><a href="{{ .ConfirmationURL }}" target="_blank" style="color:${C.accent};text-decoration:underline;">{{ .ConfirmationURL }}</a></p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Note -->
        <tr><td style="padding:18px 24px 0 24px;font-family:${FONT};text-align:center;">
          <p style="margin:0;font-size:12px;line-height:18px;color:${C.faint};">${note}</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 24px 0 24px;font-family:${FONT};text-align:center;">
          <p style="margin:0 0 10px 0;font-size:12px;line-height:18px;">
            <a href="${SITE}" target="_blank" style="color:${C.muted};text-decoration:none;font-weight:700;">27-0.co.uk</a>
            <span style="color:${C.faint};">&nbsp;&middot;&nbsp;</span>
            <a href="${SITE}/privacy" target="_blank" style="color:${C.muted};text-decoration:none;">Privacy</a>
            <span style="color:${C.faint};">&nbsp;&middot;&nbsp;</span>
            <a href="mailto:twentysevenzero@yahoo.com" style="color:${C.muted};text-decoration:none;">Contact</a>
          </p>
          <p style="margin:0;font-size:10px;line-height:15px;color:${C.faint};">27-0 is an unofficial fan-made rugby league game. Not affiliated with, endorsed by or connected to the Rugby Football League, Super League, any club, player, broadcaster or governing body.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;
}

const ignore = "Didn't ask for this? You can ignore this email &mdash; nothing changes on your account.";

const templates = {
  "confirm-signup.html": layout({
    title: "Confirm your 27-0 coach account",
    preheader: "One tap and your squads, records and Club Funds are saved online.",
    eyebrow: "Welcome to 27-0",
    heading: "Confirm your email, coach.",
    intro: "One tap and your coach account is live: your records and Club Funds save online, follow you to any device, and your scores go on the leaderboards.",
    cta: "Confirm my email",
    extra: featureRows([
      ["13", "Classic", "Spin real squads, build a 13 and chase the perfect 27-0."],
      ["&#9733;", "Manager Mode", "Run a real club. Play matches live, beat Deadline Day, win the Grand Final."],
      ["#", "Daily puzzles", "A new Daily Challenge rule, Wordle, the 3&times;3 Grid and Millionaire."],
    ]),
    note: ignore,
  }),
  "reset-password.html": layout({
    title: "Reset your 27-0 password",
    preheader: "Choose a new password and get back to your squad.",
    eyebrow: "Password reset",
    heading: "Pick a new password.",
    intro: "Someone (hopefully you) asked to reset the password on your 27-0 coach account. Tap below to choose a new one. The link works once and expires soon.",
    cta: "Choose a new password",
    note: "Didn't ask for this? Ignore this email &mdash; your current password still works.",
  }),
  "magic-link.html": layout({
    title: "Your 27-0 login link",
    preheader: "Tap to log straight in to 27-0.",
    eyebrow: "Log in",
    heading: "Here's your login link.",
    intro: "Tap below to log straight in to your 27-0 coach account. No password needed. The link works once and expires soon.",
    cta: "Log in to 27-0",
    note: ignore,
  }),
  "change-email.html": layout({
    title: "Confirm your new 27-0 email",
    preheader: "Confirm the new email address for your 27-0 account.",
    eyebrow: "Email change",
    heading: "Confirm your new email.",
    intro: "You asked to change the email on your 27-0 coach account to this address. Tap below to confirm it.",
    cta: "Confirm new email",
    note: "Didn't ask for this? Ignore this email and your account keeps its current address.",
  }),
};

for (const [file, html] of Object.entries(templates)) writeFileSync(new URL(`../supabase/email-templates/${file}`, import.meta.url), html);
console.log(`Wrote ${Object.keys(templates).length} templates.`);
