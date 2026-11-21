// Bölge ve ortak ayarlar common.ts'te (fonksiyonlardan önce yüklenir).
export { bootstrap, claimDaily, rewardAd, testPurchase } from "./wallet";
export {
  act,
  claimTimeout,
  createPrivateTable,
  joinPrivateTable,
  joinTable,
  leaveTable,
  nextHand,
  startTable,
} from "./tables";
export { reportPlayer, sendText } from "./chat";
