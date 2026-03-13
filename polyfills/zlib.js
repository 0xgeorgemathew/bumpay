// zlib polyfill for React Native using pako
import pako from "pako";

export const deflate = (data, callback) => {
  try {
    const result = pako.deflate(data);
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
};

export const inflate = (data, callback) => {
  try {
    const result = pako.inflate(data);
    callback(null, result);
  } catch (err) {
    callback(err, null);
  }
};

export const deflateSync = pako.deflate;
export const inflateSync = pako.inflate;

export const createDeflate = () => {
  throw new Error("createDeflate not implemented in React Native");
};

export const createInflate = () => {
  throw new Error("createInflate not implemented in React Native");
};

export default {
  deflate,
  inflate,
  deflateSync,
  inflateSync,
  createDeflate,
  createInflate,
};
