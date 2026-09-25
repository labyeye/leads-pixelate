const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const RN_SHIM_PATH = path.resolve(__dirname, 'src/shims/react-native.tsx');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'react-native' && context.originModulePath !== RN_SHIM_PATH) {
        return { type: 'sourceFile', filePath: RN_SHIM_PATH };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
