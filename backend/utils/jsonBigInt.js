// utils/jsonBigInt.js
function toJSONSafe(value) {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === 'bigint') return value.toString();
  if (t !== 'object') return value;

  if (Array.isArray(value)) return value.map(toJSONSafe);

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = toJSONSafe(v);
  }
  return out;
}

module.exports = { toJSONSafe };
