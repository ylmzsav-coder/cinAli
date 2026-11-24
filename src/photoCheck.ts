/**
 * Profil resmi denetimi: müstehcen / pornografik resimler reddedilir.
 * Açık kaynak NSFWJS (MIT) modeli cihazda çalışır; resim hiçbir sunucuya gönderilmez.
 * Model (~3,5 MB) yalnızca resim seçilince bir kez yüklenir.
 */
export type PhotoVerdict = "ok" | "rejected";

/** Reddetme eşikleri: Porn/Hentai %50 üstü ya da Sexy %80 üstü. */
const LIMITS: Record<string, number> = { Porn: 0.5, Hentai: 0.5, Sexy: 0.8 };

let modelPromise: Promise<{ classify: (img: HTMLImageElement | HTMLCanvasElement) => Promise<{ className: string; probability: number }[]> }> | null = null;

function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, core, mobilenet] = await Promise.all([import("@tensorflow/tfjs"), import("nsfwjs/core"), import("nsfwjs/models/mobilenet_v2")]);
      await tf.ready();
      return core.load("MobileNetV2", { modelDefinitions: [mobilenet.MobileNetV2Model] });
    })();
    modelPromise.catch(() => (modelPromise = null));
  }
  return modelPromise;
}

/** Resmi denetler; model yüklenemezse güvenli tarafta kalır ve reddeder. */
export async function checkPhoto(img: HTMLImageElement | HTMLCanvasElement): Promise<PhotoVerdict> {
  const model = await loadModel();
  const preds = await model.classify(img);
  return preds.some((p) => p.probability >= (LIMITS[p.className] ?? 2)) ? "rejected" : "ok";
}
