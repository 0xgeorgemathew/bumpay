type NativeModuleLike = Record<string, unknown> | null | undefined;

const REBUILD_MESSAGE =
  "Rebuild the Android app so the latest native NFC module is installed.";

export function assertNativeModuleMethod(
  moduleName: string,
  nativeModule: NativeModuleLike,
  methodName: string,
): asserts nativeModule is Record<string, (...args: unknown[]) => unknown> {
  if (!nativeModule || typeof nativeModule[methodName] !== "function") {
    throw new Error(`${moduleName}.${methodName} is unavailable. ${REBUILD_MESSAGE}`);
  }
}

export function getNativeModuleError(moduleName: string) {
  return `${moduleName} is unavailable. ${REBUILD_MESSAGE}`;
}
