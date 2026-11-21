import { TABLES, TableConfig, formatChips, winnerPrize } from "../economy/tables";
import { useWallet } from "../economy/useWallet";
import { Chips } from "./Chips";

const LEVEL = { kolay: "Kolay rakipler", orta: "Orta rakipler", zor: "Zor rakipler" } as const;

interface Props {
  onPick: (t: TableConfig) => void;
  onShop: () => void;
  onBack: () => void;
}

export function Tables({ onPick, onShop, onBack }: Props) {
  const w = useWallet();
  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>‹ Geri</button>
        <button type="button" className="balance small-balance" onClick={onShop}>
          <Chips amount={w.balance} /> <span className="plus-chip">+</span>
        </button>
      </div>
      <h1>Çipli Masalar</h1>
      <p className="muted small">
        Giriş ücreti masaya oturunca alınır. Birinci, potun %90'ını kazanır. Renk Bitirme yaparsanız
        giriş ücreti kadar ikramiye!
      </p>
      <div className="tables">
        {TABLES.map((t) => {
          const afford = w.balance >= t.entry;
          return (
            <div key={t.id} className={`table-card tc-${t.id}`}>
              <div className="tc-name">{t.name}</div>
              <div className="muted small">{LEVEL[t.level]} · {t.hands} el</div>
              <div className="tc-row"><span className="muted small">Giriş</span><Chips amount={t.entry} /></div>
              <div className="tc-row"><span className="muted small">Birinciye</span><Chips amount={winnerPrize(t)} /></div>
              {afford ? (
                <button type="button" className="primary" onClick={() => onPick(t)}>Otur</button>
              ) : (
                <button type="button" onClick={onShop}>{formatChips(t.entry - w.balance)} çip eksik</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
