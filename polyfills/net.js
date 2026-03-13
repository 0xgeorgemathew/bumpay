// Net polyfill for React Native
// TCP sockets are not available in React Native

export const connect = () => {
  throw new Error("net.connect is not supported in React Native.");
};

export const createConnection = () => {
  throw new Error("net.createConnection is not supported in React Native.");
};

export const Socket = class {
  constructor() {
    throw new Error("net.Socket is not supported in React Native.");
  }
};

export const Server = class {
  constructor() {
    throw new Error("net.Server is not supported in React Native.");
  }
};

export default {
  connect,
  createConnection,
  Socket,
  Server,
};
