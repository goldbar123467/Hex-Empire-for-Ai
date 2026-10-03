// Lossless JSON graph for the upstream board's cyclic field/army references.
// Node/property order is retained: bot tie-breaking depends on array order.
export function packGraph(root) {
  const ids = new Map(), nodes = [];
  function encode(value) {
    if (value === undefined) return ['undefined'];
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value,-0))) return ['number',String(Object.is(value,-0) ? '-0' : value)];
    if (value === null || ['string','number','boolean'].includes(typeof value)) return value;
    if (typeof value !== 'object' || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) throw new TypeError('Continuation supports plain board data only');
    if (ids.has(value)) return ['ref',ids.get(value)];
    const id = nodes.length;
    ids.set(value,id);
    const node = { array: Array.isArray(value), entries: [] };
    if (node.array) node.length = value.length;
    nodes.push(node);
    for (const [key,item] of Object.entries(value)) node.entries.push([key,encode(item)]);
    return ['ref',id];
  }
  return { root: encode(root), nodes };
}

export function unpackGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length > 100000) throw new TypeError('Invalid continuation graph');
  const nodes = graph.nodes.map(n => {
    if (typeof n?.array !== 'boolean' || !Array.isArray(n.entries)) throw new TypeError('Invalid continuation node');
    if (n.array && (!Number.isSafeInteger(n.length) || n.length < 0 || n.length > 100000)) throw new TypeError('Invalid array length');
    return n.array ? new Array(n.length) : {};
  });
  function decode(value) {
    if (!Array.isArray(value)) {
      if (value !== null && !['string','number','boolean'].includes(typeof value)) throw new TypeError('Invalid continuation value');
      return value;
    }
    if (value[0] === 'undefined' && value.length === 1) return undefined;
    if (value[0] === 'number' && value.length === 2 && ['NaN','Infinity','-Infinity','-0'].includes(value[1])) return Number(value[1]);
    if (value[0] === 'ref' && value.length === 2 && Number.isInteger(value[1]) && value[1] >= 0 && value[1] < nodes.length) return nodes[value[1]];
    throw new TypeError('Invalid continuation reference');
  }
  graph.nodes.forEach((node,i) => {
    const seen = new Set();
    for (const pair of node.entries) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || seen.has(pair[0]) || ['__proto__','constructor','prototype','length'].includes(pair[0])) throw new TypeError('Invalid continuation property');
      seen.add(pair[0]);
      Object.defineProperty(nodes[i],pair[0],{value:decode(pair[1]),writable:true,enumerable:true,configurable:true});
    }
  });
  return decode(graph.root);
}
