# nospa

nospa is the way to organize front-end code for non-SPA websites.

## Core ideas and features

- HTML page generates on the sever-side with any CMS or framework depends on request data or system settings.
- The app is the core object which controls components initialization/destruction. Init components on adding elements and destroy when removing. Provides lazy-loading and supports code-splitting.
- The component is a piece of client-side logic.
- Components are absolutely flexible and contain any logic inside. From simple event listener adding to Vue (or React, or any framework) component/widget initialization. Only 2 hooks (basically one) are required: ```onInit``` and ```onDestroy```.
- Components can be set up from HTML with props from data-attribute. Every component receives props in the same format. 
- Components API provides helpers to be as abstract as possible from HTML code.
- The directive is a couple of functions that run on an element when it adds to the DOM and when it removes.

> nospa inspired by Vue and made for cases when we cannot develop a full Vue app

## Installation

```
npm i -S nospa
```

## Usage

- [App](#app)
- [Component](#component)
- [Directive](#directive)

### App

Set up and initialize app: 

```javascript
import { App } from 'nospa';
import ComponentName from './components/ComponentName';
import directiveName from './directives/directiveName';

const app = new App({
  el: '#app',
  components: {
    ComponentName,  
  },
  directives: {
    directiveName,  
  },
  methods: {
    someMethod() {
      console.log('App method called successful!');
    },
  },
  data: {
    foo: 'bar',
  },
  componentAttr: 'data-component',
  componentPropsAttr: 'data-component-props',
  componentLazyAttr: 'data-component-lazy',
  componentRefAttr: 'data-component-ref',
  directiveAttr: 'data-directive',
});
```

```html
<div id="app">
  <div data-component="ComponentName"></div>
  <button type="button" data-directive="directiveName"></button>
</div>
<script src="js/app.js"></script>
<script>
  window.app.$methods.someMethod();
</script>
```
 
#### App methods

> Documentation in progress
> TODO: $getComponentFromEl $insertHTML $removeEl $addEl $replaceEl
 
#### App data

> Documentation in progress

### Component

Basically component implements 2 methods - lifecycle hooks ```onInit``` and ```onDestroy```. Everything else is determined by the implementation of the component logic.

```js
import { Component } from 'nospa';

export default class Clicker extends Component {
  onInit() {
    this.value = 0;
    this.buttonRef = this.$getRef('button');
    this.valueRef = this.$getRef('value');
    
    if (buttonRef) {
      buttonRef.el.removeEventListener('click', this.handleClick);
    }
  }

  onDestroy() {
    if (this.buttonRef) {
      buttonRef.el.removeEventListener('click', this.handleClick)
    }
  }
  
  handleClick(e) {
    this.value += 1;
    if (this.valueRef) {
      valueRef.el.innerText = this.value;
    }
  }
}
```

Component can be defined as a class or as simple object:

```js
export default {
  onInit() {
    this.value = 0;
    this.buttonRef = this.$getRef('button');
    this.valueRef = this.$getRef('value');
    
    if (buttonRef) {
      buttonRef.el.removeEventListener('click', this.handleClick);
    }
  },
  onDestroy() {
    if (this.buttonRef) {
      buttonRef.el.removeEventListener('click', this.handleClick)
    }
  },
  handleClick(e) {
    this.value += 1;
    if (this.valueRef) {
      valueRef.el.innerText = this.value;
    }
  }
}
```

#### Component instance properties

| Property | Description |
| :--- | :--- |
| ```$app``` | App instance |
| ```$name``` | name under which component registered |
| ```$el``` | element to which the component bound |
| ```$props``` | an object with data parsed from ```data-component-props``` attribute  |

#### Methods

App [DOM manipulation methods](#app-methods) available in the component instance: ```$getComponentFromEl```, ```$insertHTML```, ```$removeEl```, ```$addEl```, ```$replaceEl``` 

#### Refs

Refs system is the way to get elements inside the component root element without sticking to class names or ids. It allows to bind the same component to different markup (of course there are possible limitations with elements hierarchy).

```html
<div data-component="Component">
  <div data-component-ref="Component:refName"></div>    
</div>
```

Each ref can contain props object:

```html
<div data-component="Component">
  <div data-component-ref='{ "name": "Component:refName", "props": { "foo": "bar" } }'></div>    
</div>
```

To the one element can be bound multiple refs from different components (one ref from each component):

```html
<div data-component="Component">
  <div data-component="AnotherComponent">
      <div data-component-ref='[
        { "name": "Component:refName", "props": { "foo": "bar" } },
        "AnotherComponent:anotherRefName"
      ]'>
      </div>
  </div>    
</div>
```

```$getRef(name)``` - get single ref object (first with this name will be returned)

```html
<div data-component="Alert">
  <button type="button" data-component-ref="Alert:close"></button>
</div>
```

```js
import { Component } from 'nospa';

export default class Alert extends Component {
  onInit() {
    this.closeRef = this.$getRef('close');
    console.log(this.closeRef); // { el: Element, props: {}, name: 'close' }
  }
}
```

```$getRefs(name)``` - get refs (all with this name will be returned)

```html
<div data-component="Tabs">
  <button type="button" data-component-ref='{ "name": "Tabs:button", "props": { "id": 1 } }'></button>
  <button type="button" data-component-ref='{ "name": "Tabs:button", "props": { "id": 2 } }'></button>
</div>
```

```js
import { Component } from 'nospa';

export default class Tabs extends Component {
  onInit() {
    this.buttonsRefs = this.$getRefs('button');
    console.log(this.buttonsRefs);
    // [{ el: Element, props: { id: 1 }, name: 'button' }, { el: Element, props: { id: 2 }, name: 'button' }]
  }
}
```

```$getRefFromEl(el)``` - get ref from an element (if bound)

```html
<div data-component="Tabs">
  <button type="button" data-component-ref='{ "name": "Tabs:button", "props": { "id": 1 } }'></button>
  <button type="button" data-component-ref='{ "name": "Tabs:button", "props": { "id": 2 } }'></button>
</div>
```

```js
import { Component } from 'nospa';

export default class Tabs extends Component {
  onInit() {
    this.$el.addEventListener('click', (e) => {
      let target = e.target;
      let isFound = false; 
      
      while (target !== this.$el && !isFound) {
        const ref = this.$getRefFromEl(target);
        if (ref && ref.name === 'button') {
          this.setActiveTab(ref.props.id);
          isFound = true;
          return;
        }
        
        target = target.parentNode;
      }
    });
  }
}
```

> To attach delegated event listener use ```$onRef``` method instead

#### Events

> Documentation in progress
> TODO: $onRef, $offRef, $emit, $on, $once, $off

### Directive

Directive binding is very similar with refs binding.

```html
<div data-directive="oneDirective"></div>
```

```html
<div data-directive='{ "name": "oneDirective", "props": { "foo": "bar" } }'></div>
```

```html
<div data-directive='[
  { "name": "oneDirective", "props": { "foo": "bar" } },
  "anotherDirective"
]'>
</div>
```

Directive example:

```html
<button type="button" data-directive='{ "name": "clickLogger", "props": { "id": "foo" } }'></button>
```

```javascript
function logClick() {
  console.log('Clicked!');
}

export default {
  bind(el, props) {
    console.log(`Click logger bound to the button with clicker id: ${props.id}`);
    el.addEventListener('click', logClick);
  },

  unbind(el) {
    el.removeEventListener('click', logClick);
  },
};
```

## Browsers support

All modern browsers.

Works in IE11 with polyfills:
- [Array.prototype.includes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes)
- [Element.prototype.matches](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches)
- [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)
