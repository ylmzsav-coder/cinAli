import { rateTier } from "../economy/tables";
import { t } from "../i18n";

/**
 * Başarı oranı halkası: yüzde, seviyesinin renginde dolan bir halka içinde gösterilir.
 * %0-30 turuncu (Çayhane), %31-49 sarı (Çarli), %50-75 yeşil (Fifty Cent), %76+ kırmızı (Sosyete).
 */
export function RateRing({ rate, size = 96 }: { rate: number; size?: number }) {
  const { tier } = rateTier(rate);
  const stroke = Math.max(4, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, rate)) / 100) * c;
  return (
    <svg className="rate-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`%${rate}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={tier.color} fontWeight="900" fontSize={size * 0.27}>%{rate}</text>
    </svg>
  );
}

/** Oyuncunun seviyesi: "Sosyete oyuncusu" gibi, seviyenin renginde. */
export function tierName(rate: number): string {
  return t("tierPlayer", { room: t(`table_${rateTier(rate).tier.table}` as "table_vip") });
}

/** Profil kartı: halka, seviye adı ve bir üst seviyeye ne kadar kaldığı. */
export function RateCard({ rate, won, played }: { rate: number; won: number; played: number }) {
  const { tier, next } = rateTier(rate);
  return (
    <div className="rate-card" style={{ borderColor: tier.color }}>
      <div className="rate-card-title">{t("stWinRate")}</div>
      <RateRing rate={rate} size={104} />
      <div className="rate-card-tier" style={{ color: tier.color }}>{tierName(rate)}</div>
      <div className="rate-card-games muted small">{t("tierGames", { won, played })}</div>
      <p className="rate-card-hint">
        {next
          ? t("tierNext", { room: t(`table_${next.table}` as "table_vip"), need: next.min, left: next.min - rate })
          : t("tierTop")}
      </p>
    </div>
  );
}
