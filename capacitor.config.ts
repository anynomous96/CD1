import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.signal.morse',
  appName: 'Signal',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
