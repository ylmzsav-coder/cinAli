import { useEffect, useState } from "react";
import { WalletData, wallet } from "./wallet";

export function useWallet(): WalletData {
  const [data, setData] = useState(wallet.snapshot);
  useEffect(() => wallet.subscribe(setData), []);
  return data;
}
