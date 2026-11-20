/**
 * Who gets the team email for each tour enquiry and contact message.
 * bella@ follows up; jay@ (WaveX, the ad agency) follows the Black Friday
 * campaign in real time (agreed with Amer and Bella, 2026-11-20).
 * The emails are sent from bella@'s Gmail, so bella@ must stay the sender.
 */
export const LEAD_EMAIL_RECIPIENTS = ["bella@imheretravels.com", "jay@imheretravels.com"] as const;

/** The To header value: every recipient, comma-separated. */
export const leadEmailTo = (): string => LEAD_EMAIL_RECIPIENTS.join(", ");
