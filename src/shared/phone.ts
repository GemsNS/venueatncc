/**
 * A phone number for display. A US number typed as 10 digits (or 11 starting with 1), with or without
 * spaces, dashes, dots, or parentheses, reads "(757) 555-0142". Anything else (an international number,
 * an extension) is shown as typed. For tel: links use dialable() in the admin and email helpers.
 */
export function formatPhone(raw: string): string {
  const typed = raw.trim();
  if (!/^[0-9()+.\-\s]+$/.test(typed)) return typed;
  const digits = typed.replace(/[^0-9]/g, '');
  const international = typed.startsWith('+') && !typed.startsWith('+1');
  const ten = international ? null : digits.length === 10 ? digits : digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : null;
  return ten ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : typed;
}
