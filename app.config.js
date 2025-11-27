const baseConfig = require('./app.json');
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

      /*******************************
       * 🔑 Env variables
       *******************************/
      extra: {
        ...(expoConfig.extra || {}),

        EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,

        WEB_URL: "https://vaultfit.netlify.app",
      },

      /*******************************
       * 🔗 Deep linking scheme
       *******************************/
      scheme: process.env.EXPO_APP_SCHEME ?? "vaultfit", // → vaultfit://

      /*******************************
       * 🍎 iOS bundle ID (required)
       *******************************/
      ios: {
        ...expoConfig.ios,
        bundleIdentifier:
          process.env.EXPO_BUNDLE_ID ?? "com.vaultfit.app",

        supportsTablet: true,

        // Optional: allow universal links later if needed
        // associatedDomains: ["applinks:vaultfit.netlify.app"],
      },

      /*******************************
       * 🤖 Android package ID
       *******************************/
      android: {
        ...expoConfig.android,
        package: process.env.EXPO_ANDROID_PACKAGE ?? "com.vaultfit.app",
        intentFilters: [
          {
            action: "VIEW",
            data: [
              {
                scheme: "vaultfit",
              },
            ],
            category: ["BROWSABLE", "DEFAULT"],
          },
        ],
      },

      /*******************************
       * 🌐 Web config (Netlify)
       *******************************/
      web: {
        bundler: "metro",
        output: "single",
      },

      /*******************************
       * 🔌 Plugins
       *******************************/
      plugins,
    },
  };
};
