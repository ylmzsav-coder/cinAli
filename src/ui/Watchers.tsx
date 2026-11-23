import { useState } from "react";
import { t } from "../i18n";

/** İzleyici rozeti: 👁 sayı; dokununca izleyenlerin adları listelenir. */
export function WatchersBadge({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  if (!names.length) return null;
  return (
    <span className="watchers-wrap">
      <button type="button" className="watchers-badge" aria-expanded={open} title={t("watchersN", { n: names.length })}
        onClick={() => setOpen((v) => !v)}>👁 {names.length}</button>
      {open && (
        <div className="watchers-list" role="dialog" aria-label={t("watchersTitle")} onClick={() => setOpen(false)}>
          <div className="watchers-head">👁 {t("watchersTitle")}</div>
          <ul>{names.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </span>
  );
}

/** Masa belgesinden izleyici adları (yalnızca hâlâ izleyenler). */
export const watcherNamesOf = (doc: { watchers?: string[]; watcherNames?: Record<string, string> }) =>
  (doc.watchers ?? []).map((u) => doc.watcherNames?.[u] ?? "?");
