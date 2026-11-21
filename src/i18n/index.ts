import { LANGS, LangCode } from "../game/lang";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import it from "./it";
import pt from "./pt";
import tr, { Messages } from "./tr";

const CATALOGS: Record<LangCode, Messages> = { tr, en, de, fr, es, it, pt };

type StringKey = { [K in keyof Messages]: Messages[K] extends string ? K : never }[keyof Messages];
export type Params = Record<string, string | number>;

let ui: LangCode = "tr";

export function setUiLang(code: LangCode) {
  ui = code;
  try {
    document.documentElement.lang = code;
  } catch {
    /* testlerde document yok */
  }
}

export const uiLang = () => ui;
export const uiLocale = () => LANGS[ui].locale;

function format(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    const v = params[k];
    if (v === undefined) return m;
    return typeof v === "number" ? v.toLocaleString(uiLocale()) : v;
  });
}

/** Çeviri: t("shop"), t("dailyToast", { n: 1000 }). Sayılar yerel biçimde yazılır. */
export function t(key: StringKey, params?: Params): string {
  const msg = (CATALOGS[ui][key] ?? tr[key]) as string;
  return format(msg, params);
}

/** Dinamik anahtar (motorun hata ve kayıt kodları için); yoksa anahtarın kendisi. */
export function tk(key: string, params?: Params): string {
  const msg = (CATALOGS[ui] as Record<string, unknown>)[key] ?? (tr as Record<string, unknown>)[key];
  return typeof msg === "string" ? format(msg, params) : key;
}

export const botNames = (): string[] => CATALOGS[ui].botNames;

export function formatNumber(n: number): string {
  return n.toLocaleString(uiLocale());
}
