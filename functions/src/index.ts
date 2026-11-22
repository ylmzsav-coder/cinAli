// Bölge ve ortak ayarlar common.ts'te (fonksiyonlardan önce yüklenir).
export { bootstrap, claimDaily, claimRefill, rewardAd, testPurchase } from "./wallet";
export {
  act,
  claimTimeout,
  createPrivateTable,
  joinPrivateTable,
  joinTable,
  leaveTable,
  nextHand,
  startTable,
  takeSeat,
} from "./tables";
export { reportPlayer, sendText } from "./chat";
export { sendFeedback } from "./feedback";
export { friendsStatus, heartbeat, removeFriend, respondFriendRequest, sendFriendRequest, stopWatching, watchTable } from "./social";
