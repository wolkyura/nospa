import App from '../src/App';
import Component from '../src/Component';

describe('Component initialization', () => {
  const onInit1 = jest.fn();
  const onInit2 = jest.fn();
  const onInit3 = jest.fn();

  const el = document.createElement('div');
  el.innerHTML = `
    <div data-component="Component1"></div>
    <div data-component="Component2"></div>
    <div data-component="Component3"></div>
    <div data-component="Component4"></div>
  `;

  function Component3(...args) {
    return Component.call(this, ...args);
  }
  Component3.prototype = Object.create(Component.prototype, {
    constructor: {
      value: Component3,
    },
  });
  Object.setPrototypeOf(Component3, Component);
  Object.defineProperty(Component3.prototype, 'onInit', {
    value: function onInit() {
      onInit3();
    },
  });

  const app = new App({
    el,
    components: {
      Component1: {
        onInit() {
          onInit1();
        },
      },
      Component2: () => ({
        onInit() {
          onInit2();
        },
      }),
      Component3,
      Component4: () => Component3,
    },
  });

  it('defines as an object', () => {
    expect(onInit1).toHaveBeenCalledTimes(1);
  });

  it('defines as a function', () => {
    expect(onInit2).toHaveBeenCalledTimes(1);
  });

  it('defines as a class', () => {
    expect(onInit3).toHaveBeenCalledTimes(2);
  });

  afterAll(() => {
    app.$destroy();
    el.parentNode.removeChild(el);
  });
});
