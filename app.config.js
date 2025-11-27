const baseConfig = require('./app.json');
// Load local dotenv for dev flows so `.env.local` values can be injected
// into `expo.extra` and accessed via `Constants.expoConfig.extra` at runtime.
require('dotenv').config({ path: '.env.local' });

function withHealthCollectorPlugin(plugins = []) {
  const pluginModule = require('./plugins/withHealthCollector');
  const alreadyIncluded = plugins.some((entry) => {
    if (Array.isArray(entry)) {
      return entry[0] === pluginModule || entry[0] === './plugins/withHealthCollector';
    }
    return entry === pluginModule || entry === './plugins/withHealthCollector';
  });

  if (alreadyIncluded) {
    return plugins.map((entry) => {
      if (entry === './plugins/withHealthCollector' || entry === pluginModule) {
        return pluginModule;
      }
      return entry;
    });
  }

  return [...plugins, pluginModule];
}

module.exports = () => {
  const expoConfig = baseConfig.expo || {};
  const plugins = withHealthCollectorPlugin(expoConfig.plugins || []);

  return {
    ...baseConfig,
    expo: {
      ...expoConfig,
      // Ensure env values from .env.local are available at runtime via
      // `Constants.expoConfig.extra`. This is helpful for local dev and
      // EAS builds where process.env is not injected at runtime.
      extra: {
        ...(expoConfig.extra || {}),
        EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
      },
      // Add a custom URL scheme so the mobile app can be opened by
      // magic-link redirects. For dev, we use `vaultfit://`.
      scheme: process.env.EXPO_APP_SCHEME ?? 'vaultfit',
      plugins,
    },
  };
};
