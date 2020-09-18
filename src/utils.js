export function getParsedAttrValue(el, attr) {
  const value = el.getAttribute(attr);
  if (!value) return value;

  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
}

export function get(variable, path, defaultValue) {
  const result = String.prototype.split
    .call(path, /[,[\].]+?/)
    .filter(Boolean)
    .reduce((res, key) => (res !== undefined ? res[key] : res), variable);

  return result === undefined || result === variable ? defaultValue : result;
}

export function callAsAsync(fn) {
  try {
    const result = fn();

    if (result && result.then && typeof result.then === 'function') {
      return result;
    }

    return Promise.resolve(result);
  } catch (err) {
    return Promise.reject(err);
  }
}
