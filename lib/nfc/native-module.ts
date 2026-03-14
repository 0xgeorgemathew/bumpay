type NativeModuleLike = Record<string, unknown> | null | undefined;

const REBUILD_MESSAGE =
  "Rebuild the Android app so the latest native NFC module is installed.";
const warnedModules = new Set<string>();

function hasNativeModuleMethod(
  nativeModule: NativeModuleLike,
  methodName: string,
): nativeModule is Record<string, (...args: unknown[]) => unknown> {
  return !!nativeModule && typeof nativeModule[methodName] === "function";
}

export function isNativeModuleAvailable(
  nativeModule: NativeModuleLike,
  methodNames: readonly string[],
): nativeModule is Record<string, (...args: unknown[]) => unknown> {
  return methodNames.every((methodName) => hasNativeModuleMethod(nativeModule, methodName));
}

export function assertNativeModuleMethod(
  moduleName: string,
  nativeModule: NativeModuleLike,
  methodName: string,
): asserts nativeModule is Record<string, (...args: unknown[]) => unknown> {
  if (!hasNativeModuleMethod(nativeModule, methodName)) {
    throw new Error(`${moduleName}.${methodName} is unavailable. ${REBUILD_MESSAGE}`);
  }
}

export function getNativeModuleError(moduleName: string) {
  return `${moduleName} is unavailable. ${REBUILD_MESSAGE}`;
}

export function warnNativeModuleUnavailable(moduleName: string) {
  if (warnedModules.has(moduleName)) {
    return;
  }

  warnedModules.add(moduleName);
  console.warn(getNativeModuleError(moduleName));
}
