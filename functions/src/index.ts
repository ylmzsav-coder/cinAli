// Bölge ve ortak ayarlar common.ts'te (fonksiyonlardan önce yüklenir).
export { bootstrap, claimDaily, claimRefill, rewardAd, testPurchase, testSubscribeVip } from "./wallet";
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
export { declineInvite, friendsStatus, heartbeat, inviteFriend, removeFriend, respondFriendRequest, sendFriendRequest, stopWatching, watchTable } from "./social";
export { convertGift, sendGift } from "./gifts";
