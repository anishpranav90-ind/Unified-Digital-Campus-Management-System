// Campus domain plus common consumer providers. Override with the
// INSTITUTIONAL_EMAIL_DOMAINS environment variable and keep the database
// allowlist (public.institutional_email_domains) in sync.
const DEFAULT_EMAIL_DOMAINS = [
  "college.edu.in",
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "rediffmail.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
];

export function getInstitutionalEmailDomains() {
  const configured = process.env.INSTITUTIONAL_EMAIL_DOMAINS;
  const parsed = configured
    ? configured.split(",").map((domain) => domain.trim().toLowerCase().replace(/^@/, "")).filter(Boolean)
    : [];
  const domains = parsed.length ? parsed : DEFAULT_EMAIL_DOMAINS;
  return Array.from(new Set(domains));
}

export function isInstitutionalEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0) return false;
  const domain = normalized.slice(separator + 1);
  return getInstitutionalEmailDomains().includes(domain);
}

export function institutionalEmailError() {
  const domains = getInstitutionalEmailDomains().map((domain) => `@${domain}`);
  const examples = domains.slice(0, 3).join(", ");
  const suffix = domains.length > 3 ? ", or another supported provider" : "";
  return `Use an approved email address (${examples}${suffix}).`;
}
