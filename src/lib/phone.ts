// Kenyan phone normalization → 2547XXXXXXXX / 2541XXXXXXXX (M-Pesa format, no +).

export function normalizeKenyanPhone(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  else if (p.startsWith("2540")) p = "254" + p.slice(4);
  return p;
}

export function validKenyanPhone(p: string): boolean {
  return /^254(7|1)\d{8}$/.test(p);
}
