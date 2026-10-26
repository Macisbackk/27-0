/** Published contact for support, account deletion and reports about other players. */
export const CONTACT_EMAIL = "twentysevenzero@yahoo.com";

export const contactMailto = (subject: string) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
