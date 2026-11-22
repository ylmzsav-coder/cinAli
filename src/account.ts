/** Oyuncunun giriş yolu (cihazda saklanır): misafir, e-posta ya da Facebook. */
export type LoginMethod = "guest" | "email" | "facebook";

export interface Account {
  method: LoginMethod;
  /** E-posta ile bağlananın adresi (yalnızca gösterim için). */
  email?: string;
}

const KEY = "wordokey.account";

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function saveAccount(a: Account | null) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* depolama yoksa bu oturumda geçerli */
  }
}
