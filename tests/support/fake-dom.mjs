// Minimal DOM and Leaflet doubles for the Sargassum workspace tests.
// Assigning innerHTML throws, so any markup injection path fails the test.

export function fakeDocument(ids = [], classes = []) {
  const byId = new Map();
  const byClass = new Map();
  const documentRef = {
    createElement(tagName) { return element(tagName); },
    querySelector(selector) {
      if (selector.startsWith("#")) return byId.get(selector.slice(1)) ?? null;
      if (selector.startsWith(".")) return byClass.get(selector.slice(1)) ?? null;
      return null;
    },
  };
  for (const id of ids) {
    const node = element("div");
    node.id = id;
    byId.set(id, node);
  }
  for (const name of classes) {
    const node = element("div");
    node.className = name;
    byClass.set(name, node);
  }
  return documentRef;
}

export function element(tagName) {
  const attributes = new Map();
  const listeners = new Map();
  let ownText = "";
  const node = {
    tagName: tagName.toUpperCase(),
    id: "",
    className: "",
    hidden: false,
    children: [],
    classList: {
      toggle(name, force) {
        const names = new Set(node.className.split(/\s+/).filter(Boolean));
        if (force ?? !names.has(name)) names.add(name); else names.delete(name);
        node.className = [...names].join(" ");
      },
      contains(name) { return node.className.split(/\s+/).includes(name); },
    },
    get textContent() { return ownText + node.children.map((child) => child.textContent).join(""); },
    set textContent(value) { node.children = []; ownText = String(value); },
    set innerHTML(_value) { throw new Error("innerHTML must not be used by the Sargassum workspace"); },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    append(...values) {
      for (const value of values) {
        if (value && typeof value === "object") node.children.push(value);
        else { const text = element("#text"); text.textContent = value; node.children.push(text); }
      }
    },
    replaceChildren(...values) { node.children = []; ownText = ""; node.append(...values); },
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) ?? []), listener]); },
    click() { for (const listener of listeners.get("click") ?? []) listener({ type: "click" }); },
    find(predicate) {
      for (const child of node.children) {
        if (predicate(child)) return child;
        const nested = child.find?.(predicate);
        if (nested) return nested;
      }
      return null;
    },
    findAll(predicate) {
      return node.children.flatMap((child) => [...(predicate(child) ? [child] : []), ...(child.findAll?.(predicate) ?? [])]);
    },
  };
  return node;
}

export function fakeLeaflet() {
  const calls = { maps: 0, removed: 0, circleMarkers: [], polylines: [], rectangles: [], geoJSON: [], fitBounds: [] };
  const layer = (kind, value) => ({ kind, value, addTo(target) { target?.layers?.push(this); return this; }, getBounds() { return { kind: "bounds", value }; } });
  const group = () => ({ layers: [], addTo() { return this; }, clearLayers() { this.layers = []; } });
  const leaflet = {
    calls,
    map() {
      calls.maps += 1;
      return { fitBounds(bounds) { calls.fitBounds.push(bounds); }, remove() { calls.removed += 1; } };
    },
    layerGroup: group,
    geoJSON(value) { calls.geoJSON.push(value); return layer("geojson", value); },
    rectangle(bounds) { calls.rectangles.push(bounds); return layer("rectangle", bounds); },
    circleMarker(point) { calls.circleMarkers.push(point); return layer("circle", point); },
    polyline(points) { calls.polylines.push(points); return layer("polyline", points); },
  };
  return leaflet;
}

export const WORKSPACE_IDS = [
  "sargassum-site-label",
  "sargassum-site-switcher",
  "public-landing", "sargassum-species", "sargassum-title", "sargassum-coverage", "sargassum-revision",
  "sargassum-summary", "map", "map-kicker", "map-title", "map-legend", "sargassum-timeline",
  "sargassum-detail", "sargassum-day-status",
];
export const WORKSPACE_CLASSES = ["app-shell", "record-badge"];
