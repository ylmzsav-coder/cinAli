import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Mağazada yayınlandıktan sonra değiştirilemez.
  appId: "com.wordokey.oyun",
  appName: "Word Okey",
  webDir: "dist",
  backgroundColor: "#0f5132",
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0f5132",
      showSpinner: false,
    },
  },
};

export default config;
