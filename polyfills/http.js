// HTTP/HTTPS polyfill for React Native
// Uses fetch under the hood for network requests

export const request = (options, callback) => {
  throw new Error(
    "http.request is not supported in React Native. Use fetch instead.",
  );
};

export const get = (url, options, callback) => {
  throw new Error(
    "http.get is not supported in React Native. Use fetch instead.",
  );
};

export const Agent = class {
  constructor() {
    throw new Error("http.Agent is not supported in React Native.");
  }
};

export default {
  request,
  get,
  Agent,
};
