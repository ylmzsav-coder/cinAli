import { Dictionary } from "../game/dictionary";
import { LANGS, LangCode } from "../game/lang";

/** Sözlükler dil başına bir kez indirilir. */
const cache = new Map<LangCode, Promise<Dictionary>>();

export function loadDictionary(code: LangCode): Promise<Dictionary> {
  let p = cache.get(code);
  if (!p) {
    p = fetch(`./dict/${code}.txt`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((text) => Dictionary.fromText(text, LANGS[code]));
    p.catch(() => cache.delete(code));
    cache.set(code, p);
  }
  return p;
}
