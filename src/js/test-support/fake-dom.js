// Just enough DOM for the plugin's lifecycle and UI tests under Node's test runner (no jsdom
// dependency). Adapted from bblocks-cesium-viewer's src/js/test-support/fake-dom.js: adds
// classList, keyboard/pointer event properties, element sizes and form-control state.
// innerHTML is stored, not parsed: tests read the markup string itself.

class FakeEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener(type, listener) {
    this.listeners[type] = (this.listeners[type] ?? []).filter(l => l !== listener);
  }

  // Calls every listener for `type` with an event carrying `props`; returns the event.
  dispatch(type, props = {}) {
    const event = { type, target: this, defaultPrevented: false, stopPropagation() {}, ...props };
    event.preventDefault = () => { event.defaultPrevented = true; };
    (this.listeners[type] ?? []).forEach(l => l(event));
    return event;
  }

  listenerCount(type) {
    return (this.listeners[type] ?? []).length;
  }

  get totalListenerCount() {
    return Object.values(this.listeners).reduce((n, list) => n + list.length, 0);
  }
}

class FakeClassList {
  constructor(el) {
    this.el = el;
  }

  get values() {
    return this.el.className.split(/\s+/).filter(Boolean);
  }

  contains(name) {
    return this.values.includes(name);
  }

  add(name) {
    if (!this.contains(name)) this.el.className = [...this.values, name].join(' ');
  }

  remove(name) {
    this.el.className = this.values.filter(v => v !== name).join(' ');
  }

  toggle(name, force = !this.contains(name)) {
    if (force) this.add(name);
    else this.remove(name);
    return force;
  }
}

export class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parent = null;
    this.style = { cssText: '' };
    this.textContent = '';
    this.innerHTML = '';
    this.id = '';
    this.className = '';
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.dataset = {};
    this.attributes = {};
    this.title = '';
    this.type = '';
    this.checked = false;
    this.indeterminate = false;
    this.tabIndex = 0;
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.fullscreenRequests = 0;
    this.clicks = 0;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(c => (typeof c === 'string' ? this.appendChild(Object.assign(new FakeElement('#text', this.ownerDocument), { textContent: c })) : this.appendChild(c)));
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
    child.parent = null;
  }

  remove() {
    this.parent?.removeChild(this);
  }

  replaceChildren(...children) {
    [...this.children].forEach(c => this.removeChild(c));
    this.append(...children);
  }

  // Parsed markup is not modelled, so an innerHTML-built SVG has no element child.
  get firstElementChild() {
    return this.children[0] ?? null;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }

  click() {
    this.clicks += 1;
    return this.dispatch('click');
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  requestFullscreen() {
    this.fullscreenRequests += 1;
    this.ownerDocument.fullscreenElement = this;
    this.ownerDocument.dispatch('fullscreenchange');
  }

  // Depth-first search of this element's subtree.
  find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }

  findAll(predicate) {
    return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.findAll(predicate)]);
  }

  byKey(key) {
    return this.find(el => el.dataset?.key === key);
  }

  byClass(name) {
    return this.findAll(el => el.classList.contains(name));
  }

  get allText() {
    return [this.textContent, ...this.children.map(c => c.allText)].join(' ').trim();
  }
}

export class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.documentElement = new FakeElement('html', this);
    this.head = this.documentElement.appendChild(new FakeElement('head', this));
    this.body = this.documentElement.appendChild(new FakeElement('body', this));
    this.fullscreenElement = null;
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.documentElement.find(el => el.id === id);
  }

  exitFullscreen() {
    this.fullscreenElement = null;
    this.dispatch('fullscreenchange');
  }
}
