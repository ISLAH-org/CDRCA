let hooks = {};

function register(priority, type, process, callback) {
  if (typeof callback !== "function") return;
  const hookKey = `${type}_${process}`;
  if (!hooks[hookKey]) {
    hooks[hookKey] = [];
  }
  hooks[hookKey].push({ callback, priority });
  hooks[hookKey].sort((a, b) => b.priority - a.priority);
}

function run(type, process, initialValue, ...args) {
  let currentValue = initialValue;
  const hookKey = `${type}_${process}`;
  const list = hooks[hookKey];
  if (list) {
    for (const item of list) {
      const result = item.callback(currentValue, ...args);
      if (result !== undefined) {
        currentValue = result;
      }
    }
  }
  return currentValue;
}

function clear() {
  hooks = {};
}

module.exports = {
  register,
  run,
  clear
};
