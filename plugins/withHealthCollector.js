const path = require('path');
const {withXcodeProject} = require('@expo/config-plugins');

const SWIFT_FILE = path.posix.join('..', 'modules', 'health-collector', 'ios', 'HealthCollectorModule.swift');
const OBJC_FILE = path.posix.join('..', 'modules', 'health-collector', 'ios', 'HealthCollectorModuleBridge.m');
const BRIDGING_HEADER = 'VaultFit/VaultFit-Bridging-Header.h';

function hasFile(project, filePath) {
  const fileRefs = project.pbxFileReferenceSection();
  return Object.keys(fileRefs).some((key) => {
    const entry = fileRefs[key];
    return entry && entry.path === filePath;
  });
}

function getMainGroupKey(project) {
  const firstProject = project.getFirstProject();
  if (firstProject?.firstProject?.mainGroup) {
    return firstProject.firstProject.mainGroup;
  }

  if (firstProject?.uuid) {
    const section = project.pbxProjectSection();
    return section?.[firstProject.uuid]?.mainGroup;
  }

  return null;
}

function addSourceFile(project, filePath) {
  if (hasFile(project, filePath)) {
    return;
  }

  const mainGroupKey = getMainGroupKey(project);
  project.addSourceFile(filePath, null, mainGroupKey || undefined);
}

function ensureBridgingHeader(project) {
  const configurations = project.pbxXCBuildConfigurationSection();
  Object.keys(configurations).forEach((key) => {
    const config = configurations[key];
    if (!config || typeof config !== 'object' || !config.buildSettings) {
      return;
    }

    const productName = config.buildSettings.PRODUCT_NAME?.replace(/"/g, '');
    if (productName === 'VaultFit') {
      config.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `"${BRIDGING_HEADER}"`;
    }
  });
}

const withHealthCollector = (config) => {
  return withXcodeProject(config, (configWithProject) => {
    const project = configWithProject.modResults;
    console.log('Config plugin: adding HealthCollector native files to Xcode project');
    addSourceFile(project, SWIFT_FILE);
    addSourceFile(project, OBJC_FILE);
    ensureBridgingHeader(project);
    return configWithProject;
  });
};

module.exports = withHealthCollector;
module.exports.default = withHealthCollector;
