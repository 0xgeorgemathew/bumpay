function noop() {}

async function noopAsync() {}

const subscription = {
  remove: noop,
};

const ExpoKeepAwakeTag = "ExpoKeepAwakeDefaultTag";

function useKeepAwake() {}

async function isAvailableAsync() {
  return false;
}

function addListener() {
  return subscription;
}

module.exports = {
  ExpoKeepAwakeTag,
  activateKeepAwake: noopAsync,
  activateKeepAwakeAsync: noopAsync,
  deactivateKeepAwake: noopAsync,
  isAvailableAsync,
  addListener,
  useKeepAwake,
};
