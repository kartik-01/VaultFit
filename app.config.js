const baseConfig = require('./app.json');

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
      plugins,
    },
  };
};
