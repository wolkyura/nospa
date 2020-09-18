import { getParsedAttrValue } from './utils';

export default class Component {
  constructor(params) {
    this.$el = params.el;
    this.$app = params.app;
    this.$name = params.name;
    this.$props = params.props || {};

    this.$config = {
      componentRefAttr: params.componentRefAttr || 'data-component-ref',
    };

    this.$isInitialized = false;
    this.$isDestroyed = false;

    this.$eventHandlers = {};
    this.$refsEventHandlers = {};
  }

  $init() {
    if (typeof this.onInit === 'function') {
      this.onInit();
    }
    this.$isInitialized = true;
    this.$emit('init', this);
  }

  $destroy() {
    if (typeof this.onDestroy === 'function') {
      this.onDestroy();
    }
    this.$isDestroyed = true;
    this.$emit('destroy', this);
  }

  $insertHTML(el, html) {
    return this.$app.$insertHTML(el, html);
  }

  $removeEl(el) {
    return this.$app.$removeEl(el);
  }

  $addEl(el, parent, before) {
    return this.$app.$addEl(el, parent, before);
  }

  $replaceEl(el, newEl) {
    return this.$app.$replaceEl(el, newEl);
  }

  $getComponentFromEl(el) {
    return this.$app.$getComponentFromEl(el);
  }

  $getRefs(name) {
    const els = this.$el.querySelectorAll(`[${this.$config.componentRefAttr}]`);
    return Array.prototype.reduce.call(els, (acc, el) => {
      const ref = this.$getRefFromEl(el);

      if (ref && ref.name === name) {
        acc.push(ref);
      }

      return acc;
    }, []);
  }

  // TODO: improve $getRefs to return first found
  $getRef(key) {
    const refs = this.$getRefs(key);
    return refs[0] || null;
  }

  $getRefFromEl(el) {
    if (!this.$el.contains(el)) return null;

    let refBinding = getParsedAttrValue(el, `${this.$config.componentRefAttr}`);
    if (!refBinding) return null;

    refBinding = Array.isArray(refBinding) ? refBinding : [refBinding];

    let i = 0;
    let ref = null;

    while (!ref && i < refBinding.length) {
      const value = refBinding[i];
      const bindingName = value.name || value;

      if (bindingName && typeof bindingName === 'string') {
        const parts = bindingName.split(':');

        if ((parts[0] === this.$name) && !!parts[1]) {
          ref = {
            el,
            name: parts[1] || '',
            props: value.props || {},
          };
        }
      }

      i++;
    }

    return ref;
  }

  // TODO: doesn't work for handlers for capture phase (mouseenter for example)
  $onRef(refName, eventName, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    // Add only one handler for this event type
    if (!this.$refsEventHandlers[eventName]) {
      const delegatedHandler = (e) => {
        const refs = Object.keys(this.$refsEventHandlers[eventName].refs);

        let { target } = e;
        while (target !== this.$el) {
          const ref = this.$getRefFromEl(target);

          if (ref && refs.includes(ref.name)) {
            this.$refsEventHandlers[eventName].refs[ref.name].forEach((h) => h(e, ref));
          }

          target = target.parentNode;
        }
      };
      this.$el.addEventListener(eventName, delegatedHandler);
      this.$refsEventHandlers[eventName] = {
        handler: delegatedHandler,
        refs: {},
      };
    }

    if (!this.$refsEventHandlers[eventName].refs[refName]) {
      this.$refsEventHandlers[eventName].refs[refName] = [];
    }

    this.$refsEventHandlers[eventName].refs[refName].push(handler);

    return () => this.$offRef(refName, eventName, handler);
  }

  $offRef(refName, eventName, handler) {
    if (!this.$refsEventHandlers[eventName]) return;
    if (!this.$refsEventHandlers[eventName].refs[refName]) return;

    const index = this.$refsEventHandlers[eventName].refs[refName].indexOf(handler);
    if (index === -1) return;

    this.$refsEventHandlers[eventName].refs[refName].splice(index, 1);

    // All handlers for this ref are removed
    if (this.$refsEventHandlers[eventName].refs[refName].length === 0) {
      delete this.$refsEventHandlers[eventName].refs[refName];
    }

    // All handlers are removed
    if (Object.keys(this.$refsEventHandlers[eventName].refs).length === 0) {
      this.$el.removeEventListener(eventName, this.$refsEventHandlers[eventName].handler);
    }
  }

  $emit(eventName, data) {
    if (this.$eventHandlers[eventName]) {
      this.$eventHandlers[eventName].forEach((handler) => handler(data));
    }

    const domEvent = new CustomEvent(eventName, { detail: data });

    this.$el.dispatchEvent(domEvent);
  }

  $on(eventName, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Handler must be a function');
    }

    if (!this.$eventHandlers[eventName]) {
      this.$eventHandlers[eventName] = [];
    }

    if (!this.$eventHandlers[eventName].includes(handler)) {
      this.$eventHandlers[eventName].push(handler);
    }

    return () => this.$off(eventName, handler);
  }

  $once(eventName, handler) {
    this.$on(eventName, function onceHandler(data) {
      handler(data);
      this.$off(eventName, onceHandler);
    });
  }

  $off(eventName, handler) {
    if (!this.$eventHandlers[eventName]) return;

    const index = this.$eventHandlers[eventName].indexOf(handler);
    if (index > -1) {
      this.$eventHandlers[eventName].splice(index, 1);
    }
  }
}
