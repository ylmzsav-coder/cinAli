/**
 * Firebase bağlantısı.
 *
 * Yapılandırma derleme anında ortam değişkenlerinden gelir (.env):
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
 * Yerel geliştirmede emülatör için: VITE_FIREBASE_EMULATOR=1 (proje "demo-cinali").
 * Hiçbiri yoksa CLOUD = false: çipler cihazda tutulur, çipli masalar botlarla cihazda oynanır.
 */
import { FirebaseApp, initializeApp } from "firebase/app";
import {
  Auth,
  EmailAuthProvider,
  FacebookAuthProvider,
  connectAuthEmulator,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { Firestore, connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { Functions, connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const env = import.meta.env;
const EMULATOR = env.VITE_FIREBASE_EMULATOR === "1";
const config = EMULATOR
  ? { projectId: "demo-cinali", apiKey: "demo-key", authDomain: "demo-cinali.firebaseapp.com" }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
      projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
      appId: env.VITE_FIREBASE_APP_ID as string | undefined,
    };

/** Sunucu (Firebase) kullanılabilir mi. */
export const CLOUD = !!config.projectId && !!config.apiKey;
const REGION = "europe-west3";

let app: FirebaseApp | null = null;
let auth: Auth;
let db: Firestore;
let fns: Functions;

function init() {
  if (app) return;
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  fns = getFunctions(app, REGION);
  if (EMULATOR) {
    const host = location.hostname || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
    connectFunctionsEmulator(fns, host, 5001);
  }
}

export function firestore(): Firestore {
  init();
  return db;
}

let userPromise: Promise<User> | null = null;
/** Oturum açar (ilk seferde anonim hesap oluşturur); kullanıcıyı döndürür. */
export function currentUser(): Promise<User> {
  init();
  if (!userPromise) {
    userPromise = new Promise<User>((resolve, reject) => {
      const off = onAuthStateChanged(auth, (u) => {
        if (u) {
          off();
          resolve(u);
        }
      });
      if (!auth.currentUser) signInAnonymously(auth).catch((e) => {
        userPromise = null;
        reject(e);
      });
    });
  }
  return userPromise;
}

/**
 * E-posta ile bağlan. Yeni hesapta misafir (anonim) hesap e-postaya bağlanır,
 * böylece çipler ve istatistikler korunur; e-posta zaten kayıtlıysa o hesaba giriş yapılır.
 */
export async function connectEmail(email: string, password: string, create: boolean): Promise<User> {
  const u = await currentUser();
  if (create) {
    const res = await linkWithCredential(u, EmailAuthProvider.credential(email, password));
    return res.user;
  }
  const res = await signInWithEmailAndPassword(auth, email, password);
  userPromise = Promise.resolve(res.user);
  return res.user;
}

/** Facebook ile bağlan (web: açılır pencere). Misafir hesap Facebook'a bağlanır. */
export async function connectFacebook(): Promise<User> {
  const u = await currentUser();
  const provider = new FacebookAuthProvider();
  try {
    return (await linkWithPopup(u, provider)).user;
  } catch (e) {
    // Facebook hesabı zaten başka bir oyuncu hesabına bağlıysa o hesaba giriş yapılır
    if ((e as { code?: string }).code === "auth/credential-already-in-use") {
      const res = await signInWithPopup(auth, provider);
      userPromise = Promise.resolve(res.user);
      return res.user;
    }
    throw e;
  }
}

/** Sunucu hatası: code bir çeviri anahtarıdır (err.*). */
export class CloudError extends Error {
  constructor(
    readonly code: string,
    readonly params: Record<string, string | number> = {},
  ) {
    super(code);
  }
}

/** Sunucu fonksiyonu çağırır; hataları çevrilebilir CloudError'a dönüştürür. */
export async function call<T = unknown>(name: string, data?: unknown): Promise<T> {
  await currentUser();
  try {
    const res = await httpsCallable(fns, name)(data);
    return res.data as T;
  } catch (e) {
    const err = e as { code?: string; details?: { code?: string; params?: Record<string, string | number> } };
    if (err.details?.code) throw new CloudError(err.details.code, err.details.params ?? {});
    throw new CloudError(err.code === "functions/unavailable" || err.code === "functions/internal" ? "network" : "network");
  }
}
