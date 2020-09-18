import ComponentBase from './Component';
import { getParsedAttrValue, get, callAsAsync } from './utils';

const NOSPA_EL_KEY = '__nospa';
const NOSPA_EL_COMPONENT_KEY = 'component';
const NOSPA_EL_DIRECTIVES_KEY = 'directives';

function nospifyElement(el) {
  if (!el[NOSPA_EL_KEY]) {
    el[NOSPA_EL_KEY] = {
      [NOSPA_EL_COMPONENT_KEY]: null,
      [NOSPA_EL_DIRECTIVES_KEY]: [],
    };
  }
  return el;
}

function linkComponent(el, binding) {
  nospifyElement(el)[NOSPA_EL_KEY][NOSPA_EL_COMPONENT_KEY] = binding;
}

function linkDirective(el, binding) {
  nospifyElement(el)[NOSPA_EL_KEY][NOSPA_EL_DIRECTIVES_KEY].push(binding);
}

function unlinkComponent(el) {
  if (el[NOSPA_EL_KEY]) {
    el[NOSPA_EL_KEY][NOSPA_EL_COMPONENT_KEY] = null;
  }
}

function unlinkDirectives(el) {
  if (el[NOSPA_EL_KEY]) {
    el[NOSPA_EL_KEY][NOSPA_EL_DIRECTIVES_KEY] = [];
  }
}

function getLinkedComponent(el) {
  return el[NOSPA_EL_KEY] && el[NOSPA_EL_KEY][NOSPA_EL_COMPONENT_KEY];
}

function getLinkedDirectives(el) {
  return el[NOSPA_EL_KEY] && el[NOSPA_EL_KEY][NOSPA_EL_DIRECTIVES_KEY];
}

function loopMatchedElements(rootEl, selector, cb) {
  const children = rootEl.querySelectorAll(selector);
  const els = Array.prototype.slice.call(children);

  if (rootEl.matches(selector)) {
    els.unshift(rootEl);
  }

  els.forEach(cb);
}

function createComponentClass(definition) {
  function Component(...args) {
    return ComponentBase.call(this, ...args);
  }
  Component.prototype = Object.create(ComponentBase.prototype, {
    constructor: {
      value: Component,
    },
  });
  Object.setPrototypeOf(Component, ComponentBase);

  Object.keys(definition).forEach((key) => {
    Object.defineProperty(Component.prototype, key, {
      value: definition[key],
    });
  });

  return Component;
}

function isComponentClass(obj) {
  return Object.prototype.isPrototypeOf.call(ComponentBase, obj);
}

export default class App {
  constructor(params) {
    this.$data = params.data || {};
    this.$methods = params.methods || {};

    this.$config = {
      components: Object.keys(params.components || {}).reduce((acc, key) => {
        const definition = params.components[key];

        // TODO: validate definition type

        acc[key] = { definition };

        return acc;
      }, {}),
      directives: params.directives || {},
      componentAttr: params.componentAttr || 'data-component',
      componentPropsAttr: params.componentPropsAttr || 'data-component-props',
      componentLazyAttr: params.componentLazyAttr || 'data-component-lazy',
      componentRefAttr: params.componentRefAttr || 'data-component-ref',
      directiveAttr: params.directiveAttr || 'data-directive',
    };

    this.$isInitialized = false;
    this.$isDestroyed = false;
    this.$readyCallbacks = [];

    if (['complete', 'loaded', 'interactive'].includes(document.readyState)) {
      this.$init(params.el);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        this.$init(params.el);
      });
    }
  }

  $init(el) {
    if (this.$isInitialized) return;

    if (typeof el === 'string') {
      const element = document.querySelector(el);
      if (!element) {
        throw new Error('App init failed - root element is not found');
      }
      this.$el = element;
    } else {
      this.$el = el;
    }

    this.$initDirectives(this.$el);
    this.$initComponents(this.$el);

    this.$readyCallbacks.forEach((cb) => cb(this));
    this.$readyCallbacks = [];
    this.$isInitialized = true;
  }

  $destroy() {
    if (this.$el) {
      this.$destroyDirectives(this.$el);
      this.$destroyComponents(this.$el);
    }
    this.$readyCallbacks = [];
    this.$isInitialized = false;
  }

  $hydrateData(data) {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((val) => this.$hydrateData(val));
    }

    if (typeof data === 'string') {
      // TODO: find in the middle of string
      // TODO: move $$data key to config
      const match = data.match(/^(\${2}data\.)(.+)$/);
      if (match && match[2]) {
        const valueFromData = get(this.$data, match[2]);

        if (!valueFromData) {
          console.error(`App data reference is not defined or invalid: "${data}"`);
          return data;
        }

        return valueFromData;
      }

      return data;
    }

    if (typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        data[key] = this.$hydrateData(data[key]);
      });
    }

    return data;
  }

  $initComponents(el) {
    loopMatchedElements(
      el,
      `[${this.$config.componentAttr}]`,
      this.$bindComponent.bind(this),
    );
  }

  $destroyComponents(el) {
    loopMatchedElements(
      el,
      `[${this.$config.componentAttr}]`,
      this.$unbindComponent.bind(this),
    );
  }

  $initDirectives(el) {
    loopMatchedElements(
      el,
      `[${this.$config.directiveAttr}]`,
      this.$bindDirectives.bind(this),
    );
  }

  $destroyDirectives(el) {
    loopMatchedElements(
      el,
      `[${this.$config.directiveAttr}]`,
      this.$unbindDirectives.bind(this),
    );
  }

  $bindComponent(el) {
    const name = el.getAttribute(this.$config.componentAttr);
    if (!name) return;

    if (this.$getComponentFromEl(el)) {
      console.warn('Cannot initialize two components on the same element', el);
      return;
    }

    const componentConfig = this.$config.components[name];
    if (!componentConfig) {
      console.warn(`Component with name "${name}" is not registered.`, el);
      return;
    }

    const lazy = getParsedAttrValue(el, this.$config.componentLazyAttr);

    if (lazy !== null && !!window.IntersectionObserver) {
      const observerOptions = {
        rootMargin: lazy.rootMargin || '0px',
        threshold: lazy.threshold || 0,
      };

      const lazyObserver = new window.IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setTimeout(() => {
              this.$initComponent(el, componentConfig, name).catch(console.error);
            }, lazy.delay || 0);
            lazyObserver.disconnect();
          }
        });
      }, observerOptions);
      lazyObserver.observe(el);

      linkComponent(el, {
        name,
        lazyObserver,
        instance: null,
      });
    } else {
      // Link in case of async component
      // TODO: refactor, improve this function
      linkComponent(el, { name, instance: null });
      this.$initComponent(el, componentConfig, name).catch(console.error);
    }
  }

  $initComponent(el, config, name) {
    return this.$loadComponent(config)
      .then((Comp) => {
        if (!getLinkedComponent(el)) return; // in case it already destroyed

        let props = getParsedAttrValue(el, this.$config.componentPropsAttr);

        if (typeof props !== 'object') {
          console.warn('Component props should be an object', el);
          props = null;
        } else {
          // TODO: hydrate only if $$data exists in the attr
          props = this.$hydrateData(props);
        }

        const instance = new Comp({
          name,
          el,
          props,
          app: this,
          componentRefAttr: this.$config.componentRefAttr,
        });

        if (typeof instance.$init === 'function') instance.$init();

        linkComponent(el, { name, instance });
      })
      .catch((err) => {
        if (/^Loading( CSS)? chunk (\d)+ failed\./.test(err.message)) {
          window.location.reload(true);
        }
        throw err;
      });
  }

  $loadComponent(config) {
    if (config.promise) {
      return config.promise;
    }

    const isCompClass = isComponentClass(config.definition);

    if (typeof config.definition === 'function' && !isCompClass) {
      config.promise = callAsAsync(config.definition).then((definition) => {
        const def = definition.default || definition;
        config.component = isComponentClass(def) ? def : createComponentClass(def);
        config.promise = null;
        return config.component;
      });
      return config.promise;
    }

    if (!config.component) {
      config.component = isCompClass ? config.definition : createComponentClass(config.definition);
    }

    return Promise.resolve(config.component);
  }

  $unbindComponent(el) {
    const component = getLinkedComponent(el);

    if (!component) return;

    if (component && component.instance) {
      component.instance.$destroy();
    }

    if (component.lazyObserver) {
      component.lazyObserver.disconnect();
    }

    unlinkComponent(el);
  }

  $bindDirectives(el) {
    let directiveBinding = getParsedAttrValue(el, this.$config.directiveAttr);
    if (!directiveBinding) return;

    if (typeof directiveBinding === 'object') {
      directiveBinding = this.$hydrateData(directiveBinding);
    }

    if (!Array.isArray(directiveBinding)) {
      directiveBinding = [directiveBinding];
    }

    directiveBinding.forEach((item) => {
      const name = item.name || item;
      const props = item.props || {};

      const directive = this.$config.directives[name];

      if (!directive) {
        console.error(`Directive with name "${name}" is not registered.`, el);
        return;
      }

      const boundDirectives = getLinkedDirectives(el);

      // Prevent directive be bound twice to the same element
      if (boundDirectives && boundDirectives.includes(name)) return;

      directive.bind(el, props);
      linkDirective(el, { name, props });
    });
  }

  $unbindDirectives(el) {
    const directives = getLinkedDirectives(el);

    if (directives && directives.length) {
      directives.forEach((directive) => {
        if (this.$config.directives[directive.name]) {
          this.$config.directives[directive.name].unbind(el);
        }
      });
      unlinkDirectives(el);
    }
  }

  $onInit(cb) {
    if (this.$isInitialized) {
      cb(this);
      return;
    }

    this.$readyCallbacks.push(cb);
  }

  $getComponentFromEl(el) {
    return getLinkedComponent(el);
  }

  $insertHTML(el, html) {
    Array.prototype.forEach.call(el.children, (childEl) => {
      this.$destroyComponents(childEl);
      this.$destroyDirectives(childEl);
    });

    el.innerHTML = html || '';

    Array.prototype.forEach.call(el.children, (childEl) => {
      this.$initComponents(childEl);
      this.$initDirectives(childEl);
    });
  }

  $removeEl(el) {
    // TODO: how to handle possible errors?
    // https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
    if (!el.parentNode) {
      throw new Error('Non-root element is required');
    }

    this.$destroyComponents(el);
    this.$destroyDirectives(el);
    return el.parentNode.removeChild(el);
  }

  $addEl(el, parentEl, before) {
    if (before) {
      parentEl.insertBefore(el, before);
    } else {
      parentEl.appendChild(el);
    }
    this.$initComponents(el);
    this.$initDirectives(el);

    return el;
  }

  $replaceEl(el, newEl) {
    if (!el.parentNode) {
      throw new Error('Non-root element is required');
    }

    this.$destroyComponents(el);
    this.$destroyDirectives(el);

    el.parentNode.replaceChild(newEl, el);
    this.$initComponents(newEl);
    this.$initDirectives(newEl);

    return el;
  }
}
