function toLocalDate(dateIso: string): Date {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDayStart(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function isRegistrationExpired(expiryDate: string | null | undefined, today: Date = new Date()): boolean {
  if (!expiryDate) return false;
  const expiry = toLocalDate(expiryDate);
  return expiry < toDayStart(today);
}

export function isRegistrationExpiringSoon(expiryDate: string | null | undefined, today: Date = new Date()): boolean {
  if (!expiryDate) return false;
  const expiry = toLocalDate(expiryDate);
  const diffDays = (expiry.getTime() - toDayStart(today).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 30 && diffDays > 0;
}
