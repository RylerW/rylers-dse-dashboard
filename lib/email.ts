import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const alertEmailTo = process.env.ALERT_EMAIL_TO;
const alertEmailFrom = process.env.ALERT_EMAIL_FROM;

export function getAlertEmailRecipient() {
  return alertEmailTo ?? null;
}

export function emailDeliveryEnabled() {
  return Boolean(resendApiKey && alertEmailTo && alertEmailFrom);
}

export async function sendAlertEmail(input: { subject: string; text: string; html?: string }) {
  if (!emailDeliveryEnabled()) {
    return { delivered: false, reason: "Email delivery is not configured." } as const;
  }

  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: alertEmailFrom!,
    to: [alertEmailTo!],
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return { delivered: true } as const;
}
