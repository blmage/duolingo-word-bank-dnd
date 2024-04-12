(function () {
  'use strict';

  class AbstractEvent {

    constructor(data) {

      this._canceled = false;
      this.data = data;
    }

    get type() {
      return this.constructor.type;
    }

    get cancelable() {
      return this.constructor.cancelable;
    }

    cancel() {
      this._canceled = true;
    }

    canceled() {
      return this._canceled;
    }

    clone(data) {
      return new this.constructor({
        ...this.data,
        ...data
      });
    }
  }

  AbstractEvent.type = 'event';

  AbstractEvent.cancelable = false;

  class AbstractPlugin {

    constructor(draggable) {
      this.draggable = draggable;
    }

    attach() {
      throw new Error('Not Implemented');
    }

    detach() {
      throw new Error('Not Implemented');
    }
  }

  const defaultDelay = {
    mouse: 0,
    drag: 0,
    touch: 100
  };

  class Sensor {

    constructor(containers = [], options = {}) {

      this.containers = [...containers];

      this.options = {
        ...options
      };

      this.dragging = false;

      this.currentContainer = null;

      this.originalSource = null;

      this.startEvent = null;

      this.delay = calcDelay(options.delay);
    }

    attach() {
      return this;
    }

    detach() {
      return this;
    }

    addContainer(...containers) {
      this.containers = [...this.containers, ...containers];
    }

    removeContainer(...containers) {
      this.containers = this.containers.filter(container => !containers.includes(container));
    }

    trigger(element, sensorEvent) {
      const event = document.createEvent('Event');
      event.detail = sensorEvent;
      event.initEvent(sensorEvent.type, true, true);
      element.dispatchEvent(event);
      this.lastEvent = sensorEvent;
      return sensorEvent;
    }
  }

  function calcDelay(optionsDelay) {
    const delay = {};
    if (optionsDelay === undefined) {
      return {
        ...defaultDelay
      };
    }
    if (typeof optionsDelay === 'number') {
      for (const key in defaultDelay) {
        if (Object.prototype.hasOwnProperty.call(defaultDelay, key)) {
          delay[key] = optionsDelay;
        }
      }
      return delay;
    }
    for (const key in defaultDelay) {
      if (Object.prototype.hasOwnProperty.call(defaultDelay, key)) {
        if (optionsDelay[key] === undefined) {
          delay[key] = defaultDelay[key];
        } else {
          delay[key] = optionsDelay[key];
        }
      }
    }
    return delay;
  }

  function closest(node, value) {
    if (node == null) {
      return null;
    }
    function conditionFn(currentNode) {
      if (currentNode == null || value == null) {
        return false;
      } else if (isSelector(value)) {
        return Element.prototype.matches.call(currentNode, value);
      } else if (isNodeList(value)) {
        return [...value].includes(currentNode);
      } else if (isElement(value)) {
        return value === currentNode;
      } else if (isFunction$1(value)) {
        return value(currentNode);
      } else {
        return false;
      }
    }
    let current = node;
    do {
      current = current.correspondingUseElement || current.correspondingElement || current;
      if (conditionFn(current)) {
        return current;
      }
      current = current?.parentNode || null;
    } while (current != null && current !== document.body && current !== document);
    return null;
  }
  function isSelector(value) {
    return Boolean(typeof value === 'string');
  }
  function isNodeList(value) {
    return Boolean(value instanceof NodeList || value instanceof Array);
  }
  function isElement(value) {
    return Boolean(value instanceof Node);
  }
  function isFunction$1(value) {
    return Boolean(typeof value === 'function');
  }

  function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  class SensorEvent extends AbstractEvent {

    get originalEvent() {
      return this.data.originalEvent;
    }

    get clientX() {
      return this.data.clientX;
    }

    get clientY() {
      return this.data.clientY;
    }

    get target() {
      return this.data.target;
    }

    get container() {
      return this.data.container;
    }

    get originalSource() {
      return this.data.originalSource;
    }

    get pressure() {
      return this.data.pressure;
    }
  }

  class DragStartSensorEvent extends SensorEvent {}

  DragStartSensorEvent.type = 'drag:start';
  class DragMoveSensorEvent extends SensorEvent {}

  DragMoveSensorEvent.type = 'drag:move';
  class DragStopSensorEvent extends SensorEvent {}

  DragStopSensorEvent.type = 'drag:stop';
  class DragPressureSensorEvent extends SensorEvent {}
  DragPressureSensorEvent.type = 'drag:pressure';

  const onContextMenuWhileDragging = Symbol('onContextMenuWhileDragging');
  const onMouseDown = Symbol('onMouseDown');
  const onMouseMove = Symbol('onMouseMove');
  const onMouseUp = Symbol('onMouseUp');
  const startDrag$1 = Symbol('startDrag');
  const onDistanceChange$1 = Symbol('onDistanceChange');

  class MouseSensor extends Sensor {

    constructor(containers = [], options = {}) {
      super(containers, options);

      this.mouseDownTimeout = null;

      this.pageX = null;

      this.pageY = null;
      this[onContextMenuWhileDragging] = this[onContextMenuWhileDragging].bind(this);
      this[onMouseDown] = this[onMouseDown].bind(this);
      this[onMouseMove] = this[onMouseMove].bind(this);
      this[onMouseUp] = this[onMouseUp].bind(this);
      this[startDrag$1] = this[startDrag$1].bind(this);
      this[onDistanceChange$1] = this[onDistanceChange$1].bind(this);
    }

    attach() {
      document.addEventListener('mousedown', this[onMouseDown], true);
    }

    detach() {
      document.removeEventListener('mousedown', this[onMouseDown], true);
    }

    [onMouseDown](event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey) {
        return;
      }
      const container = closest(event.target, this.containers);
      if (!container) {
        return;
      }
      if (this.options.handle && event.target && !closest(event.target, this.options.handle)) {
        return;
      }
      const originalSource = closest(event.target, this.options.draggable);
      if (!originalSource) {
        return;
      }
      const {
        delay
      } = this;
      const {
        pageX,
        pageY
      } = event;
      Object.assign(this, {
        pageX,
        pageY
      });
      this.onMouseDownAt = Date.now();
      this.startEvent = event;
      this.currentContainer = container;
      this.originalSource = originalSource;
      document.addEventListener('mouseup', this[onMouseUp]);
      document.addEventListener('dragstart', preventNativeDragStart);
      document.addEventListener('mousemove', this[onDistanceChange$1]);
      this.mouseDownTimeout = window.setTimeout(() => {
        this[onDistanceChange$1]({
          pageX: this.pageX,
          pageY: this.pageY
        });
      }, delay.mouse);
    }

    [startDrag$1]() {
      const startEvent = this.startEvent;
      const container = this.currentContainer;
      const originalSource = this.originalSource;
      const dragStartEvent = new DragStartSensorEvent({
        clientX: startEvent.clientX,
        clientY: startEvent.clientY,
        target: startEvent.target,
        container,
        originalSource,
        originalEvent: startEvent
      });
      this.trigger(this.currentContainer, dragStartEvent);
      this.dragging = !dragStartEvent.canceled();
      if (this.dragging) {
        document.addEventListener('contextmenu', this[onContextMenuWhileDragging], true);
        document.addEventListener('mousemove', this[onMouseMove]);
      }
    }

    [onDistanceChange$1](event) {
      const {
        pageX,
        pageY
      } = event;
      const {
        distance: distance$1
      } = this.options;
      const {
        startEvent,
        delay
      } = this;
      Object.assign(this, {
        pageX,
        pageY
      });
      if (!this.currentContainer) {
        return;
      }
      const timeElapsed = Date.now() - this.onMouseDownAt;
      const distanceTravelled = distance(startEvent.pageX, startEvent.pageY, pageX, pageY) || 0;
      clearTimeout(this.mouseDownTimeout);
      if (timeElapsed < delay.mouse) {

        document.removeEventListener('mousemove', this[onDistanceChange$1]);
      } else if (distanceTravelled >= distance$1) {
        document.removeEventListener('mousemove', this[onDistanceChange$1]);
        this[startDrag$1]();
      }
    }

    [onMouseMove](event) {
      if (!this.dragging) {
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const dragMoveEvent = new DragMoveSensorEvent({
        clientX: event.clientX,
        clientY: event.clientY,
        target,
        container: this.currentContainer,
        originalEvent: event
      });
      this.trigger(this.currentContainer, dragMoveEvent);
    }

    [onMouseUp](event) {
      clearTimeout(this.mouseDownTimeout);
      if (event.button !== 0) {
        return;
      }
      document.removeEventListener('mouseup', this[onMouseUp]);
      document.removeEventListener('dragstart', preventNativeDragStart);
      document.removeEventListener('mousemove', this[onDistanceChange$1]);
      if (!this.dragging) {
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const dragStopEvent = new DragStopSensorEvent({
        clientX: event.clientX,
        clientY: event.clientY,
        target,
        container: this.currentContainer,
        originalEvent: event
      });
      this.trigger(this.currentContainer, dragStopEvent);
      document.removeEventListener('contextmenu', this[onContextMenuWhileDragging], true);
      document.removeEventListener('mousemove', this[onMouseMove]);
      this.currentContainer = null;
      this.dragging = false;
      this.startEvent = null;
    }

    [onContextMenuWhileDragging](event) {
      event.preventDefault();
    }
  }
  function preventNativeDragStart(event) {
    event.preventDefault();
  }

  function touchCoords(event) {
    const {
      touches,
      changedTouches
    } = event;
    return touches && touches[0] || changedTouches && changedTouches[0];
  }

  const onTouchStart = Symbol('onTouchStart');
  const onTouchEnd = Symbol('onTouchEnd');
  const onTouchMove = Symbol('onTouchMove');
  const startDrag = Symbol('startDrag');
  const onDistanceChange = Symbol('onDistanceChange');

  let preventScrolling = false;

  window.addEventListener('touchmove', event => {
    if (!preventScrolling) {
      return;
    }

    event.preventDefault();
  }, {
    passive: false
  });

  class TouchSensor extends Sensor {

    constructor(containers = [], options = {}) {
      super(containers, options);

      this.currentScrollableParent = null;

      this.tapTimeout = null;

      this.touchMoved = false;

      this.pageX = null;

      this.pageY = null;
      this[onTouchStart] = this[onTouchStart].bind(this);
      this[onTouchEnd] = this[onTouchEnd].bind(this);
      this[onTouchMove] = this[onTouchMove].bind(this);
      this[startDrag] = this[startDrag].bind(this);
      this[onDistanceChange] = this[onDistanceChange].bind(this);
    }

    attach() {
      document.addEventListener('touchstart', this[onTouchStart]);
    }

    detach() {
      document.removeEventListener('touchstart', this[onTouchStart]);
    }

    [onTouchStart](event) {
      const container = closest(event.target, this.containers);
      if (!container) {
        return;
      }
      if (this.options.handle && event.target && !closest(event.target, this.options.handle)) {
        return;
      }
      const originalSource = closest(event.target, this.options.draggable);
      if (!originalSource) {
        return;
      }
      const {
        distance = 0
      } = this.options;
      const {
        delay
      } = this;
      const {
        pageX,
        pageY
      } = touchCoords(event);
      Object.assign(this, {
        pageX,
        pageY
      });
      this.onTouchStartAt = Date.now();
      this.startEvent = event;
      this.currentContainer = container;
      this.originalSource = originalSource;
      document.addEventListener('touchend', this[onTouchEnd]);
      document.addEventListener('touchcancel', this[onTouchEnd]);
      document.addEventListener('touchmove', this[onDistanceChange]);
      container.addEventListener('contextmenu', onContextMenu);
      if (distance) {
        preventScrolling = true;
      }
      this.tapTimeout = window.setTimeout(() => {
        this[onDistanceChange]({
          touches: [{
            pageX: this.pageX,
            pageY: this.pageY
          }]
        });
      }, delay.touch);
    }

    [startDrag]() {
      const startEvent = this.startEvent;
      const container = this.currentContainer;
      const touch = touchCoords(startEvent);
      const originalSource = this.originalSource;
      const dragStartEvent = new DragStartSensorEvent({
        clientX: touch.pageX,
        clientY: touch.pageY,
        target: startEvent.target,
        container,
        originalSource,
        originalEvent: startEvent
      });
      this.trigger(this.currentContainer, dragStartEvent);
      this.dragging = !dragStartEvent.canceled();
      if (this.dragging) {
        document.addEventListener('touchmove', this[onTouchMove]);
      }
      preventScrolling = this.dragging;
    }

    [onDistanceChange](event) {
      const {
        distance: distance$1
      } = this.options;
      const {
        startEvent,
        delay
      } = this;
      const start = touchCoords(startEvent);
      const current = touchCoords(event);
      const timeElapsed = Date.now() - this.onTouchStartAt;
      const distanceTravelled = distance(start.pageX, start.pageY, current.pageX, current.pageY);
      Object.assign(this, current);
      clearTimeout(this.tapTimeout);
      if (timeElapsed < delay.touch) {

        document.removeEventListener('touchmove', this[onDistanceChange]);
      } else if (distanceTravelled >= distance$1) {
        document.removeEventListener('touchmove', this[onDistanceChange]);
        this[startDrag]();
      }
    }

    [onTouchMove](event) {
      if (!this.dragging) {
        return;
      }
      const {
        pageX,
        pageY
      } = touchCoords(event);
      const target = document.elementFromPoint(pageX - window.scrollX, pageY - window.scrollY);
      const dragMoveEvent = new DragMoveSensorEvent({
        clientX: pageX,
        clientY: pageY,
        target,
        container: this.currentContainer,
        originalEvent: event
      });
      this.trigger(this.currentContainer, dragMoveEvent);
    }

    [onTouchEnd](event) {
      clearTimeout(this.tapTimeout);
      preventScrolling = false;
      document.removeEventListener('touchend', this[onTouchEnd]);
      document.removeEventListener('touchcancel', this[onTouchEnd]);
      document.removeEventListener('touchmove', this[onDistanceChange]);
      if (this.currentContainer) {
        this.currentContainer.removeEventListener('contextmenu', onContextMenu);
      }
      if (!this.dragging) {
        return;
      }
      document.removeEventListener('touchmove', this[onTouchMove]);
      const {
        pageX,
        pageY
      } = touchCoords(event);
      const target = document.elementFromPoint(pageX - window.scrollX, pageY - window.scrollY);
      event.preventDefault();
      const dragStopEvent = new DragStopSensorEvent({
        clientX: pageX,
        clientY: pageY,
        target,
        container: this.currentContainer,
        originalEvent: event
      });
      this.trigger(this.currentContainer, dragStopEvent);
      this.currentContainer = null;
      this.dragging = false;
      this.startEvent = null;
    }
  }
  function onContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  class CollidableEvent extends AbstractEvent {

    constructor(data) {
      super(data);
      this.data = data;
    }

    get dragEvent() {
      return this.data.dragEvent;
    }
  }
  CollidableEvent.type = 'collidable';

  class CollidableInEvent extends CollidableEvent {

    get collidingElement() {
      return this.data.collidingElement;
    }
  }
  CollidableInEvent.type = 'collidable:in';

  class CollidableOutEvent extends CollidableEvent {

    get collidingElement() {
      return this.data.collidingElement;
    }
  }
  CollidableOutEvent.type = 'collidable:out';

  function createAddInitializerMethod(e, t) {
    return function (r) {
      assertNotFinished(t, "addInitializer"), assertCallable(r, "An initializer"), e.push(r);
    };
  }
  function assertInstanceIfPrivate(e, t) {
    if (!e(t)) throw new TypeError("Attempted to access private element on non-instance");
  }
  function memberDec(e, t, r, a, n, i, s, o, c, l, u) {
    var f;
    switch (i) {
      case 1:
        f = "accessor";
        break;
      case 2:
        f = "method";
        break;
      case 3:
        f = "getter";
        break;
      case 4:
        f = "setter";
        break;
      default:
        f = "field";
    }
    var d,
      p,
      h = {
        kind: f,
        name: o ? "#" + r : r,
        static: s,
        private: o,
        metadata: u
      },
      v = {
        v: !1
      };
    if (0 !== i && (h.addInitializer = createAddInitializerMethod(n, v)), o || 0 !== i && 2 !== i) {
      if (2 === i) d = function (e) {
        return assertInstanceIfPrivate(l, e), a.value;
      };else {
        var y = 0 === i || 1 === i;
        (y || 3 === i) && (d = o ? function (e) {
          return assertInstanceIfPrivate(l, e), a.get.call(e);
        } : function (e) {
          return a.get.call(e);
        }), (y || 4 === i) && (p = o ? function (e, t) {
          assertInstanceIfPrivate(l, e), a.set.call(e, t);
        } : function (e, t) {
          a.set.call(e, t);
        });
      }
    } else d = function (e) {
      return e[r];
    }, 0 === i && (p = function (e, t) {
      e[r] = t;
    });
    var m = o ? l.bind() : function (e) {
      return r in e;
    };
    h.access = d && p ? {
      get: d,
      set: p,
      has: m
    } : d ? {
      get: d,
      has: m
    } : {
      set: p,
      has: m
    };
    try {
      return e.call(t, c, h);
    } finally {
      v.v = !0;
    }
  }
  function assertNotFinished(e, t) {
    if (e.v) throw new Error("attempted to call " + t + " after decoration was finished");
  }
  function assertCallable(e, t) {
    if ("function" != typeof e) throw new TypeError(t + " must be a function");
  }
  function assertValidReturnValue(e, t) {
    var r = typeof t;
    if (1 === e) {
      if ("object" !== r || null === t) throw new TypeError("accessor decorators must return an object with get, set, or init properties or void 0");
      void 0 !== t.get && assertCallable(t.get, "accessor.get"), void 0 !== t.set && assertCallable(t.set, "accessor.set"), void 0 !== t.init && assertCallable(t.init, "accessor.init");
    } else if ("function" !== r) {
      var a;
      throw a = 0 === e ? "field" : 5 === e ? "class" : "method", new TypeError(a + " decorators must return a function or void 0");
    }
  }
  function curryThis1(e) {
    return function () {
      return e(this);
    };
  }
  function curryThis2(e) {
    return function (t) {
      e(this, t);
    };
  }
  function applyMemberDec(e, t, r, a, n, i, s, o, c, l, u) {
    var f,
      d,
      p,
      h,
      v,
      y,
      m = r[0];
    a || Array.isArray(m) || (m = [m]), o ? f = 0 === i || 1 === i ? {
      get: curryThis1(r[3]),
      set: curryThis2(r[4])
    } : 3 === i ? {
      get: r[3]
    } : 4 === i ? {
      set: r[3]
    } : {
      value: r[3]
    } : 0 !== i && (f = Object.getOwnPropertyDescriptor(t, n)), 1 === i ? p = {
      get: f.get,
      set: f.set
    } : 2 === i ? p = f.value : 3 === i ? p = f.get : 4 === i && (p = f.set);
    for (var g = a ? 2 : 1, b = m.length - 1; b >= 0; b -= g) {
      var I;
      if (void 0 !== (h = memberDec(m[b], a ? m[b - 1] : void 0, n, f, c, i, s, o, p, l, u))) assertValidReturnValue(i, h), 0 === i ? I = h : 1 === i ? (I = h.init, v = h.get || p.get, y = h.set || p.set, p = {
        get: v,
        set: y
      }) : p = h, void 0 !== I && (void 0 === d ? d = I : "function" == typeof d ? d = [d, I] : d.push(I));
    }
    if (0 === i || 1 === i) {
      if (void 0 === d) d = function (e, t) {
        return t;
      };else if ("function" != typeof d) {
        var w = d;
        d = function (e, t) {
          for (var r = t, a = w.length - 1; a >= 0; a--) r = w[a].call(e, r);
          return r;
        };
      } else {
        var M = d;
        d = function (e, t) {
          return M.call(e, t);
        };
      }
      e.push(d);
    }
    0 !== i && (1 === i ? (f.get = p.get, f.set = p.set) : 2 === i ? f.value = p : 3 === i ? f.get = p : 4 === i && (f.set = p), o ? 1 === i ? (e.push(function (e, t) {
      return p.get.call(e, t);
    }), e.push(function (e, t) {
      return p.set.call(e, t);
    })) : 2 === i ? e.push(p) : e.push(function (e, t) {
      return p.call(e, t);
    }) : Object.defineProperty(t, n, f));
  }
  function applyMemberDecs(e, t, r, a) {
    for (var n, i, s, o = [], c = new Map(), l = new Map(), u = 0; u < t.length; u++) {
      var f = t[u];
      if (Array.isArray(f)) {
        var d,
          p,
          h = f[1],
          v = f[2],
          y = f.length > 3,
          m = 16 & h,
          g = !!(8 & h),
          b = r;
        if (h &= 7, g ? (d = e, 0 !== h && (p = i = i || []), y && !s && (s = function (t) {
          return _checkInRHS(t) === e;
        }), b = s) : (d = e.prototype, 0 !== h && (p = n = n || [])), 0 !== h && !y) {
          var I = g ? l : c,
            w = I.get(v) || 0;
          if (!0 === w || 3 === w && 4 !== h || 4 === w && 3 !== h) throw new Error("Attempted to decorate a public method/accessor that has the same name as a previously decorated public method/accessor. This is not currently supported by the decorators plugin. Property name was: " + v);
          I.set(v, !(!w && h > 2) || h);
        }
        applyMemberDec(o, d, f, m, v, h, g, y, p, b, a);
      }
    }
    return pushInitializers(o, n), pushInitializers(o, i), o;
  }
  function pushInitializers(e, t) {
    t && e.push(function (e) {
      for (var r = 0; r < t.length; r++) t[r].call(e);
      return e;
    });
  }
  function applyClassDecs(e, t, r, a) {
    if (t.length) {
      for (var n = [], i = e, s = e.name, o = r ? 2 : 1, c = t.length - 1; c >= 0; c -= o) {
        var l = {
          v: !1
        };
        try {
          var u = t[c].call(r ? t[c - 1] : void 0, i, {
            kind: "class",
            name: s,
            addInitializer: createAddInitializerMethod(n, l),
            metadata: a
          });
        } finally {
          l.v = !0;
        }
        void 0 !== u && (assertValidReturnValue(5, u), i = u);
      }
      return [defineMetadata(i, a), function () {
        for (var e = 0; e < n.length; e++) n[e].call(i);
      }];
    }
  }
  function defineMetadata(e, t) {
    return Object.defineProperty(e, Symbol.metadata || Symbol.for("Symbol.metadata"), {
      configurable: !0,
      enumerable: !0,
      value: t
    });
  }
  function _applyDecs2305(e, t, r, a, n, i) {
    if (arguments.length >= 6) var s = i[Symbol.metadata || Symbol.for("Symbol.metadata")];
    var o = Object.create(void 0 === s ? null : s),
      c = applyMemberDecs(e, t, n, o);
    return r.length || defineMetadata(e, o), {
      e: c,
      get c() {
        return applyClassDecs(e, r, a, o);
      }
    };
  }
  function _checkInRHS(e) {
    if (Object(e) !== e) throw TypeError("right-hand side of 'in' should be an object, got " + (null !== e ? typeof e : "null"));
    return e;
  }

  function AutoBind(originalMethod, {
    name,
    addInitializer
  }) {
    addInitializer(function () {

      this[name] = originalMethod.bind(this);

    });
  }

  function requestNextAnimationFrame(callback) {
    return requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  }

  class DragEvent extends AbstractEvent {

    constructor(data) {
      super(data);
      this.data = data;
    }

    get source() {
      return this.data.source;
    }

    get originalSource() {
      return this.data.originalSource;
    }

    get mirror() {
      return this.data.mirror;
    }

    get sourceContainer() {
      return this.data.sourceContainer;
    }

    get sensorEvent() {
      return this.data.sensorEvent;
    }

    get originalEvent() {
      if (this.sensorEvent) {
        return this.sensorEvent.originalEvent;
      }
      return null;
    }
  }

  DragEvent.type = 'drag';
  class DragStartEvent extends DragEvent {}

  DragStartEvent.type = 'drag:start';
  DragStartEvent.cancelable = true;
  class DragMoveEvent extends DragEvent {}

  DragMoveEvent.type = 'drag:move';

  class DragOverEvent extends DragEvent {

    get overContainer() {
      return this.data.overContainer;
    }

    get over() {
      return this.data.over;
    }
  }
  DragOverEvent.type = 'drag:over';
  DragOverEvent.cancelable = true;
  function isDragOverEvent(event) {
    return event.type === DragOverEvent.type;
  }

  class DragOutEvent extends DragEvent {

    get overContainer() {
      return this.data.overContainer;
    }

    get over() {
      return this.data.over;
    }
  }

  DragOutEvent.type = 'drag:out';

  class DragOverContainerEvent extends DragEvent {

    get overContainer() {
      return this.data.overContainer;
    }
  }

  DragOverContainerEvent.type = 'drag:over:container';

  class DragOutContainerEvent extends DragEvent {

    get overContainer() {
      return this.data.overContainer;
    }
  }

  DragOutContainerEvent.type = 'drag:out:container';

  class DragPressureEvent extends DragEvent {

    get pressure() {
      return this.data.pressure;
    }
  }

  DragPressureEvent.type = 'drag:pressure';
  class DragStopEvent extends DragEvent {}

  DragStopEvent.type = 'drag:stop';
  DragStopEvent.cancelable = true;
  class DragStoppedEvent extends DragEvent {}
  DragStoppedEvent.type = 'drag:stopped';

  var _initProto$1, _class$1;

  class ResizeMirror extends AbstractPlugin {

    constructor(draggable) {
      _initProto$1(super(draggable));

      this.lastWidth = 0;

      this.lastHeight = 0;

      this.mirror = null;
    }

    attach() {
      this.draggable.on('mirror:created', this.onMirrorCreated).on('drag:over', this.onDragOver).on('drag:over:container', this.onDragOver);
    }

    detach() {
      this.draggable.off('mirror:created', this.onMirrorCreated).off('mirror:destroy', this.onMirrorDestroy).off('drag:over', this.onDragOver).off('drag:over:container', this.onDragOver);
    }

    getOptions() {
      return this.draggable.options.resizeMirror || {};
    }

    onMirrorCreated({
      mirror
    }) {
      this.mirror = mirror;
    }

    onMirrorDestroy() {
      this.mirror = null;
    }

    onDragOver(dragEvent) {
      this.resize(dragEvent);
    }

    resize(dragEvent) {
      requestAnimationFrame(() => {
        let over = null;
        const {
          overContainer
        } = dragEvent;
        if (this.mirror == null || this.mirror.parentNode == null) {
          return;
        }
        if (this.mirror.parentNode !== overContainer) {
          overContainer.appendChild(this.mirror);
        }
        if (isDragOverEvent(dragEvent)) {
          over = dragEvent.over;
        }
        const overElement = over || this.draggable.getDraggableElementsForContainer(overContainer)[0];
        if (!overElement) {
          return;
        }
        requestNextAnimationFrame(() => {
          const overRect = overElement.getBoundingClientRect();
          if (this.mirror == null || this.lastHeight === overRect.height && this.lastWidth === overRect.width) {
            return;
          }
          this.mirror.style.width = `${overRect.width}px`;
          this.mirror.style.height = `${overRect.height}px`;
          this.lastWidth = overRect.width;
          this.lastHeight = overRect.height;
        });
      });
    }
  }
  _class$1 = ResizeMirror;
  [_initProto$1] = _applyDecs2305(_class$1, [[AutoBind, 2, "onMirrorCreated"], [AutoBind, 2, "onMirrorDestroy"], [AutoBind, 2, "onDragOver"]], [], 0, void 0, AbstractPlugin).e;

  class SnapEvent extends AbstractEvent {

    get dragEvent() {
      return this.data.dragEvent;
    }

    get snappable() {
      return this.data.snappable;
    }
  }

  SnapEvent.type = 'snap';
  class SnapInEvent extends SnapEvent {}

  SnapInEvent.type = 'snap:in';
  SnapInEvent.cancelable = true;
  class SnapOutEvent extends SnapEvent {}
  SnapOutEvent.type = 'snap:out';
  SnapOutEvent.cancelable = true;

  var _initProto, _class;

  const defaultOptions$5 = {
    duration: 150,
    easingFunction: 'ease-in-out',
    horizontal: false
  };

  class SwapAnimation extends AbstractPlugin {

    constructor(draggable) {
      _initProto(super(draggable));

      this.options = {
        ...defaultOptions$5,
        ...this.getOptions()
      };

      this.lastAnimationFrame = null;
    }

    attach() {
      this.draggable.on('sortable:sorted', this.onSortableSorted);
    }

    detach() {
      this.draggable.off('sortable:sorted', this.onSortableSorted);
    }

    getOptions() {
      return this.draggable.options.swapAnimation || {};
    }

    onSortableSorted({
      oldIndex,
      newIndex,
      dragEvent
    }) {
      const {
        source,
        over
      } = dragEvent;
      if (this.lastAnimationFrame) {
        cancelAnimationFrame(this.lastAnimationFrame);
      }

      this.lastAnimationFrame = requestAnimationFrame(() => {
        if (oldIndex >= newIndex) {
          animate(source, over, this.options);
        } else {
          animate(over, source, this.options);
        }
      });
    }
  }

  _class = SwapAnimation;
  [_initProto] = _applyDecs2305(_class, [[AutoBind, 2, "onSortableSorted"]], [], 0, void 0, AbstractPlugin).e;
  function animate(from, to, {
    duration,
    easingFunction,
    horizontal
  }) {
    for (const element of [from, to]) {
      element.style.pointerEvents = 'none';
    }
    if (horizontal) {
      const width = from.offsetWidth;
      from.style.transform = `translate3d(${width}px, 0, 0)`;
      to.style.transform = `translate3d(-${width}px, 0, 0)`;
    } else {
      const height = from.offsetHeight;
      from.style.transform = `translate3d(0, ${height}px, 0)`;
      to.style.transform = `translate3d(0, -${height}px, 0)`;
    }
    requestAnimationFrame(() => {
      for (const element of [from, to]) {
        element.addEventListener('transitionend', resetElementOnTransitionEnd);
        element.style.transition = `transform ${duration}ms ${easingFunction}`;
        element.style.transform = '';
      }
    });
  }

  function resetElementOnTransitionEnd(event) {
    if (event.target == null || !isHTMLElement(event.target)) {
      return;
    }
    event.target.style.transition = '';
    event.target.style.pointerEvents = '';
    event.target.removeEventListener('transitionend', resetElementOnTransitionEnd);
  }
  function isHTMLElement(eventTarget) {
    return Boolean('style' in eventTarget);
  }

  const onInitialize$1 = Symbol('onInitialize');
  const onDestroy$1 = Symbol('onDestroy');
  const announceEvent = Symbol('announceEvent');
  const announceMessage = Symbol('announceMessage');
  const ARIA_RELEVANT = 'aria-relevant';
  const ARIA_ATOMIC = 'aria-atomic';
  const ARIA_LIVE = 'aria-live';
  const ROLE = 'role';

  const defaultOptions$4 = {
    expire: 7000
  };

  class Announcement extends AbstractPlugin {

    constructor(draggable) {
      super(draggable);

      this.options = {
        ...defaultOptions$4,
        ...this.getOptions()
      };

      this.originalTriggerMethod = this.draggable.trigger;
      this[onInitialize$1] = this[onInitialize$1].bind(this);
      this[onDestroy$1] = this[onDestroy$1].bind(this);
    }

    attach() {
      this.draggable.on('draggable:initialize', this[onInitialize$1]);
    }

    detach() {
      this.draggable.off('draggable:destroy', this[onDestroy$1]);
    }

    getOptions() {
      return this.draggable.options.announcements || {};
    }

    [announceEvent](event) {
      const message = this.options[event.type];
      if (message && typeof message === 'string') {
        this[announceMessage](message);
      }
      if (message && typeof message === 'function') {
        this[announceMessage](message(event));
      }
    }

    [announceMessage](message) {
      announce(message, {
        expire: this.options.expire
      });
    }

    [onInitialize$1]() {

      this.draggable.trigger = event => {
        try {
          this[announceEvent](event);
        } finally {

          this.originalTriggerMethod.call(this.draggable, event);
        }
      };
    }

    [onDestroy$1]() {
      this.draggable.trigger = this.originalTriggerMethod;
    }
  }

  const liveRegion = createRegion();

  function announce(message, {
    expire
  }) {
    const element = document.createElement('div');
    element.textContent = message;
    liveRegion.appendChild(element);
    return setTimeout(() => {
      liveRegion.removeChild(element);
    }, expire);
  }

  function createRegion() {
    const element = document.createElement('div');
    element.setAttribute('id', 'draggable-live-region');
    element.setAttribute(ARIA_RELEVANT, 'additions');
    element.setAttribute(ARIA_ATOMIC, 'true');
    element.setAttribute(ARIA_LIVE, 'assertive');
    element.setAttribute(ROLE, 'log');
    element.style.position = 'fixed';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.top = '-1px';
    element.style.overflow = 'hidden';
    return element;
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(liveRegion);
  });

  const onInitialize = Symbol('onInitialize');
  const onDestroy = Symbol('onDestroy');

  const defaultOptions$3 = {};

  class Focusable extends AbstractPlugin {

    constructor(draggable) {
      super(draggable);

      this.options = {
        ...defaultOptions$3,
        ...this.getOptions()
      };
      this[onInitialize] = this[onInitialize].bind(this);
      this[onDestroy] = this[onDestroy].bind(this);
    }

    attach() {
      this.draggable.on('draggable:initialize', this[onInitialize]).on('draggable:destroy', this[onDestroy]);
    }

    detach() {
      this.draggable.off('draggable:initialize', this[onInitialize]).off('draggable:destroy', this[onDestroy]);

      this[onDestroy]();
    }

    getOptions() {
      return this.draggable.options.focusable || {};
    }

    getElements() {
      return [...this.draggable.containers, ...this.draggable.getDraggableElements()];
    }

    [onInitialize]() {

      requestAnimationFrame(() => {
        this.getElements().forEach(element => decorateElement(element));
      });
    }

    [onDestroy]() {

      requestAnimationFrame(() => {
        this.getElements().forEach(element => stripElement(element));
      });
    }
  }

  const elementsWithMissingTabIndex = [];

  function decorateElement(element) {
    const hasMissingTabIndex = Boolean(!element.getAttribute('tabindex') && element.tabIndex === -1);
    if (hasMissingTabIndex) {
      elementsWithMissingTabIndex.push(element);
      element.tabIndex = 0;
    }
  }

  function stripElement(element) {
    const tabIndexElementPosition = elementsWithMissingTabIndex.indexOf(element);
    if (tabIndexElementPosition !== -1) {
      element.tabIndex = -1;
      elementsWithMissingTabIndex.splice(tabIndexElementPosition, 1);
    }
  }

  class MirrorEvent extends AbstractEvent {

    constructor(data) {
      super(data);
      this.data = data;
    }

    get source() {
      return this.data.source;
    }

    get originalSource() {
      return this.data.originalSource;
    }

    get sourceContainer() {
      return this.data.sourceContainer;
    }

    get sensorEvent() {
      return this.data.sensorEvent;
    }

    get dragEvent() {
      return this.data.dragEvent;
    }

    get originalEvent() {
      if (this.sensorEvent) {
        return this.sensorEvent.originalEvent;
      }
      return null;
    }
  }

  class MirrorCreateEvent extends MirrorEvent {}
  MirrorCreateEvent.type = 'mirror:create';

  class MirrorCreatedEvent extends MirrorEvent {

    get mirror() {
      return this.data.mirror;
    }
  }
  MirrorCreatedEvent.type = 'mirror:created';

  class MirrorAttachedEvent extends MirrorEvent {

    get mirror() {
      return this.data.mirror;
    }
  }
  MirrorAttachedEvent.type = 'mirror:attached';

  class MirrorMoveEvent extends MirrorEvent {

    get mirror() {
      return this.data.mirror;
    }

    get passedThreshX() {
      return this.data.passedThreshX;
    }

    get passedThreshY() {
      return this.data.passedThreshY;
    }
  }
  MirrorMoveEvent.type = 'mirror:move';
  MirrorMoveEvent.cancelable = true;

  class MirrorMovedEvent extends MirrorEvent {

    get mirror() {
      return this.data.mirror;
    }

    get passedThreshX() {
      return this.data.passedThreshX;
    }

    get passedThreshY() {
      return this.data.passedThreshY;
    }
  }
  MirrorMovedEvent.type = 'mirror:moved';

  class MirrorDestroyEvent extends MirrorEvent {

    get mirror() {
      return this.data.mirror;
    }
  }
  MirrorDestroyEvent.type = 'mirror:destroy';
  MirrorDestroyEvent.cancelable = true;

  const onDragStart$3 = Symbol('onDragStart');
  const onDragMove$2 = Symbol('onDragMove');
  const onDragStop$3 = Symbol('onDragStop');
  const onMirrorCreated = Symbol('onMirrorCreated');
  const onMirrorMove = Symbol('onMirrorMove');
  const onScroll = Symbol('onScroll');
  const getAppendableContainer = Symbol('getAppendableContainer');

  const defaultOptions$2 = {
    constrainDimensions: false,
    xAxis: true,
    yAxis: true,
    cursorOffsetX: null,
    cursorOffsetY: null,
    thresholdX: null,
    thresholdY: null
  };

  class Mirror extends AbstractPlugin {

    constructor(draggable) {
      super(draggable);

      this.options = {
        ...defaultOptions$2,
        ...this.getOptions()
      };

      this.scrollOffset = {
        x: 0,
        y: 0
      };

      this.initialScrollOffset = {
        x: window.scrollX,
        y: window.scrollY
      };
      this[onDragStart$3] = this[onDragStart$3].bind(this);
      this[onDragMove$2] = this[onDragMove$2].bind(this);
      this[onDragStop$3] = this[onDragStop$3].bind(this);
      this[onMirrorCreated] = this[onMirrorCreated].bind(this);
      this[onMirrorMove] = this[onMirrorMove].bind(this);
      this[onScroll] = this[onScroll].bind(this);
    }

    attach() {
      this.draggable.on('drag:start', this[onDragStart$3]).on('drag:move', this[onDragMove$2]).on('drag:stop', this[onDragStop$3]).on('mirror:created', this[onMirrorCreated]).on('mirror:move', this[onMirrorMove]);
    }

    detach() {
      this.draggable.off('drag:start', this[onDragStart$3]).off('drag:move', this[onDragMove$2]).off('drag:stop', this[onDragStop$3]).off('mirror:created', this[onMirrorCreated]).off('mirror:move', this[onMirrorMove]);
    }

    getOptions() {
      return this.draggable.options.mirror || {};
    }
    [onDragStart$3](dragEvent) {
      if (dragEvent.canceled()) {
        return;
      }
      if ('ontouchstart' in window) {
        document.addEventListener('scroll', this[onScroll], true);
      }
      this.initialScrollOffset = {
        x: window.scrollX,
        y: window.scrollY
      };
      const {
        source,
        originalSource,
        sourceContainer,
        sensorEvent
      } = dragEvent;

      this.lastMirrorMovedClient = {
        x: sensorEvent.clientX,
        y: sensorEvent.clientY
      };
      const mirrorCreateEvent = new MirrorCreateEvent({
        source,
        originalSource,
        sourceContainer,
        sensorEvent,
        dragEvent
      });
      this.draggable.trigger(mirrorCreateEvent);
      if (isNativeDragEvent(sensorEvent) || mirrorCreateEvent.canceled()) {
        return;
      }
      const appendableContainer = this[getAppendableContainer](source) || sourceContainer;
      this.mirror = source.cloneNode(true);
      const mirrorCreatedEvent = new MirrorCreatedEvent({
        source,
        originalSource,
        sourceContainer,
        sensorEvent,
        dragEvent,
        mirror: this.mirror
      });
      const mirrorAttachedEvent = new MirrorAttachedEvent({
        source,
        originalSource,
        sourceContainer,
        sensorEvent,
        dragEvent,
        mirror: this.mirror
      });
      this.draggable.trigger(mirrorCreatedEvent);
      appendableContainer.appendChild(this.mirror);
      this.draggable.trigger(mirrorAttachedEvent);
    }
    [onDragMove$2](dragEvent) {
      if (!this.mirror || dragEvent.canceled()) {
        return;
      }
      const {
        source,
        originalSource,
        sourceContainer,
        sensorEvent
      } = dragEvent;
      let passedThreshX = true;
      let passedThreshY = true;
      if (this.options.thresholdX || this.options.thresholdY) {
        const {
          x: lastX,
          y: lastY
        } = this.lastMirrorMovedClient;
        if (Math.abs(lastX - sensorEvent.clientX) < this.options.thresholdX) {
          passedThreshX = false;
        } else {
          this.lastMirrorMovedClient.x = sensorEvent.clientX;
        }
        if (Math.abs(lastY - sensorEvent.clientY) < this.options.thresholdY) {
          passedThreshY = false;
        } else {
          this.lastMirrorMovedClient.y = sensorEvent.clientY;
        }
        if (!passedThreshX && !passedThreshY) {
          return;
        }
      }
      const mirrorMoveEvent = new MirrorMoveEvent({
        source,
        originalSource,
        sourceContainer,
        sensorEvent,
        dragEvent,
        mirror: this.mirror,
        passedThreshX,
        passedThreshY
      });
      this.draggable.trigger(mirrorMoveEvent);
    }
    [onDragStop$3](dragEvent) {
      if ('ontouchstart' in window) {
        document.removeEventListener('scroll', this[onScroll], true);
      }
      this.initialScrollOffset = {
        x: 0,
        y: 0
      };
      this.scrollOffset = {
        x: 0,
        y: 0
      };
      if (!this.mirror) {
        return;
      }
      const {
        source,
        sourceContainer,
        sensorEvent
      } = dragEvent;
      const mirrorDestroyEvent = new MirrorDestroyEvent({
        source,
        mirror: this.mirror,
        sourceContainer,
        sensorEvent,
        dragEvent
      });
      this.draggable.trigger(mirrorDestroyEvent);
      if (!mirrorDestroyEvent.canceled()) {
        this.mirror.remove();
      }
    }
    [onScroll]() {
      this.scrollOffset = {
        x: window.scrollX - this.initialScrollOffset.x,
        y: window.scrollY - this.initialScrollOffset.y
      };
    }

    [onMirrorCreated]({
      mirror,
      source,
      sensorEvent
    }) {
      const mirrorClasses = this.draggable.getClassNamesFor('mirror');
      const setState = ({
        mirrorOffset,
        initialX,
        initialY,
        ...args
      }) => {
        this.mirrorOffset = mirrorOffset;
        this.initialX = initialX;
        this.initialY = initialY;
        this.lastMovedX = initialX;
        this.lastMovedY = initialY;
        return {
          mirrorOffset,
          initialX,
          initialY,
          ...args
        };
      };
      mirror.style.display = 'none';
      const initialState = {
        mirror,
        source,
        sensorEvent,
        mirrorClasses,
        scrollOffset: this.scrollOffset,
        options: this.options,
        passedThreshX: true,
        passedThreshY: true
      };
      return Promise.resolve(initialState)

      .then(computeMirrorDimensions).then(calculateMirrorOffset).then(resetMirror).then(addMirrorClasses).then(positionMirror({
        initial: true
      })).then(removeMirrorID).then(setState);
    }

    [onMirrorMove](mirrorEvent) {
      if (mirrorEvent.canceled()) {
        return null;
      }
      const setState = ({
        lastMovedX,
        lastMovedY,
        ...args
      }) => {
        this.lastMovedX = lastMovedX;
        this.lastMovedY = lastMovedY;
        return {
          lastMovedX,
          lastMovedY,
          ...args
        };
      };
      const triggerMoved = args => {
        const mirrorMovedEvent = new MirrorMovedEvent({
          source: mirrorEvent.source,
          originalSource: mirrorEvent.originalSource,
          sourceContainer: mirrorEvent.sourceContainer,
          sensorEvent: mirrorEvent.sensorEvent,
          dragEvent: mirrorEvent.dragEvent,
          mirror: this.mirror,
          passedThreshX: mirrorEvent.passedThreshX,
          passedThreshY: mirrorEvent.passedThreshY
        });
        this.draggable.trigger(mirrorMovedEvent);
        return args;
      };
      const initialState = {
        mirror: mirrorEvent.mirror,
        sensorEvent: mirrorEvent.sensorEvent,
        mirrorOffset: this.mirrorOffset,
        options: this.options,
        initialX: this.initialX,
        initialY: this.initialY,
        scrollOffset: this.scrollOffset,
        passedThreshX: mirrorEvent.passedThreshX,
        passedThreshY: mirrorEvent.passedThreshY,
        lastMovedX: this.lastMovedX,
        lastMovedY: this.lastMovedY
      };
      return Promise.resolve(initialState).then(positionMirror({
        raf: true
      })).then(setState).then(triggerMoved);
    }

    [getAppendableContainer](source) {
      const appendTo = this.options.appendTo;
      if (typeof appendTo === 'string') {
        return document.querySelector(appendTo);
      } else if (appendTo instanceof HTMLElement) {
        return appendTo;
      } else if (typeof appendTo === 'function') {
        return appendTo(source);
      } else {
        return source.parentNode;
      }
    }
  }

  function computeMirrorDimensions({
    source,
    ...args
  }) {
    return withPromise(resolve => {
      const sourceRect = source.getBoundingClientRect();
      resolve({
        source,
        sourceRect,
        ...args
      });
    });
  }

  function calculateMirrorOffset({
    sensorEvent,
    sourceRect,
    options,
    ...args
  }) {
    return withPromise(resolve => {
      const top = options.cursorOffsetY === null ? sensorEvent.clientY - sourceRect.top : options.cursorOffsetY;
      const left = options.cursorOffsetX === null ? sensorEvent.clientX - sourceRect.left : options.cursorOffsetX;
      const mirrorOffset = {
        top,
        left
      };
      resolve({
        sensorEvent,
        sourceRect,
        mirrorOffset,
        options,
        ...args
      });
    });
  }

  function resetMirror({
    mirror,
    source,
    options,
    ...args
  }) {
    return withPromise(resolve => {
      let offsetHeight;
      let offsetWidth;
      if (options.constrainDimensions) {
        const computedSourceStyles = getComputedStyle(source);
        offsetHeight = computedSourceStyles.getPropertyValue('height');
        offsetWidth = computedSourceStyles.getPropertyValue('width');
      }
      mirror.style.display = null;
      mirror.style.position = 'fixed';
      mirror.style.pointerEvents = 'none';
      mirror.style.top = 0;
      mirror.style.left = 0;
      mirror.style.margin = 0;
      if (options.constrainDimensions) {
        mirror.style.height = offsetHeight;
        mirror.style.width = offsetWidth;
      }
      resolve({
        mirror,
        source,
        options,
        ...args
      });
    });
  }

  function addMirrorClasses({
    mirror,
    mirrorClasses,
    ...args
  }) {
    return withPromise(resolve => {
      mirror.classList.add(...mirrorClasses);
      resolve({
        mirror,
        mirrorClasses,
        ...args
      });
    });
  }

  function removeMirrorID({
    mirror,
    ...args
  }) {
    return withPromise(resolve => {
      mirror.removeAttribute('id');
      delete mirror.id;
      resolve({
        mirror,
        ...args
      });
    });
  }

  function positionMirror({
    withFrame = false,
    initial = false
  } = {}) {
    return ({
      mirror,
      sensorEvent,
      mirrorOffset,
      initialY,
      initialX,
      scrollOffset,
      options,
      passedThreshX,
      passedThreshY,
      lastMovedX,
      lastMovedY,
      ...args
    }) => {
      return withPromise(resolve => {
        const result = {
          mirror,
          sensorEvent,
          mirrorOffset,
          options,
          ...args
        };
        if (mirrorOffset) {
          const x = passedThreshX ? Math.round((sensorEvent.clientX - mirrorOffset.left - scrollOffset.x) / (options.thresholdX || 1)) * (options.thresholdX || 1) : Math.round(lastMovedX);
          const y = passedThreshY ? Math.round((sensorEvent.clientY - mirrorOffset.top - scrollOffset.y) / (options.thresholdY || 1)) * (options.thresholdY || 1) : Math.round(lastMovedY);
          if (options.xAxis && options.yAxis || initial) {
            mirror.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          } else if (options.xAxis && !options.yAxis) {
            mirror.style.transform = `translate3d(${x}px, ${initialY}px, 0)`;
          } else if (options.yAxis && !options.xAxis) {
            mirror.style.transform = `translate3d(${initialX}px, ${y}px, 0)`;
          }
          if (initial) {
            result.initialX = x;
            result.initialY = y;
          }
          result.lastMovedX = x;
          result.lastMovedY = y;
        }
        resolve(result);
      }, {
        frame: withFrame
      });
    };
  }

  function withPromise(callback, {
    raf = false
  } = {}) {
    return new Promise((resolve, reject) => {
      if (raf) {
        requestAnimationFrame(() => {
          callback(resolve, reject);
        });
      } else {
        callback(resolve, reject);
      }
    });
  }

  function isNativeDragEvent(sensorEvent) {
    return /^drag/.test(sensorEvent.originalEvent.type);
  }

  const onDragStart$2 = Symbol('onDragStart');
  const onDragMove$1 = Symbol('onDragMove');
  const onDragStop$2 = Symbol('onDragStop');
  const scroll = Symbol('scroll');

  const defaultOptions$1 = {
    speed: 6,
    sensitivity: 50,
    scrollableElements: []
  };

  class Scrollable extends AbstractPlugin {

    constructor(draggable) {
      super(draggable);

      this.options = {
        ...defaultOptions$1,
        ...this.getOptions()
      };

      this.currentMousePosition = null;

      this.scrollAnimationFrame = null;

      this.scrollableElement = null;

      this.findScrollableElementFrame = null;
      this[onDragStart$2] = this[onDragStart$2].bind(this);
      this[onDragMove$1] = this[onDragMove$1].bind(this);
      this[onDragStop$2] = this[onDragStop$2].bind(this);
      this[scroll] = this[scroll].bind(this);
    }

    attach() {
      this.draggable.on('drag:start', this[onDragStart$2]).on('drag:move', this[onDragMove$1]).on('drag:stop', this[onDragStop$2]);
    }

    detach() {
      this.draggable.off('drag:start', this[onDragStart$2]).off('drag:move', this[onDragMove$1]).off('drag:stop', this[onDragStop$2]);
    }

    getOptions() {
      return this.draggable.options.scrollable || {};
    }

    getScrollableElement(target) {
      if (this.hasDefinedScrollableElements()) {
        return closest(target, this.options.scrollableElements) || document.documentElement;
      } else {
        return closestScrollableElement(target);
      }
    }

    hasDefinedScrollableElements() {
      return Boolean(this.options.scrollableElements.length !== 0);
    }

    [onDragStart$2](dragEvent) {
      this.findScrollableElementFrame = requestAnimationFrame(() => {
        this.scrollableElement = this.getScrollableElement(dragEvent.source);
      });
    }

    [onDragMove$1](dragEvent) {
      this.findScrollableElementFrame = requestAnimationFrame(() => {
        this.scrollableElement = this.getScrollableElement(dragEvent.sensorEvent.target);
      });
      if (!this.scrollableElement) {
        return;
      }
      const sensorEvent = dragEvent.sensorEvent;
      const scrollOffset = {
        x: 0,
        y: 0
      };
      if ('ontouchstart' in window) {
        scrollOffset.y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        scrollOffset.x = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
      }
      this.currentMousePosition = {
        clientX: sensorEvent.clientX - scrollOffset.x,
        clientY: sensorEvent.clientY - scrollOffset.y
      };
      this.scrollAnimationFrame = requestAnimationFrame(this[scroll]);
    }

    [onDragStop$2]() {
      cancelAnimationFrame(this.scrollAnimationFrame);
      cancelAnimationFrame(this.findScrollableElementFrame);
      this.scrollableElement = null;
      this.scrollAnimationFrame = null;
      this.findScrollableElementFrame = null;
      this.currentMousePosition = null;
    }

    [scroll]() {
      if (!this.scrollableElement || !this.currentMousePosition) {
        return;
      }
      cancelAnimationFrame(this.scrollAnimationFrame);
      const {
        speed,
        sensitivity
      } = this.options;
      const rect = this.scrollableElement.getBoundingClientRect();
      const bottomCutOff = rect.bottom > window.innerHeight;
      const topCutOff = rect.top < 0;
      const cutOff = topCutOff || bottomCutOff;
      const documentScrollingElement = getDocumentScrollingElement();
      const scrollableElement = this.scrollableElement;
      const clientX = this.currentMousePosition.clientX;
      const clientY = this.currentMousePosition.clientY;
      if (scrollableElement !== document.body && scrollableElement !== document.documentElement && !cutOff) {
        const {
          offsetHeight,
          offsetWidth
        } = scrollableElement;
        if (rect.top + offsetHeight - clientY < sensitivity) {
          scrollableElement.scrollTop += speed;
        } else if (clientY - rect.top < sensitivity) {
          scrollableElement.scrollTop -= speed;
        }
        if (rect.left + offsetWidth - clientX < sensitivity) {
          scrollableElement.scrollLeft += speed;
        } else if (clientX - rect.left < sensitivity) {
          scrollableElement.scrollLeft -= speed;
        }
      } else {
        const {
          innerHeight,
          innerWidth
        } = window;
        if (clientY < sensitivity) {
          documentScrollingElement.scrollTop -= speed;
        } else if (innerHeight - clientY < sensitivity) {
          documentScrollingElement.scrollTop += speed;
        }
        if (clientX < sensitivity) {
          documentScrollingElement.scrollLeft -= speed;
        } else if (innerWidth - clientX < sensitivity) {
          documentScrollingElement.scrollLeft += speed;
        }
      }
      this.scrollAnimationFrame = requestAnimationFrame(this[scroll]);
    }
  }

  function hasOverflow(element) {
    const overflowRegex = /(auto|scroll)/;
    const computedStyles = getComputedStyle(element, null);
    const overflow = computedStyles.getPropertyValue('overflow') + computedStyles.getPropertyValue('overflow-y') + computedStyles.getPropertyValue('overflow-x');
    return overflowRegex.test(overflow);
  }

  function isStaticallyPositioned(element) {
    const position = getComputedStyle(element).getPropertyValue('position');
    return position === 'static';
  }

  function closestScrollableElement(element) {
    if (!element) {
      return getDocumentScrollingElement();
    }
    const position = getComputedStyle(element).getPropertyValue('position');
    const excludeStaticParents = position === 'absolute';
    const scrollableElement = closest(element, parent => {
      if (excludeStaticParents && isStaticallyPositioned(parent)) {
        return false;
      }
      return hasOverflow(parent);
    });
    if (position === 'fixed' || !scrollableElement) {
      return getDocumentScrollingElement();
    } else {
      return scrollableElement;
    }
  }

  function getDocumentScrollingElement() {
    return document.scrollingElement || document.documentElement;
  }

  class Emitter {
    constructor() {
      this.callbacks = {};
    }

    on(type, ...callbacks) {
      if (!this.callbacks[type]) {
        this.callbacks[type] = [];
      }
      this.callbacks[type].push(...callbacks);
      return this;
    }

    off(type, callback) {
      if (!this.callbacks[type]) {
        return null;
      }
      const copy = this.callbacks[type].slice(0);
      for (let i = 0; i < copy.length; i++) {
        if (callback === copy[i]) {
          this.callbacks[type].splice(i, 1);
        }
      }
      return this;
    }

    trigger(event) {
      if (!this.callbacks[event.type]) {
        return null;
      }
      const callbacks = [...this.callbacks[event.type]];
      const caughtErrors = [];
      for (let i = callbacks.length - 1; i >= 0; i--) {
        const callback = callbacks[i];
        try {
          callback(event);
        } catch (error) {
          caughtErrors.push(error);
        }
      }
      if (caughtErrors.length) {

        console.error(`Draggable caught errors while triggering '${event.type}'`, caughtErrors);

      }

      return this;
    }
  }

  class DraggableEvent extends AbstractEvent {

    get draggable() {
      return this.data.draggable;
    }
  }

  DraggableEvent.type = 'draggable';
  class DraggableInitializedEvent extends DraggableEvent {}

  DraggableInitializedEvent.type = 'draggable:initialize';
  class DraggableDestroyEvent extends DraggableEvent {}
  DraggableDestroyEvent.type = 'draggable:destroy';

  const onDragStart$1 = Symbol('onDragStart');
  const onDragMove = Symbol('onDragMove');
  const onDragStop$1 = Symbol('onDragStop');
  const onDragPressure = Symbol('onDragPressure');
  const dragStop = Symbol('dragStop');

  const defaultAnnouncements$1 = {
    'drag:start': event => `Picked up ${event.source.textContent.trim() || event.source.id || 'draggable element'}`,
    'drag:stop': event => `Released ${event.source.textContent.trim() || event.source.id || 'draggable element'}`
  };
  const defaultClasses = {
    'container:dragging': 'draggable-container--is-dragging',
    'source:dragging': 'draggable-source--is-dragging',
    'source:placed': 'draggable-source--placed',
    'container:placed': 'draggable-container--placed',
    'body:dragging': 'draggable--is-dragging',
    'draggable:over': 'draggable--over',
    'container:over': 'draggable-container--over',
    'source:original': 'draggable--original',
    mirror: 'draggable-mirror'
  };
  const defaultOptions = {
    draggable: '.draggable-source',
    handle: null,
    delay: {},
    distance: 0,
    placedTimeout: 800,
    plugins: [],
    sensors: [],
    exclude: {
      plugins: [],
      sensors: []
    }
  };

  class Draggable {

    constructor(containers = [document.body], options = {}) {

      if (containers instanceof NodeList || containers instanceof Array) {
        this.containers = [...containers];
      } else if (containers instanceof HTMLElement) {
        this.containers = [containers];
      } else {
        throw new Error('Draggable containers are expected to be of type `NodeList`, `HTMLElement[]` or `HTMLElement`');
      }
      this.options = {
        ...defaultOptions,
        ...options,
        classes: {
          ...defaultClasses,
          ...(options.classes || {})
        },
        announcements: {
          ...defaultAnnouncements$1,
          ...(options.announcements || {})
        },
        exclude: {
          plugins: options.exclude && options.exclude.plugins || [],
          sensors: options.exclude && options.exclude.sensors || []
        }
      };

      this.emitter = new Emitter();

      this.dragging = false;

      this.plugins = [];

      this.sensors = [];
      this[onDragStart$1] = this[onDragStart$1].bind(this);
      this[onDragMove] = this[onDragMove].bind(this);
      this[onDragStop$1] = this[onDragStop$1].bind(this);
      this[onDragPressure] = this[onDragPressure].bind(this);
      this[dragStop] = this[dragStop].bind(this);
      document.addEventListener('drag:start', this[onDragStart$1], true);
      document.addEventListener('drag:move', this[onDragMove], true);
      document.addEventListener('drag:stop', this[onDragStop$1], true);
      document.addEventListener('drag:pressure', this[onDragPressure], true);
      const defaultPlugins = Object.values(Draggable.Plugins).filter(Plugin => !this.options.exclude.plugins.includes(Plugin));
      const defaultSensors = Object.values(Draggable.Sensors).filter(sensor => !this.options.exclude.sensors.includes(sensor));
      this.addPlugin(...[...defaultPlugins, ...this.options.plugins]);
      this.addSensor(...[...defaultSensors, ...this.options.sensors]);
      const draggableInitializedEvent = new DraggableInitializedEvent({
        draggable: this
      });
      this.on('mirror:created', ({
        mirror
      }) => this.mirror = mirror);
      this.on('mirror:destroy', () => this.mirror = null);
      this.trigger(draggableInitializedEvent);
    }

    destroy() {
      document.removeEventListener('drag:start', this[onDragStart$1], true);
      document.removeEventListener('drag:move', this[onDragMove], true);
      document.removeEventListener('drag:stop', this[onDragStop$1], true);
      document.removeEventListener('drag:pressure', this[onDragPressure], true);
      const draggableDestroyEvent = new DraggableDestroyEvent({
        draggable: this
      });
      this.trigger(draggableDestroyEvent);
      this.removePlugin(...this.plugins.map(plugin => plugin.constructor));
      this.removeSensor(...this.sensors.map(sensor => sensor.constructor));
    }

    addPlugin(...plugins) {
      const activePlugins = plugins.map(Plugin => new Plugin(this));
      activePlugins.forEach(plugin => plugin.attach());
      this.plugins = [...this.plugins, ...activePlugins];
      return this;
    }

    removePlugin(...plugins) {
      const removedPlugins = this.plugins.filter(plugin => plugins.includes(plugin.constructor));
      removedPlugins.forEach(plugin => plugin.detach());
      this.plugins = this.plugins.filter(plugin => !plugins.includes(plugin.constructor));
      return this;
    }

    addSensor(...sensors) {
      const activeSensors = sensors.map(Sensor => new Sensor(this.containers, this.options));
      activeSensors.forEach(sensor => sensor.attach());
      this.sensors = [...this.sensors, ...activeSensors];
      return this;
    }

    removeSensor(...sensors) {
      const removedSensors = this.sensors.filter(sensor => sensors.includes(sensor.constructor));
      removedSensors.forEach(sensor => sensor.detach());
      this.sensors = this.sensors.filter(sensor => !sensors.includes(sensor.constructor));
      return this;
    }

    addContainer(...containers) {
      this.containers = [...this.containers, ...containers];
      this.sensors.forEach(sensor => sensor.addContainer(...containers));
      return this;
    }

    removeContainer(...containers) {
      this.containers = this.containers.filter(container => !containers.includes(container));
      this.sensors.forEach(sensor => sensor.removeContainer(...containers));
      return this;
    }

    on(type, ...callbacks) {
      this.emitter.on(type, ...callbacks);
      return this;
    }

    off(type, callback) {
      this.emitter.off(type, callback);
      return this;
    }

    trigger(event) {
      this.emitter.trigger(event);
      return this;
    }

    getClassNameFor(name) {
      return this.getClassNamesFor(name)[0];
    }

    getClassNamesFor(name) {
      const classNames = this.options.classes[name];
      if (classNames instanceof Array) {
        return classNames;
      } else if (typeof classNames === 'string' || classNames instanceof String) {
        return [classNames];
      } else {
        return [];
      }
    }

    isDragging() {
      return Boolean(this.dragging);
    }

    getDraggableElements() {
      return this.containers.reduce((current, container) => {
        return [...current, ...this.getDraggableElementsForContainer(container)];
      }, []);
    }

    getDraggableElementsForContainer(container) {
      const allDraggableElements = container.querySelectorAll(this.options.draggable);
      return [...allDraggableElements].filter(childElement => {
        return childElement !== this.originalSource && childElement !== this.mirror;
      });
    }

    cancel() {
      this[dragStop]();
    }

    [onDragStart$1](event) {
      const sensorEvent = getSensorEvent(event);
      const {
        target,
        container,
        originalSource
      } = sensorEvent;
      if (!this.containers.includes(container)) {
        return;
      }
      if (this.options.handle && target && !closest(target, this.options.handle)) {
        sensorEvent.cancel();
        return;
      }
      this.originalSource = originalSource;
      this.sourceContainer = container;
      if (this.lastPlacedSource && this.lastPlacedContainer) {
        clearTimeout(this.placedTimeoutID);
        this.lastPlacedSource.classList.remove(...this.getClassNamesFor('source:placed'));
        this.lastPlacedContainer.classList.remove(...this.getClassNamesFor('container:placed'));
      }
      this.source = this.originalSource.cloneNode(true);
      this.originalSource.parentNode.insertBefore(this.source, this.originalSource);
      this.originalSource.style.display = 'none';
      const dragStartEvent = new DragStartEvent({
        source: this.source,
        originalSource: this.originalSource,
        sourceContainer: container,
        sensorEvent
      });
      this.trigger(dragStartEvent);
      this.dragging = !dragStartEvent.canceled();
      if (dragStartEvent.canceled()) {
        this.source.remove();
        this.originalSource.style.display = null;
        return;
      }
      this.originalSource.classList.add(...this.getClassNamesFor('source:original'));
      this.source.classList.add(...this.getClassNamesFor('source:dragging'));
      this.sourceContainer.classList.add(...this.getClassNamesFor('container:dragging'));
      document.body.classList.add(...this.getClassNamesFor('body:dragging'));
      applyUserSelect(document.body, 'none');
      requestAnimationFrame(() => {
        const oldSensorEvent = getSensorEvent(event);
        const newSensorEvent = oldSensorEvent.clone({
          target: this.source
        });
        this[onDragMove]({
          ...event,
          detail: newSensorEvent
        });
      });
    }

    [onDragMove](event) {
      if (!this.dragging) {
        return;
      }
      const sensorEvent = getSensorEvent(event);
      const {
        container
      } = sensorEvent;
      let target = sensorEvent.target;
      const dragMoveEvent = new DragMoveEvent({
        source: this.source,
        originalSource: this.originalSource,
        sourceContainer: container,
        sensorEvent
      });
      this.trigger(dragMoveEvent);
      if (dragMoveEvent.canceled()) {
        sensorEvent.cancel();
      }
      target = closest(target, this.options.draggable);
      const withinCorrectContainer = closest(sensorEvent.target, this.containers);
      const overContainer = sensorEvent.overContainer || withinCorrectContainer;
      const isLeavingContainer = this.currentOverContainer && overContainer !== this.currentOverContainer;
      const isLeavingDraggable = this.currentOver && target !== this.currentOver;
      const isOverContainer = overContainer && this.currentOverContainer !== overContainer;
      const isOverDraggable = withinCorrectContainer && target && this.currentOver !== target;
      if (isLeavingDraggable) {
        const dragOutEvent = new DragOutEvent({
          source: this.source,
          originalSource: this.originalSource,
          sourceContainer: container,
          sensorEvent,
          over: this.currentOver,
          overContainer: this.currentOverContainer
        });
        this.currentOver.classList.remove(...this.getClassNamesFor('draggable:over'));
        this.currentOver = null;
        this.trigger(dragOutEvent);
      }
      if (isLeavingContainer) {
        const dragOutContainerEvent = new DragOutContainerEvent({
          source: this.source,
          originalSource: this.originalSource,
          sourceContainer: container,
          sensorEvent,
          overContainer: this.currentOverContainer
        });
        this.currentOverContainer.classList.remove(...this.getClassNamesFor('container:over'));
        this.currentOverContainer = null;
        this.trigger(dragOutContainerEvent);
      }
      if (isOverContainer) {
        overContainer.classList.add(...this.getClassNamesFor('container:over'));
        const dragOverContainerEvent = new DragOverContainerEvent({
          source: this.source,
          originalSource: this.originalSource,
          sourceContainer: container,
          sensorEvent,
          overContainer
        });
        this.currentOverContainer = overContainer;
        this.trigger(dragOverContainerEvent);
      }
      if (isOverDraggable) {
        target.classList.add(...this.getClassNamesFor('draggable:over'));
        const dragOverEvent = new DragOverEvent({
          source: this.source,
          originalSource: this.originalSource,
          sourceContainer: container,
          sensorEvent,
          overContainer,
          over: target
        });
        this.currentOver = target;
        this.trigger(dragOverEvent);
      }
    }

    [dragStop](event) {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      const dragStopEvent = new DragStopEvent({
        source: this.source,
        originalSource: this.originalSource,
        sensorEvent: event ? event.sensorEvent : null,
        sourceContainer: this.sourceContainer
      });
      this.trigger(dragStopEvent);
      if (!dragStopEvent.canceled()) this.source.parentNode.insertBefore(this.originalSource, this.source);
      this.source.remove();
      this.originalSource.style.display = '';
      this.source.classList.remove(...this.getClassNamesFor('source:dragging'));
      this.originalSource.classList.remove(...this.getClassNamesFor('source:original'));
      this.originalSource.classList.add(...this.getClassNamesFor('source:placed'));
      this.sourceContainer.classList.add(...this.getClassNamesFor('container:placed'));
      this.sourceContainer.classList.remove(...this.getClassNamesFor('container:dragging'));
      document.body.classList.remove(...this.getClassNamesFor('body:dragging'));
      applyUserSelect(document.body, '');
      if (this.currentOver) {
        this.currentOver.classList.remove(...this.getClassNamesFor('draggable:over'));
      }
      if (this.currentOverContainer) {
        this.currentOverContainer.classList.remove(...this.getClassNamesFor('container:over'));
      }
      this.lastPlacedSource = this.originalSource;
      this.lastPlacedContainer = this.sourceContainer;
      this.placedTimeoutID = setTimeout(() => {
        if (this.lastPlacedSource) {
          this.lastPlacedSource.classList.remove(...this.getClassNamesFor('source:placed'));
        }
        if (this.lastPlacedContainer) {
          this.lastPlacedContainer.classList.remove(...this.getClassNamesFor('container:placed'));
        }
        this.lastPlacedSource = null;
        this.lastPlacedContainer = null;
      }, this.options.placedTimeout);
      const dragStoppedEvent = new DragStoppedEvent({
        source: this.source,
        originalSource: this.originalSource,
        sensorEvent: event ? event.sensorEvent : null,
        sourceContainer: this.sourceContainer
      });
      this.trigger(dragStoppedEvent);
      this.source = null;
      this.originalSource = null;
      this.currentOverContainer = null;
      this.currentOver = null;
      this.sourceContainer = null;
    }

    [onDragStop$1](event) {
      this[dragStop](event);
    }

    [onDragPressure](event) {
      if (!this.dragging) {
        return;
      }
      const sensorEvent = getSensorEvent(event);
      const source = this.source || closest(sensorEvent.originalEvent.target, this.options.draggable);
      const dragPressureEvent = new DragPressureEvent({
        sensorEvent,
        source,
        pressure: sensorEvent.pressure
      });
      this.trigger(dragPressureEvent);
    }
  }

  Draggable.Plugins = {
    Announcement,
    Focusable,
    Mirror,
    Scrollable
  };

  Draggable.Sensors = {
    MouseSensor,
    TouchSensor
  };
  function getSensorEvent(event) {
    return event.detail;
  }
  function applyUserSelect(element, value) {
    element.style.webkitUserSelect = value;
    element.style.mozUserSelect = value;
    element.style.msUserSelect = value;
    element.style.oUserSelect = value;
    element.style.userSelect = value;
  }

  class DroppableEvent extends AbstractEvent {

    constructor(data) {
      super(data);
      this.data = data;
    }

    get dragEvent() {
      return this.data.dragEvent;
    }
  }
  DroppableEvent.type = 'droppable';

  class DroppableStartEvent extends DroppableEvent {

    get dropzone() {
      return this.data.dropzone;
    }
  }
  DroppableStartEvent.type = 'droppable:start';
  DroppableStartEvent.cancelable = true;

  class DroppableDroppedEvent extends DroppableEvent {

    get dropzone() {
      return this.data.dropzone;
    }
  }
  DroppableDroppedEvent.type = 'droppable:dropped';
  DroppableDroppedEvent.cancelable = true;

  class DroppableReturnedEvent extends DroppableEvent {

    get dropzone() {
      return this.data.dropzone;
    }
  }
  DroppableReturnedEvent.type = 'droppable:returned';
  DroppableReturnedEvent.cancelable = true;

  class DroppableStopEvent extends DroppableEvent {

    get dropzone() {
      return this.data.dropzone;
    }
  }
  DroppableStopEvent.type = 'droppable:stop';
  DroppableStopEvent.cancelable = true;

  class SwappableEvent extends AbstractEvent {

    constructor(data) {
      super(data);
      this.data = data;
    }

    get dragEvent() {
      return this.data.dragEvent;
    }
  }

  SwappableEvent.type = 'swappable';
  class SwappableStartEvent extends SwappableEvent {}
  SwappableStartEvent.type = 'swappable:start';
  SwappableStartEvent.cancelable = true;

  class SwappableSwapEvent extends SwappableEvent {

    get over() {
      return this.data.over;
    }

    get overContainer() {
      return this.data.overContainer;
    }
  }
  SwappableSwapEvent.type = 'swappable:swap';
  SwappableSwapEvent.cancelable = true;

  class SwappableSwappedEvent extends SwappableEvent {

    get swappedElement() {
      return this.data.swappedElement;
    }
  }

  SwappableSwappedEvent.type = 'swappable:swapped';
  class SwappableStopEvent extends SwappableEvent {}
  SwappableStopEvent.type = 'swappable:stop';

  class SortableEvent extends AbstractEvent {

    constructor(data) {
      super(data);
      this.data = data;
    }

    get dragEvent() {
      return this.data.dragEvent;
    }
  }
  SortableEvent.type = 'sortable';

  class SortableStartEvent extends SortableEvent {

    get startIndex() {
      return this.data.startIndex;
    }

    get startContainer() {
      return this.data.startContainer;
    }
  }
  SortableStartEvent.type = 'sortable:start';
  SortableStartEvent.cancelable = true;

  class SortableSortEvent extends SortableEvent {

    get currentIndex() {
      return this.data.currentIndex;
    }

    get over() {
      return this.data.over;
    }

    get overContainer() {
      return this.data.dragEvent.overContainer;
    }
  }
  SortableSortEvent.type = 'sortable:sort';
  SortableSortEvent.cancelable = true;

  class SortableSortedEvent extends SortableEvent {

    get oldIndex() {
      return this.data.oldIndex;
    }

    get newIndex() {
      return this.data.newIndex;
    }

    get oldContainer() {
      return this.data.oldContainer;
    }

    get newContainer() {
      return this.data.newContainer;
    }
  }
  SortableSortedEvent.type = 'sortable:sorted';

  class SortableStopEvent extends SortableEvent {

    get oldIndex() {
      return this.data.oldIndex;
    }

    get newIndex() {
      return this.data.newIndex;
    }

    get oldContainer() {
      return this.data.oldContainer;
    }

    get newContainer() {
      return this.data.newContainer;
    }
  }
  SortableStopEvent.type = 'sortable:stop';

  const onDragStart = Symbol('onDragStart');
  const onDragOverContainer = Symbol('onDragOverContainer');
  const onDragOver = Symbol('onDragOver');
  const onDragStop = Symbol('onDragStop');

  function onSortableSortedDefaultAnnouncement({
    dragEvent
  }) {
    const sourceText = dragEvent.source.textContent.trim() || dragEvent.source.id || 'sortable element';
    if (dragEvent.over) {
      const overText = dragEvent.over.textContent.trim() || dragEvent.over.id || 'sortable element';
      const isFollowing = dragEvent.source.compareDocumentPosition(dragEvent.over) & Node.DOCUMENT_POSITION_FOLLOWING;
      if (isFollowing) {
        return `Placed ${sourceText} after ${overText}`;
      } else {
        return `Placed ${sourceText} before ${overText}`;
      }
    } else {

      return `Placed ${sourceText} into a different container`;
    }
  }

  const defaultAnnouncements = {
    'sortable:sorted': onSortableSortedDefaultAnnouncement
  };

  class Sortable extends Draggable {

    constructor(containers = [], options = {}) {
      super(containers, {
        ...options,
        announcements: {
          ...defaultAnnouncements,
          ...(options.announcements || {})
        }
      });

      this.startIndex = null;

      this.startContainer = null;
      this[onDragStart] = this[onDragStart].bind(this);
      this[onDragOverContainer] = this[onDragOverContainer].bind(this);
      this[onDragOver] = this[onDragOver].bind(this);
      this[onDragStop] = this[onDragStop].bind(this);
      this.on('drag:start', this[onDragStart]).on('drag:over:container', this[onDragOverContainer]).on('drag:over', this[onDragOver]).on('drag:stop', this[onDragStop]);
    }

    destroy() {
      super.destroy();
      this.off('drag:start', this[onDragStart]).off('drag:over:container', this[onDragOverContainer]).off('drag:over', this[onDragOver]).off('drag:stop', this[onDragStop]);
    }

    index(element) {
      return this.getSortableElementsForContainer(element.parentNode).indexOf(element);
    }

    getSortableElementsForContainer(container) {
      const allSortableElements = container.querySelectorAll(this.options.draggable);
      return [...allSortableElements].filter(childElement => {
        return childElement !== this.originalSource && childElement !== this.mirror && childElement.parentNode === container;
      });
    }

    [onDragStart](event) {
      this.startContainer = event.source.parentNode;
      this.startIndex = this.index(event.source);
      const sortableStartEvent = new SortableStartEvent({
        dragEvent: event,
        startIndex: this.startIndex,
        startContainer: this.startContainer
      });
      this.trigger(sortableStartEvent);
      if (sortableStartEvent.canceled()) {
        event.cancel();
      }
    }

    [onDragOverContainer](event) {
      if (event.canceled()) {
        return;
      }
      const {
        source,
        over,
        overContainer
      } = event;
      const oldIndex = this.index(source);
      const sortableSortEvent = new SortableSortEvent({
        dragEvent: event,
        currentIndex: oldIndex,
        source,
        over
      });
      this.trigger(sortableSortEvent);
      if (sortableSortEvent.canceled()) {
        return;
      }
      const children = this.getSortableElementsForContainer(overContainer);
      const moves = move({
        source,
        over,
        overContainer,
        children
      });
      if (!moves) {
        return;
      }
      const {
        oldContainer,
        newContainer
      } = moves;
      const newIndex = this.index(event.source);
      const sortableSortedEvent = new SortableSortedEvent({
        dragEvent: event,
        oldIndex,
        newIndex,
        oldContainer,
        newContainer
      });
      this.trigger(sortableSortedEvent);
    }

    [onDragOver](event) {
      if (event.over === event.originalSource || event.over === event.source) {
        return;
      }
      const {
        source,
        over,
        overContainer
      } = event;
      const oldIndex = this.index(source);
      const sortableSortEvent = new SortableSortEvent({
        dragEvent: event,
        currentIndex: oldIndex,
        source,
        over
      });
      this.trigger(sortableSortEvent);
      if (sortableSortEvent.canceled()) {
        return;
      }
      const children = this.getDraggableElementsForContainer(overContainer);
      const moves = move({
        source,
        over,
        overContainer,
        children
      });
      if (!moves) {
        return;
      }
      const {
        oldContainer,
        newContainer
      } = moves;
      const newIndex = this.index(source);
      const sortableSortedEvent = new SortableSortedEvent({
        dragEvent: event,
        oldIndex,
        newIndex,
        oldContainer,
        newContainer
      });
      this.trigger(sortableSortedEvent);
    }

    [onDragStop](event) {
      const sortableStopEvent = new SortableStopEvent({
        dragEvent: event,
        oldIndex: this.startIndex,
        newIndex: this.index(event.source),
        oldContainer: this.startContainer,
        newContainer: event.source.parentNode
      });
      this.trigger(sortableStopEvent);
      this.startIndex = null;
      this.startContainer = null;
    }
  }
  function index(element) {
    return Array.prototype.indexOf.call(element.parentNode.children, element);
  }
  function move({
    source,
    over,
    overContainer,
    children
  }) {
    const emptyOverContainer = !children.length;
    const differentContainer = source.parentNode !== overContainer;
    const sameContainer = over && source.parentNode === over.parentNode;
    if (emptyOverContainer) {
      return moveInsideEmptyContainer(source, overContainer);
    } else if (sameContainer) {
      return moveWithinContainer(source, over);
    } else if (differentContainer) {
      return moveOutsideContainer(source, over, overContainer);
    } else {
      return null;
    }
  }
  function moveInsideEmptyContainer(source, overContainer) {
    const oldContainer = source.parentNode;
    overContainer.appendChild(source);
    return {
      oldContainer,
      newContainer: overContainer
    };
  }
  function moveWithinContainer(source, over) {
    const oldIndex = index(source);
    const newIndex = index(over);
    if (oldIndex < newIndex) {
      source.parentNode.insertBefore(source, over.nextElementSibling);
    } else {
      source.parentNode.insertBefore(source, over);
    }
    return {
      oldContainer: source.parentNode,
      newContainer: source.parentNode
    };
  }
  function moveOutsideContainer(source, over, overContainer) {
    const oldContainer = source.parentNode;
    if (over) {
      over.parentNode.insertBefore(source, over);
    } else {

      overContainer.appendChild(source);
    }
    return {
      oldContainer,
      newContainer: source.parentNode
    };
  }

  /**
   * A function that does nothing.
   *
   * @returns {void}
   */

  const noop = () => {};
  /**
   * @type {Function}
   * @param {*} value A value.
   * @returns {boolean} Whether the given value is a valid, finite number.
   */

  const isNumber = _arg => {
    return 'number' === typeof _arg && Number.isFinite(_arg);
  };
  /**
   * @type {Function}
   * @param {*} value A value.
   * @returns {boolean} Whether the given value is a string.
   */

  const isString = _arg5 => {
    return 'string' === typeof _arg5;
  };
  /**
   * @type {Function}
   * @param {*} value The tested value.
   * @returns {boolean} Whether the given value is an array.
   */

  const isArray = Array.isArray;
  /**
   * @type {Function}
   * @param {*} value The tested value.
   * @returns {boolean} Whether the given value is an object. This excludes Arrays, but not Dates or RegExps.
   */

  const isObject = _arg2 => {
    return 'object' === typeof _arg2 && !!_arg2 && !isArray(_arg2);
  };
  /**
   * @type {Function}
   * @param {*} value The tested value.
   * @returns {boolean} Whether the given value is a function.
   */

  const isFunction = _arg6 => {
    return 'function' === typeof _arg6;
  };
  /**
   * @type {Function}
   * @param {object} Object The tested object.
   * @param {string} name The name of a property.
   * @returns {boolean} Whether the given object has the specified property as its own.
   */

  const hasObjectProperty = (_arg7, _arg8) => {
    return Object.prototype.hasOwnProperty.call(_arg7, _arg8);
  };
  /**
   * @param {object} object A Plain Old Javascript Object.
   * @returns {boolean} Whether the given object is empty.
   */

  const isEmptyObject = object => {
    for (let key in object) {
      if (hasObjectProperty(object, key)) {
        return false;
      }
    }

    return true;
  };
  /**
   * @param {Function[]} comparators The proper comparators to use in order, as long as the two values are deemed equal.
   * @param {*} x A value.
   * @param {*} y Another value.
   * @returns {number}
   * A number:
   * - < 0 if x <  y,
   * - > 0 if x >  y,
   * -   0 if x == y.
   */

  const compareWith = (comparators, x, y) => {
    for (const comparator of comparators) {
      const result = Number(comparator(x, y));

      if (!isNaN(result) && result !== 0) {
        return result;
      }
    }

    return 0;
  };
  /**
   * @type {Function}
   * @param {*} x A value.
   * @param {*} y Another value.
   * @returns {boolean} Whether the first value is larger than the second.
   */

  const gt = (_arg12, _arg13) => {
    return _arg12 > _arg13;
  };
  /**
   * @param {Array} values A list of values.
   * @param {Function} getter A getter for the calculated values to compare.
   * @param {Function} comparator A function usable to compare any two calculated values, and determine which one to keep.
   * @returns {*|undefined} The (first) value from the list whose corresponding calculated value was selected.
   */

  const extremumBy = (values, getter, comparator) => {
    let selected;
    let extremum;

    if (isArray(values)) {
      for (let i = 0, l = values.length; i < l; i++) {
        const calculated = getter(values[i]);

        if (undefined === extremum || comparator(calculated, extremum)) {
          selected = values[i];
          extremum = calculated;
        }
      }
    }

    return selected;
  };
  /**
   * @type {Function}
   * @param {Array} values A list of values.
   * @param {Function} getter A getter for the calculated values to compare.
   * @returns {*|undefined} The (first) value from the list whose corresponding calculated value is the largest.
   */

  const maxBy = (_arg16, _arg17) => {
    return extremumBy(_arg16, _arg17, gt);
  };
  /**
   * @type {Function}
   * @param {string} value A string.
   * @returns {string} The given string, with all RegExp characters escaped.
   */

  const escapeRegExp = _it2 => {
    return _it2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  /**
   * @param {string} url A URL of any shape.
   * @returns {string} The corresponding path.
   */

  const getUrlPath = url => {
    let path = null;

    if (url.charAt(0) === '/') {
      if (url.charAt(1) === '/') {
        url = `https://${url}`;
      } else {
        path = url;
      }
    }

    if (null === path) {
      try {
        path = new URL(url).pathname;
      } catch (error) {
        path = url;
      }
    }

    return path;
  };

  /**
   * @type {string}
   */

  const UNIQUE_KEY_PREFIX = '__duo-toolbox__-';
  /**
   * @type {Function}
   * @param {string} baseKey A key.
   * @returns {string} The given key, uniquely prefixed.
   */

  const getUniqueKey = _arg => {
    return `${UNIQUE_KEY_PREFIX}${_arg}`;
  };
  /**
   * @type {string}
   */

  const KEY_GLOBAL_VARIABLES = getUniqueKey('global_variables');
  /**
   * @param {string} key A variable key.
   * @param {*=} defaultValue The default value to return if the variable has not been set yet.
   * @returns {*} The value of the given variable.
   */

  const getSharedGlobalVariable = (key, defaultValue) => {
    if (!isObject(window[KEY_GLOBAL_VARIABLES])) {
      window[KEY_GLOBAL_VARIABLES] = {};
    }

    return !hasObjectProperty(window[KEY_GLOBAL_VARIABLES], key) ? defaultValue : window[KEY_GLOBAL_VARIABLES][key];
  };
  /**
   * @param {string} key A variable key.
   * @param {*} value The new variable value.
   * @returns {void}
   */

  const setSharedGlobalVariable = (key, value) => {
    if (!isObject(window[KEY_GLOBAL_VARIABLES])) {
      window[KEY_GLOBAL_VARIABLES] = {};
    }

    window[KEY_GLOBAL_VARIABLES][key] = value;
  };
  /**
   * @param {string} key A variable key.
   * @param {Function} callback A function usable to calculate the new value of the variable, given the old one.
   * @param {*=} defaultValue The default value to use if the variable has not been set yet.
   * @returns {*} The updated value.
   */

  const updateSharedGlobalVariable = (key, callback, defaultValue) => {
    const updatedValue = callback(getSharedGlobalVariable(key, defaultValue));
    setSharedGlobalVariable(key, updatedValue);
    return updatedValue;
  };
  /**
   * @param {string} key They key of a counter.
   * @returns {number} The next value of the counter, starting at 1 if it was not used yet.
   */

  const bumpGlobalCounter = key => updateSharedGlobalVariable(`__counter::${key}__`, _arg2 => {
    return _arg2 + 1;
  }, 0);
  /**
   * @type {string}
   */

  const KEY_PENDING_GLOBAL_LISTENERS = 'pending_global_listeners';
  /**
   * Registers a listener for when a global variable is defined and matches a given predicate.
   *
   * This only has an effect if no up-to-date listener was already registered with the same ID.
   *
   * @param {string} name The name of a global variable.
   * @param {Function} predicate The predicate that the variable must match.
   * @param {Function} callback The function to be called once the variable is defined and matches the predicate.
   * @param {string} listenerId The listener ID.
   * @param {number} listenerVersion The listener version. Only the most recent listener for a given ID will be called.
   * @returns {void}
   */

  const onceGlobalDefined = (name, predicate, callback, listenerId, listenerVersion = 1) => {
    if (hasObjectProperty(window, name) && predicate(window[name])) {
      callback(window[name]);
    } else {
      updateSharedGlobalVariable(KEY_PENDING_GLOBAL_LISTENERS, (listeners = {}) => {
        var _listeners$name$liste;

        if (!listeners[name]) {
          listeners[name] = {};
          let currentValue = window[name]; // Add a getter and a setter on the window to detect when the variable is changed.

          Object.defineProperty(window, name, {
            get: () => currentValue,
            set: value => {
              if (predicate(value)) {
                Object.defineProperty(window, name, {
                  value,
                  configurable: true,
                  enumerable: true,
                  writable: true
                });
                Object.values(listeners[name]).forEach(_it => {
                  return _it.callback(value);
                });
              } else {
                currentValue = value;
              }
            },
            configurable: true
          });
        }

        if (listenerVersion > (Number((_listeners$name$liste = listeners[name][listenerId]) === null || _listeners$name$liste === void 0 ? void 0 : _listeners$name$liste.version) || 0)) {
          listeners[name][listenerId] = {
            callback,
            version: listenerVersion
          };
        }

        return listeners;
      });
    }
  };
  /**
   * @type {string}
   */


  const KEY_ORIGINAL_FUNCTION = getUniqueKey('original_function');
  /**
   * @type {string}
   */

  const KEY_OVERRIDE_VERSION = getUniqueKey('override_version');
  /**
   * Applies an override to a (global) function hosted by a specific object.
   *
   * The override is only applied if necessary, and if the function exists.
   *
   * @param {Object} host The object that hosts the function to override.
   * @param {string} name The name of the function to override.
   * @param {Function} applyOverride A callback responsible for overriding the original function.
   * @param {number} overrideVersion The override version. Only the most recent override will take effect.
   * @returns {void}
   */

  const overrideFunction = (host, name, applyOverride, overrideVersion = 1) => {
    var _host$name;

    if (!isObject(host)) {
      return;
    }

    if (overrideVersion > (Number((_host$name = host[name]) === null || _host$name === void 0 ? void 0 : _host$name[KEY_OVERRIDE_VERSION]) || 0)) {
      var _host$name2;

      const original = ((_host$name2 = host[name]) === null || _host$name2 === void 0 ? void 0 : _host$name2[KEY_ORIGINAL_FUNCTION]) || host[name] || noop;
      host[name] = applyOverride(original);
      host[name][KEY_ORIGINAL_FUNCTION] = original;
      host[name][KEY_OVERRIDE_VERSION] = overrideVersion;
    }
  };
  /**
   * Applies an override to a function available in the global (window) scope.
   *
   * The override is only applied if necessary, once the function is defined.
   *
   * @type {Function}
   * @param {string} name The name of the function to override.
   * @param {Function} applyOverride A callback responsible for overriding the original function.
   * @param {number} overrideVersion The override version. More recent overrides take precedence over older ones.
   * @returns {void}
   */


  const overrideGlobalFunction = (name, applyOverride, overrideVersion = 1) => onceGlobalDefined(name, isFunction, () => overrideFunction(window, name, applyOverride, overrideVersion), 'global', overrideVersion);
  /**
   * Applies an override to an instance method belonging to an interface available in the global (window) scope.
   *
   * The override is only applied if necessary, once the interface is defined, and if the method exists.
   *
   * @param {string} constructorName The name of the constructor whose prototype holds the method to override.
   * @param {string} methodName The name of the instance method to override.
   * @param {Function} applyOverride A callback responsible for overriding the original method.
   * @param {number} overrideVersion The override version. More recent overrides take precedence over older ones.
   * @returns {void}
   */

  const overrideInstanceMethod = (constructorName, methodName, applyOverride, overrideVersion = 1) => onceGlobalDefined(constructorName, isFunction, _arg4 => {
    return overrideFunction(_arg4 === null || _arg4 === void 0 ? void 0 : _arg4.prototype, methodName, applyOverride, overrideVersion);
  }, `instance_method:${methodName}`, overrideVersion);
  /**
   * Applies an override to the descriptor of an object property.
   *
   * The override is only applied if necessary. If the property does not exist yet, it will be initialized.
   *
   * @param {object} host The object that owns the property to override.
   * @param {string} name The name of the property to override.
   * @param {Function} applyOverride A callback responsible for overriding the original property descriptor.
   * @param {number} overrideVersion The override version. Only the most recent override will take effect.
   * @returns {void}
   */

  const overrideOwnPropertyDescriptor = (host, name, applyOverride, overrideVersion = 1) => {
    if (!isObject(host)) {
      return;
    }

    const overrideKey = getUniqueKey(`${name}_override_version`);

    if (overrideVersion > (Number(host[overrideKey]) || 0)) {
      Object.defineProperty(host, name, applyOverride(Object.getOwnPropertyDescriptor(host, name)));
    }
  };
  /**
   * @type {string}
   */

  const TOOLBOX_IFRAME_ID = getUniqueKey('logging_iframe');
  /**
   * @returns {HTMLElement}
   * An iframe element usable to access features that may not be accessible from the current context,
   * including (but not limited to) working logging methods and listening of localStorage changes.
   */

  const getToolboxIframe = () => {
    let toolboxIframe = document.getElementById(TOOLBOX_IFRAME_ID);

    if (!toolboxIframe || !toolboxIframe.isConnected) {
      toolboxIframe = document.createElement('iframe');
      toolboxIframe.id = TOOLBOX_IFRAME_ID;
      toolboxIframe.style.display = 'none';
      document.body.appendChild(toolboxIframe);
    }

    return toolboxIframe;
  };

  /**
   * @param {Event} event The UI event to discard.
   * @returns {void}
   */

  const discardEvent = event => {
    event.preventDefault();
    event.stopPropagation();
  };
  /**
   * @returns {boolean} Whether the currently focused element (if any) is an input (<input>, <select> or <textarea>).
   */

  const isAnyInputFocused = () => !document.activeElement ? false : ['input', 'select', 'textarea'].indexOf(document.activeElement.tagName.toLowerCase()) >= 0;

  /**
   * @type {string}
   */
  const CHALLENGE_TYPE_ASSIST = 'assist';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_CHARACTER_INTRO = 'characterIntro';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_CHARACTER_MATCH = 'characterMatch';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_CHARACTER_PUZZLE = 'characterPuzzle';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_CHARACTER_SELECT = 'characterSelect';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_CHARACTER_TRACE = 'characterTrace';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_COMPLETE_REVERSE_TRANSLATION = 'completeReverseTranslation';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_DEFINITION = 'definition';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_DIALOGUE = 'dialogue';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_FORM = 'form';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_FREE_RESPONSE = 'freeResponse';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_GAP_FILL = 'gapFill';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_JUDGE = 'judge';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_LISTEN = 'listen';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_LISTEN_COMPREHENSION = 'listenComprehension';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_LISTEN_ISOLATION = 'listenIsolation';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_LISTEN_MATCH = 'listenMatch';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_LISTEN_SPELL = 'listenSpell';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_LISTEN_TAP = 'listenTap';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_MATCH = 'match';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_NAME = 'name';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_PARTIAL_REVERSE_TRANSLATE = 'partialReverseTranslate';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_READ_COMPREHENSION = 'readComprehension';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_SELECT = 'select';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_SELECT_PRONUNCIATION = 'selectPronunciation';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_SELECT_TRANSCRIPTION = 'selectTranscription';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_SPEAK = 'speak';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TAP_CLOZE = 'tapCloze';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TAP_CLOZE_TABLE = 'tapClozeTable';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TAP_COMPLETE = 'tapComplete';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TAP_COMPLETE_TABLE = 'tapCompleteTable';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TAP_DESCRIBE = 'tapDescribe';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TRANSLATE = 'translate';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TYPE_CLOZE = 'typeCloze';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TYPE_CLOZE_TABLE = 'typeClozeTable';
  /**
   * @type {string}
   */

  const CHALLENGE_TYPE_TYPE_COMPLETE_TABLE = 'typeCompleteTable';
  /**
   * @type {string[]}
   */

  const CHALLENGE_TYPES = [CHALLENGE_TYPE_ASSIST, CHALLENGE_TYPE_CHARACTER_INTRO, CHALLENGE_TYPE_CHARACTER_MATCH, CHALLENGE_TYPE_CHARACTER_PUZZLE, CHALLENGE_TYPE_CHARACTER_SELECT, CHALLENGE_TYPE_CHARACTER_TRACE, CHALLENGE_TYPE_COMPLETE_REVERSE_TRANSLATION, CHALLENGE_TYPE_DEFINITION, CHALLENGE_TYPE_DIALOGUE, CHALLENGE_TYPE_FORM, CHALLENGE_TYPE_FREE_RESPONSE, CHALLENGE_TYPE_GAP_FILL, CHALLENGE_TYPE_JUDGE, CHALLENGE_TYPE_LISTEN, CHALLENGE_TYPE_LISTEN_COMPREHENSION, CHALLENGE_TYPE_LISTEN_ISOLATION, CHALLENGE_TYPE_LISTEN_MATCH, CHALLENGE_TYPE_LISTEN_SPELL, CHALLENGE_TYPE_LISTEN_TAP, CHALLENGE_TYPE_MATCH, CHALLENGE_TYPE_NAME, CHALLENGE_TYPE_PARTIAL_REVERSE_TRANSLATE, CHALLENGE_TYPE_READ_COMPREHENSION, CHALLENGE_TYPE_SELECT, CHALLENGE_TYPE_SELECT_PRONUNCIATION, CHALLENGE_TYPE_SELECT_TRANSCRIPTION, CHALLENGE_TYPE_SPEAK, CHALLENGE_TYPE_TAP_CLOZE, CHALLENGE_TYPE_TAP_CLOZE_TABLE, CHALLENGE_TYPE_TAP_COMPLETE, CHALLENGE_TYPE_TAP_COMPLETE_TABLE, CHALLENGE_TYPE_TAP_DESCRIBE, CHALLENGE_TYPE_TRANSLATE, CHALLENGE_TYPE_TYPE_CLOZE, CHALLENGE_TYPE_TYPE_CLOZE_TABLE, CHALLENGE_TYPE_TYPE_COMPLETE_TABLE];
  /**
   * @type {string[]}
   */

  const MORPHEME_CHALLENGE_TYPES = [CHALLENGE_TYPE_CHARACTER_INTRO, CHALLENGE_TYPE_CHARACTER_MATCH, CHALLENGE_TYPE_CHARACTER_PUZZLE, CHALLENGE_TYPE_CHARACTER_SELECT, CHALLENGE_TYPE_CHARACTER_TRACE, CHALLENGE_TYPE_SELECT_PRONUNCIATION, CHALLENGE_TYPE_SELECT_TRANSCRIPTION];
  /**
   * @type {Function}
   * @param {object} challenge A challenge.
   * @returns {string} The type of the challenge.
   */

  const getChallengeType = _arg => {
    return _arg.type;
  };
  /**
   * @param {object} challenge A challenge.
   * @returns {string} The language used by the statement of the challenge.
   */

  const getChallengeSourceLanguage = challenge => {
    var _challenge$metadata, _challenge$metadata2;

    return ((_challenge$metadata = challenge.metadata) === null || _challenge$metadata === void 0 ? void 0 : _challenge$metadata.source_language) || challenge.sourceLanguage || ((_challenge$metadata2 = challenge.metadata) === null || _challenge$metadata2 === void 0 ? void 0 : _challenge$metadata2.learning_language);
  };
  /**
   * @param {object} challenge A challenge.
   * @returns {string} The language used by the solution of the challenge.
   */

  const getChallengeTargetLanguage = challenge => {
    var _challenge$metadata3;

    return ((_challenge$metadata3 = challenge.metadata) === null || _challenge$metadata3 === void 0 ? void 0 : _challenge$metadata3.target_language) || challenge.targetLanguage || getChallengeSourceLanguage(challenge);
  };
  /**
   * The result of challenges that have not been completed yet.
   *
   * @type {string}
   */

  const RESULT_NONE = 'none';
  /**
   * The result of challenges to which a correct answer has been given.
   *
   * @type {string}
   */

  const RESULT_CORRECT = 'correct';
  /**
   * The result of challenges to which an incorrect answer has been given.
   *
   * @type {string}
   */

  const RESULT_INCORRECT = 'incorrect';

  /**
   * @type {string}
   */

  const CONTEXT_CHALLENGE = 'challenge';
  /**
   * @type {string}
   */

  const CONTEXT_CHALLENGE_REVIEW = 'challenge_review';
  /**
   * @type {string}
   */

  const CONTEXT_STORY = 'story';
  /**
   * @type {string}
   */

  const CONTEXT_FORUM_DISCUSSION = 'forum_discussion';
  /**
   * @type {string}
   */

  const CONTEXT_CHARACTERS = 'characters';
  /**
   * @type {string}
   */

  const CONTEXT_GUIDEBOOK = 'guidebook';
  /**
   * @type {string}
   */

  const CONTEXT_UNKNOWN = 'unknown';
  /**
   * @type {RegExp}
   */

  const PAGE_URL_REGEXP_STORY = /duolingo\.com\/stories\/(?<story_key>[^/]+)/;
  /**
   * @type {RegExp}
   */

  const PAGE_URL_REGEXP_FORUM_COMMENT = /forum\.duolingo\.com\/comment\/(?<comment_id>[\d]+)/;
  /**
   * @type {RegExp}
   */

  const PAGE_URL_REGEXP_CHARACTER_LIST = /duolingo\.com\/characters\/?/;
  /**
   * @type {RegExp}
   */

  const PAGE_URL_REGEXP_CHARACTER_STUDY = /duolingo\.com\/alphabets\/?/;
  /**
   * @type {RegExp}
   */

  const PAGE_URL_REGEXP_GUIDEBOOK = /duolingo\.com\/guidebook\/(?<language>.+)\/(?<index>[\d]+)\/?/;
  /**
   * @type {RegExp}
   */

  const PAGE_URL_REGEXP_CHALLENGE = /duolingo\.com\/(practice|lesson)\/?/;
  /**
   * @type {string}
   */

  const SELECTOR_CHALLENGE_WRAPPER = '[data-test*="challenge"]';
  /**
   * A CSS selector for the result wrapper of the current challenge screen.
   *
   * It is currently the previous sibling of the wrapper of the "Continue" button (in the challenge footer).
   *
   * @type {string}
   */

  const SELECTOR_CHALLENGE_RESULT_WRAPPER = '._2Fc1K ._1tuLI';
  /**
   * The class name that is applied to the result wrapper of a challenge when the user has given a correct answer.
   *
   * @type {string}
   */

  const CLASS_NAME_CORRECT_CHALLENGE_RESULT_WRAPPER = '_3e9O1';
  /**
   * @type {string}
   */

  const SELECTOR_STORY_ELEMENT = '[data-test="stories-element"]';
  /**
   * @returns {Object} Data about the current context.
   */

  const getCurrentContext = () => {
    const url = document.location.href; // Forum discussions

    let urlMatches = url.match(PAGE_URL_REGEXP_FORUM_COMMENT);

    if (isArray(urlMatches)) {
      return {
        type: CONTEXT_FORUM_DISCUSSION,
        commentId: Number(urlMatches.comment_id) || null
      };
    } // Stories


    urlMatches = url.match(PAGE_URL_REGEXP_STORY);

    if (isArray(urlMatches) || document.querySelector(SELECTOR_STORY_ELEMENT)) {
      var _urlMatches;

      return {
        type: CONTEXT_STORY,
        storyKey: (_urlMatches = urlMatches) === null || _urlMatches === void 0 ? void 0 : _urlMatches.story_key
      };
    } // Characters


    if (url.match(PAGE_URL_REGEXP_CHARACTER_LIST) || url.match(PAGE_URL_REGEXP_CHARACTER_STUDY)) {
      return {
        type: CONTEXT_CHARACTERS
      };
    } // Guidebook


    urlMatches = url.match(PAGE_URL_REGEXP_GUIDEBOOK);

    if (isArray(urlMatches)) {
      return {
        type: CONTEXT_GUIDEBOOK,
        languageName: urlMatches.language,
        unitIndex: Number(urlMatches.index)
      };
    } // Challenges


    const challengeWrapper = document.querySelector(SELECTOR_CHALLENGE_WRAPPER);

    if (challengeWrapper) {
      let challengeType = null;

      for (const key of ((_challengeWrapper$get = challengeWrapper.getAttribute('data-test')) === null || _challengeWrapper$get === void 0 ? void 0 : _challengeWrapper$get.split(/\s+/)) || []) {
        var _challengeWrapper$get, _key$match;

        const possibleType = (_key$match = key.match(/challenge-(?<type>[a-z]+)/i)) === null || _key$match === void 0 ? void 0 : _key$match.groups.type.trim();

        if (CHALLENGE_TYPES.indexOf(possibleType) >= 0) {
          challengeType = possibleType;
          break;
        }
      }

      let result = RESULT_NONE;
      const resultWrapper = document.querySelector(SELECTOR_CHALLENGE_RESULT_WRAPPER);

      if (resultWrapper) {
        result = resultWrapper.classList.contains(CLASS_NAME_CORRECT_CHALLENGE_RESULT_WRAPPER) ? RESULT_CORRECT : RESULT_INCORRECT;
      }

      return {
        type: CONTEXT_CHALLENGE,
        challengeType,
        result,
        isCompleted: RESULT_NONE !== result
      };
    }

    if (url.match(PAGE_URL_REGEXP_CHALLENGE)) {
      return {
        type: CONTEXT_CHALLENGE_REVIEW
      };
    }

    return {
      type: CONTEXT_UNKNOWN
    };
  };

  /**
   * @returns {Object} A console usable for logging data.
   */

  const getLoggingConsole = () => getToolboxIframe().contentWindow.console;
  /**
   * @param {...*} data The error data to log.
   * @returns {void}
   */

  const logError = (...data) => getLoggingConsole().error(...data);

  /**
   * @type {number}
   */
  const PRIORITY_HIGHEST = Number.MAX_SAFE_INTEGER;
  /**
   * @type {number}
   */

  const PRIORITY_LOWEST = 1;
  /**
   * @type {number}
   */

  const PRIORITY_LOW = Math.round(PRIORITY_HIGHEST / 4);
  /**
   * @type {number}
   */

  const PRIORITY_AVERAGE = Math.round(2 * PRIORITY_LOW);

  /**
   * @type {string}
   */

  const SOUND_TYPE_EFFECT = 'effect';
  /**
   * @type {string}
   */

  const SOUND_TYPE_TTS_SENTENCE = 'tts_sentence';
  /**
   * @type {string}
   */

  const SOUND_TYPE_TTS_WORD = 'tts_word';
  /**
   * A character or a syllable.
   *
   * @type {string}
   */

  const SOUND_TYPE_TTS_MORPHEME = 'tts_morpheme';
  /**
   * @type {string}
   */

  const SOUND_TYPE_UNKNOWN = 'unknown';
  /**
   * @type {string}
   */

  const SOUND_SPEED_NORMAL = 'normal';
  /**
   * @type {string}
   */

  const SOUND_SPEED_SLOW = 'slow';
  /**
   * @type {string}
   */

  const SOUND_PLAYBACK_STRATEGY_AUDIO = 'audio';
  /**
   * @type {string}
   */

  const SOUND_PLAYBACK_STRATEGY_HOWLER = 'howler';
  /**
   * @type {string}
   */

  const SOUND_SETTING_RATE = 'rate';
  /**
   * @type {string}
   */

  const SOUND_SETTING_VOLUME = 'volume';
  /**
   * @type {string}
   */

  const FORCED_SETTING_KEY = getUniqueKey('forced_setting');
  /**
   * @param {*} value A setting value that was passed to a setter.
   * @returns {boolean} Whether the value is a forced setting value.
   */

  const isForcedSettingValue = value => isObject(value) && !!value[FORCED_SETTING_KEY];
  /**
   * @type {Function}
   * @param {object} forcedValue A forced setting value.
   * @returns {number} The corresponding base value.
   */


  const getForcedSettingBaseValue = _arg6 => {
    return _arg6.value;
  };
  /**
   * @type {Function}
   * @param {number} A base setting value.
   * @returns {object} The given value, wrapped in a layer that identifies it as a forced value.
   */


  const wrapForcedSettingBaseValue = _arg7 => {
    return {
      [FORCED_SETTING_KEY]: true,
      value: _arg7
    };
  };
  /**
   * @param {string} code The code of a sound setting.
   * @param {*} value A value for the given setting.
   * @returns {boolean} Whether the value is suitable for being applied to a "Howl" object from the "howler.js" library.
   */


  const isValidHowlSettingValue = (code, value) => SOUND_SETTING_RATE === code && isNumber(value) || SOUND_SETTING_VOLUME === code && value >= 0 && value <= 1;
  /**
   * Applies the necessary overrides to ensure that the forced setting values on "Audio" objects are correctly handled,
   * and reapplied / recalculated whenever necessary.
   *
   * @param {string} code The code of a sound setting.
   * @param {string} propertyName The name of the corresponding property on "Audio" objects.
   * @returns {void}
   */


  const applyAudioSettingPropertyOverride = (code, propertyName) => overrideOwnPropertyDescriptor(HTMLMediaElement, propertyName, originalDescriptor => ({ ...originalDescriptor,
    set: function (value) {
      const setting = SOUND_SETTINGS[code];

      if (isNumber(value)) {
        this[setting.originalValueKey] = value;

        if (hasObjectProperty(this, setting.valueKey)) {
          if (!this[setting.isRelativeKey]) {
            value = this[setting.valueKey];
          } else {
            value = clampSoundSettingValue(code, value * this[setting.valueKey]);
          }
        }
      } else if (isForcedSettingValue(value)) {
        value = getForcedSettingBaseValue(value);
      }

      if (isNumber(value)) {
        this[setting.listenerValueKey] = value;
      }

      originalDescriptor.set.call(this, value);
    }
  }));
  /**
   * Applies the necessary overrides to ensure that the forced setting values on "Howl" objects are correctly handled,
   * and reapplied / recalculated whenever necessary.
   *
   * @param {string} code The code of a sound setting.
   * @param {string} functionName The name of the function usable to manage the setting for "Howl" objects.
   * @returns {void}
   */


  const applyHowlSettingFunctionOverride = (code, functionName) => overrideInstanceMethod('Howl', functionName, originalHowlSetter => function () {
    const self = this;
    const args = arguments;
    const setting = SOUND_SETTINGS[code];
    let isForcedValueUpdate = false;
    const originalQueueSize = self._queue.length;

    if (args.length === 1 || args.length === 2 && typeof args[1] === 'undefined') {
      if (self._getSoundIds().indexOf(args[0]) === -1) {
        if (isForcedSettingValue(args[0])) {
          isForcedValueUpdate = true;
          args[0] = getForcedSettingBaseValue(args[0]);
        } else if (isValidHowlSettingValue(code, args[0])) {
          self[setting.originalValueKey] = args[0];

          if (hasObjectProperty(self, setting.valueKey)) {
            isForcedValueUpdate = true;

            if (!self[setting.isRelativeKey]) {
              args[0] = self[setting.valueKey];
            } else {
              args[0] = clampSoundSettingValue(code, args[0] * self[setting.valueKey]);
            }
          }
        }

        if (isForcedValueUpdate) {
          self[setting.listenerValueKey] = args[0];
        }
      }
    }

    const result = originalHowlSetter.apply(self, arguments);

    if (isForcedValueUpdate && originalQueueSize < self._queue.length) {
      self._queue[self._queue.length - 1].action = function () {
        args[0] = wrapForcedSettingBaseValue(args[0]);
        self[functionName](...args);
      };
    }

    return result;
  });
  /**
   * @param {string} code The code of a sound setting.
   * @param {string} audioPropertyName The name of the corresponding property on "Audio" objects.
   * @param {string} howlFunctionName The name of the corresponding function on "Howl" objects.
   * @param {object} baseConfig The base configuration data for the setting.
   * @returns {object} Full configuration data for the given setting.
   */


  const prepareSoundSettingConfig = (code, audioPropertyName, howlFunctionName, baseConfig) => ({ ...baseConfig,
    functions: {
      [SOUND_PLAYBACK_STRATEGY_AUDIO]: {
        applyOverride: () => applyAudioSettingPropertyOverride(code, howlFunctionName),
        getter: _arg8 => {
          return _arg8[audioPropertyName];
        },
        setter: (_arg9, _arg10) => {
          return _arg9[audioPropertyName] = _arg10;
        },
        hasQueuedUpdate: () => false
      },
      [SOUND_PLAYBACK_STRATEGY_HOWLER]: {
        applyOverride: () => applyHowlSettingFunctionOverride(code, howlFunctionName),
        getter: _arg11 => {
          return _arg11[howlFunctionName]();
        },
        setter: (_it, _arg12) => {
          return _it[howlFunctionName](_arg12);
        },
        hasQueuedUpdate: _it3 => {
          return _it3._queue.find(_it3 => {
            return _it3.event === howlFunctionName;
          });
        }
      }
    },
    priorityKey: getUniqueKey(`${code}_priority`),
    isRelativeKey: getUniqueKey(`${code}_is_relative`),
    valueKey: getUniqueKey(`forced_${code}_value`),
    originalValueKey: getUniqueKey(`original_${code}_value`),
    listenerValueKey: getUniqueKey(`${code}_value`) // This value is used for compatibility with old versions.

  });
  /**
   * @type {Object}
   */


  const SOUND_SETTINGS = {
    [SOUND_SETTING_RATE]: prepareSoundSettingConfig(SOUND_SETTING_RATE, 'playbackRate', 'rate', {
      minValue: 0.5,
      maxValue: 4.0,
      defaultValue: 1.0
    }),
    [SOUND_SETTING_VOLUME]: prepareSoundSettingConfig(SOUND_SETTING_VOLUME, 'volume', 'volume', {
      minValue: 0.0,
      maxValue: 1.0,
      defaultValue: 1.0
    })
  };
  /**
   * @param {string} code The code of a sound setting.
   * @param {number} value A value for the given setting.
   * @returns {number} The given value, clamped if necessary.
   */

  const clampSoundSettingValue = (code, value) => !SOUND_SETTINGS[code] ? value : Math.max(SOUND_SETTINGS[code].minValue, Math.min(value, SOUND_SETTINGS[code].maxValue));

  /**
   * @type {string}
   */

  const KEY_EVENT_LISTENERS = 'event_listeners';
  /**
   * @returns {string} A unique ID usable for an event listener.
   */

  const getUniqueEventListenerId = () => `__listener::${bumpGlobalCounter('last_event_listener_id')}__`;
  /**
   * @type {Function}
   * @param {string} event An event type.
   * @returns {Object<string, Function[]>} The registered listeners for the given event type.
   */


  const getEventListeners = _arg11 => {
    var _getSharedGlobalVaria;

    return ((_getSharedGlobalVaria = getSharedGlobalVariable(KEY_EVENT_LISTENERS, {})) === null || _getSharedGlobalVaria === void 0 ? void 0 : _getSharedGlobalVaria[_arg11]) || {};
  };
  /**
   * @param {string} event An event type.
   * @param {Object<string, Function[]>} listeners The new set of listeners for the given event type.
   * @returns {void}
   */


  const setEventListeners = (event, listeners) => {
    updateSharedGlobalVariable(KEY_EVENT_LISTENERS, _arg12 => {
      return Object.assign(_arg12 || {}, {
        [event]: listeners
      });
    });
  };
  /**
   * @type {Function}
   * @param {string} event An event type.
   * @returns {boolean} Whether any listener is registered for the given event type.
   */


  const hasEventListeners = event => !isEmptyObject(getEventListeners(event));
  /**
   * @type {Function}
   * @param {string} event An event type.
   * @param {string} listenerId A listener ID.
   * @returns {boolean} Whether a listener with the given ID was registered for the given event type.
   */


  const hasEventListener = (_arg13, _arg14) => {
    return !!getEventListeners(_arg13)[_arg14];
  };
  /**
   * @param {string} event An event type.
   * @param {Function} callback The function to be called with the listeners registered for the given event type.
   * @returns {*|null} The result of the callback, if any listener exists for the given event type. Otherwise, null.
   */


  const withEventListeners = (event, callback) => {
    const listeners = getEventListeners(event);
    return isEmptyObject(listeners) ? null : callback(Object.values(listeners));
  };
  /**
   * Registers a new listener for some event type.
   *
   * If a listener with the same ID already exists for the given event type, it will be replaced.
   *
   * @param {string} event An event type.
   * @param {Function} callback The function to be called with the event payload when a matching event is dispatched.
   * @param {string=} listenerId The listener ID.
   * @returns {Function} A function usable to unregister the listener.
   */


  const registerEventListener = (event, callback, listenerId = getUniqueEventListenerId()) => {
    const listeners = getEventListeners(event);
    listeners[listenerId] = callback;
    setEventListeners(event, listeners);
    return () => unregisterEventListener(event, listenerId);
  };
  /**
   * Registers a new listener for some event type, derived from another base event type.
   *
   * If a listener with the same ID already exists for the given derived event type, it will be replaced.
   *
   * @param {string} derivedEvent The derived event type.
   * @param {string} baseEvent The base event type.
   * @param {Function} derivedCallback
   * The function to be called with the event payload when a matching derived event is dispatched.
   * @param {Function} mapPayload
   * The function usable to map the payloads of base events to the payloads of derived events.
   * This function must return an array of arguments, or anything else if the derived event should not be dispatched.
   * @param {Function=} registerBaseListener
   * The function usable to register the shared listener for base events, when necessary, given:
   * - the base event type,
   * - a callback,
   * - a listener ID.
   * @param {string=} derivedListenerId The ID of the listener for derived events.
   * @returns {Function} A function usable to unregister the listener for derived events.
   */


  const registerDerivedEventListener = (derivedEvent, baseEvent, derivedCallback, mapPayload, registerBaseListener = registerEventListener, derivedListenerId = getUniqueEventListenerId()) => {
    const baseListenerId = `__${baseEvent}::${derivedEvent}__`;

    if (!hasEventListener(baseEvent, baseListenerId)) {
      registerBaseListener(baseEvent, (...payload) => {
        const derivedPayload = mapPayload(...payload);
        isArray(derivedPayload) && dispatchEvent(derivedEvent, ...derivedPayload);
      }, baseListenerId);
    }

    const unregisterDerived = registerEventListener(derivedEvent, derivedCallback, derivedListenerId);
    return () => {
      unregisterDerived();

      if (!hasEventListeners(derivedEvent)) {
        unregisterEventListener(baseEvent, baseListenerId);
      }
    };
  };
  /**
   * @param {string} event An event type.
   * @param {string} listenerId A listener ID.
   * @returns {void}
   */


  const unregisterEventListener = (event, listenerId) => {
    const listeners = getEventListeners(event);
    delete listeners[listenerId];
    setEventListeners(event, listeners);
  };
  /**
   * @type {Function}
   * @param {string} event The event type.
   * @param {...*} payload The event payload.
   * @returns {Array|null} The results of calling the registered listeners, if there is any. Otherwise, null.
   */


  const dispatchEvent = (event, ...payload) => withEventListeners(event, listeners => listeners.flatMap(listener => {
    try {
      return [listener(...payload)];
    } catch (error) {
      return [];
    }
  }));
  /**
   * @type {string}
   */


  const EVENT_TYPE_USER_DATA_LOADED = 'user_data_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_PRACTICE_SESSION_LOADED = 'practice_session_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_PRACTICE_CHALLENGES_LOADED = 'practice_challenges_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_PRE_FETCHED_SESSION_LOADED = 'pre_fetched_session_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_STORY_LOADED = 'story_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_ALPHABETS_LOADED = 'alphabets_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_ALPHABET_HINTS_LOADED = 'alphabet_hints_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_FORUM_DISCUSSION_LOADED = 'forum_discussion_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_GUIDEBOOK_LOADED = 'guidebook_loaded';
  /**
   * @type {string}
   */

  const EVENT_TYPE_SOUND_INITIALIZED = 'sound_initialized';
  /**
   * @type {string}
   */

  const EVENT_TYPE_SOUND_PLAYBACK_REQUESTED = 'sound_playback_requested';
  /**
   * @type {string}
   */

  const EVENT_TYPE_SOUND_PLAYBACK_CONFIRMED = 'sound_playback_confirmed';
  /**
   * @type {string}
   */

  const EVENT_TYPE_SOUND_PLAYBACK_CANCELLED = 'sound_playback_cancelled';
  /**
   * @type {string}
   */

  const EVENT_TYPE_UI_LOADED = 'ui_loaded';
  /**
   * @type {object<string, RegExp>}
   */

  const BASE_HTTP_REQUEST_EVENT_URL_REGEXPS = {
    [EVENT_TYPE_ALPHABETS_LOADED]: /\/[\d]{4}-[\d]{2}-[\d]{2}\/alphabets\/courses\/(?<toLanguage>[^/]+)\/(?<fromLanguage>[^/?]+)\/?/g,
    [EVENT_TYPE_FORUM_DISCUSSION_LOADED]: /\/comments\/([\d]+)/g,
    [EVENT_TYPE_GUIDEBOOK_LOADED]: /\/guidebook\/compiled\/(?<toLanguage>[^/]+)\/(?<fromLanguage>[^/]+)\/?/g,
    [EVENT_TYPE_PRACTICE_SESSION_LOADED]: /\/[\d]{4}-[\d]{2}-[\d]{2}\/sessions/g,
    [EVENT_TYPE_STORY_LOADED]: /\/api2\/stories/g,
    [EVENT_TYPE_USER_DATA_LOADED]: /\/[\d]{4}-[\d]{2}-[\d]{2}\/users\/[\d]+/g
  };
  /**
   * @type {string}
   */

  const KEY_HTTP_REQUEST_URL_EVENT_MAP = 'http_request_url_event_map';
  /**
   * @typedef {object} HttpUrlEvent
   * @property {string} eventType An event type.
   * @property {RegExp} urlRegExp A regular expression for the URLs that should trigger the event type when called.
   * @property {object} requestData The base request data, common to all matching requests.
   */

  /**
   * @returns {Map<*, HttpUrlEvent>} A map from unique keys to URL events.
   */

  const getHttpRequestUrlEventMap = () => {
    let urlEventMap = getSharedGlobalVariable(KEY_HTTP_REQUEST_URL_EVENT_MAP);

    if (!(urlEventMap instanceof Map)) {
      urlEventMap = new Map();
      Object.entries(BASE_HTTP_REQUEST_EVENT_URL_REGEXPS).forEach(([eventType, urlRegExp]) => {
        urlEventMap.set(urlRegExp, {
          eventType,
          urlRegExp,
          requestData: {}
        });
      });
      setSharedGlobalVariable(KEY_HTTP_REQUEST_URL_EVENT_MAP, urlEventMap);
    }

    return urlEventMap;
  };
  /**
   * @param {string} event An event type.
   * @param {Array<string|RegExp>} urls URLs that should trigger the given event type when called.
   * @param {object} requestData The base request data, common to all matching requests.
   */


  const registerAdditionalUrlEvents = (event, urls, requestData = {}) => {
    const urlEventMap = getHttpRequestUrlEventMap();

    for (const url of urls) {
      urlEventMap.set(url, {
        eventType: event,
        requestData,
        urlRegExp: url instanceof RegExp ? url : new RegExp(escapeRegExp(String(url)), 'g')
      });
    }
  };
  /**
   * @param {string} url An URL.
   * @returns {{ eventType: string, requestData: object }|null} The corresponding event data, if any.
   */


  const getUrlEventData = url => {
    let eventType;
    let requestData;
    const urlEventMap = getHttpRequestUrlEventMap();

    for (const urlEvent of urlEventMap.values()) {
      const urlMatches = Array.from(url.matchAll(urlEvent.urlRegExp))[0];

      if (urlMatches) {
        eventType = urlEvent.eventType;
        requestData = { ...urlEvent.requestData,
          ...(urlMatches.groups || {})
        };
        break;
      }
    }

    return eventType ? {
      eventType,
      requestData
    } : null;
  };
  /**
   * @param {string} event An event type based on XHR requests to some specific URLs.
   * @param {Function} callback The function to be called with the response data, when a matching request is made.
   * @param {string=} listenerId The listener ID.
   * @returns {Function} A function usable to unregister the listener.
   */


  const registerHttpRequestEventListener = (event, callback, listenerId = getUniqueEventListenerId()) => {
    overrideInstanceMethod('XMLHttpRequest', 'open', originalXhrOpen => function (method, url, async, user, password) {
      const urlEvent = getUrlEventData(url);

      if (urlEvent) {
        withEventListeners(urlEvent.eventType, listeners => {
          this.addEventListener('load', () => {
            try {
              const responseData = isObject(this.response) ? this.response : JSON.parse(this.responseText);
              listeners.forEach(_it => {
                return _it(responseData, urlEvent.requestData);
              });
            } catch (error) {
              logError(error, `Could not handle the XHR result (event: "${urlEvent.eventType}"): `);
            }
          });
        });
      }

      return originalXhrOpen.call(this, method, url, async, user, password);
    }, 3);
    overrideGlobalFunction('fetch', originalFetch => function (resource, init) {
      const url = resource instanceof Request ? resource.url : String(resource);
      let loadCallback = null;
      const urlEvent = getUrlEventData(url);

      if (urlEvent) {
        loadCallback = withEventListeners(urlEvent.eventType, listeners => responseData => {
          try {
            listeners.forEach(_it2 => {
              return _it2(responseData, urlEvent.requestData);
            });
          } catch (error) {
            logError(error, `Could not handle the fetch result (event: "${urlEvent.eventType}"): `);
          }
        });
      }

      return originalFetch.call(this, resource, init).then(response => {
        if (!loadCallback) {
          return response;
        }

        const originalResponse = response.clone();
        return response.json().then(payload => {
          loadCallback(payload);
          return originalResponse;
        }).catch(() => originalResponse);
      });
    }, 2);
    return registerEventListener(event, callback, listenerId);
  };
  /**
   * @param {Function} callback The function to be called with the session data, when a pre-fetched session is loaded.
   * @param {string=} listenerId The listener ID.
   * @returns {Function} A function usable to unregister the listener.
   */

  const registerPreFetchedSessionLoadListener = (callback, listenerId = getUniqueEventListenerId()) => {
    const event = EVENT_TYPE_PRE_FETCHED_SESSION_LOADED;

    const patchIdbRequest = request => withEventListeners(event, listeners => {
      request.addEventListener('success', () => {
        try {
          listeners.forEach(_it3 => {
            return _it3(request.result);
          });
        } catch (error) {
          logError(error, `Could not handle the IDBRequest result (event: ${event}): `);
        }
      });
    });

    overrideInstanceMethod('IDBIndex', 'get', originalGet => function (key) {
      const request = originalGet.call(this, key);

      if (isString(key) && key && this.objectStore.name === 'prefetchedSessions') {
        patchIdbRequest(request);
      }

      return request;
    });
    overrideInstanceMethod('IDBObjectStore', 'get', originalGet => function (key) {
      const request = originalGet.call(this, key);

      if (this.name === 'prefetchedSessions') {
        patchIdbRequest(request);
      }

      return request;
    });
    return registerEventListener(event, callback, listenerId);
  };
  /**
   * @type {Function}
   * @param {Function} callback The function to be called with the response data when a story is loaded.
   * @returns {Function} A function usable to stop being notified of newly loaded stories.
   */

  const onStoryLoaded = _arg17 => {
    return registerHttpRequestEventListener(EVENT_TYPE_STORY_LOADED, _arg17);
  };
  /**
   * @type {Function}
   * @param {Function} callback The function to be called with the response and request data when alphabets are loaded.
   * @returns {Function} A function usable to stop being notified of newly loaded alphabets.
   */

  const onAlphabetsLoaded = (_arg18, _arg19) => {
    return registerHttpRequestEventListener(EVENT_TYPE_ALPHABETS_LOADED, _arg18, _arg19);
  };
  /**
   * @type {Function}
   * @param {Function} callback The function to be called with the response data when alphabet hints are loaded.
   * @returns {Function} A function usable to stop being notified of newly loaded alphabet hints.
   */

  const onAlphabetHintsLoaded = _arg20 => {
    return registerHttpRequestEventListener(EVENT_TYPE_ALPHABET_HINTS_LOADED, _arg20);
  };
  /**
   * @type {Function}
   * @param {Function} callback The function to be called with the response data when a forum discussion is loaded.
   * @returns {Function} A function usable to stop being notified of newly loaded forum discussions.
   */

  const onForumDiscussionLoaded = _arg21 => {
    return registerHttpRequestEventListener(EVENT_TYPE_FORUM_DISCUSSION_LOADED, _arg21);
  };
  /**
   * @type {Function}
   * @param {Function} callback The function to be called with the response data when a guidebook is loaded.
   * @returns {Function} A function usable to stop being notified of newly loaded guidebooks.
   */

  const onGuidebookLoaded = _arg22 => {
    return registerHttpRequestEventListener(EVENT_TYPE_GUIDEBOOK_LOADED, _arg22);
  };
  /**
   * @type {Function}
   * @param {Function} callback The function to be called with the challenges data when a practice session is loaded.
   * @returns {Function} A function usable to stop being notified of newly loaded challenges.
   */

  const onPracticeChallengesLoaded = callback => {
    const getSessionChallenges = sessionData => {
      let payload;

      if (isObject(sessionData)) {
        var _sessionData$adaptive;

        if (isObject(sessionData.session)) {
          sessionData = sessionData.session;
        }

        const challenges = [sessionData.challenges, sessionData.adaptiveChallenges, sessionData.easierAdaptiveChallenges, sessionData.mistakesReplacementChallenges, (_sessionData$adaptive = sessionData.adaptiveInterleavedChallenges) === null || _sessionData$adaptive === void 0 ? void 0 : _sessionData$adaptive.challenges].filter(isArray).flat();
        const sessionMetaData = sessionData.metadata || {};
        payload = [{
          challenges,
          sessionMetaData
        }];
      }

      return payload;
    };

    const unregisterFreshChallengesListener = registerDerivedEventListener(EVENT_TYPE_PRACTICE_CHALLENGES_LOADED, EVENT_TYPE_PRACTICE_SESSION_LOADED, callback, getSessionChallenges, registerHttpRequestEventListener);
    const unregisterPreFetchedChallengesListener = registerDerivedEventListener(EVENT_TYPE_PRACTICE_CHALLENGES_LOADED, EVENT_TYPE_PRE_FETCHED_SESSION_LOADED, callback, getSessionChallenges, (_arg4, _arg5, _arg9) => {
      return registerPreFetchedSessionLoadListener(_arg5, _arg9);
    });
    return () => {
      unregisterFreshChallengesListener();
      unregisterPreFetchedChallengesListener();
    };
  };
  /**
   * @typedef {Object} SoundData
   * @property {string} url The URL of the sound (that may be of any shape).
   * @property {string} type The type of the sound.
   * @property {string} speed The speed of the sound.
   * @property {string|null} language The language of the sound, in case of a sentence / word.
   */

  /**
   * @param {string} url The URL of the effect sound.
   * @returns {SoundData} Relevant data about the given sound.
   */

  const getEffectSoundData = url => ({
    url,
    type: SOUND_TYPE_EFFECT,
    speed: SOUND_SPEED_NORMAL,
    language: null
  });
  /**
   * @param {string} url The URL of the sentence sound.
   * @param {string} language The language of the sentence.
   * @returns {SoundData} Relevant data about the given sound.
   */


  const getNormalSentenceSoundData = (url, language) => ({
    url,
    type: SOUND_TYPE_TTS_SENTENCE,
    speed: SOUND_SPEED_NORMAL,
    language
  });
  /**
   * @param {string} url The URL of the sentence sound.
   * @param {string} language The language of the sentence.
   * @returns {SoundData} Relevant data about the given sound.
   */


  const getSlowSentenceSoundData = (url, language) => ({
    url,
    type: SOUND_TYPE_TTS_SENTENCE,
    speed: SOUND_SPEED_SLOW,
    language
  });
  /**
   * @param {string} url The URL of the word sound.
   * @param {string} language The language of the word.
   * @returns {SoundData} Relevant data about the given sound.
   */


  const getNormalWordSoundData = (url, language) => ({
    url,
    type: SOUND_TYPE_TTS_WORD,
    speed: SOUND_SPEED_NORMAL,
    language
  });
  /**
   * @param {string} url The URL of the morpheme sound.
   * @param {string} language The language of the morpheme.
   * @returns {SoundData} Relevant data about the given sound.
   */


  const getNormalMorphemeSoundData = (url, language) => ({
    url,
    type: SOUND_TYPE_TTS_MORPHEME,
    speed: SOUND_SPEED_NORMAL,
    language
  });
  /**
   * @type {Object<string, SoundData>}
   */


  const DEFAULT_SOUNDS_DATA_MAP = Object.fromEntries(['/sounds/7abe057dc8446ad325229edd6d8fd250.mp3', '/sounds/2aae0ea735c8e9ed884107d6f0a09e35.mp3', '/sounds/421d48c53ad6d52618dba715722278e0.mp3', '/sounds/37d8f0b39dcfe63872192c89653a93f6.mp3', '/sounds/0a27c1ee63dd220647e8410a0029aed2.mp3', '/sounds/a28ff0a501ef5f33ca78c0afc45ee53e.mp3', '/sounds/2e4669d8cf839272f0731f8afa488caf.mp3', '/sounds/f0b6ab4396d5891241ef4ca73b4de13a.mp3'].map(path => [path, getEffectSoundData(path)]));
  /**
   * @type {RegExp}
   */

  const URL_REGEXP_TTS_TOKEN = /\/duolingo-data\/tts\/(?<language>[a-z-_]+)\/token\//i;
  /**
   * @type {string}
   */

  const KEY_SOUNDS_DATA_MAP = 'sound_type_map';
  /**
   * @type {string}
   */

  const KEY_IS_HOWLER_USED = 'is_howler_used';
  /**
   * @returns {Object<string, SoundData>} Relevant data about all the detected sounds, by path on the corresponding CDNs.
   */

  const getSoundsDataMap = () => getSharedGlobalVariable(KEY_SOUNDS_DATA_MAP, DEFAULT_SOUNDS_DATA_MAP);
  /**
   * @param {string} path The path of a sound on its CDN.
   * @returns {SoundData|null} Relevant data about the given sound, if it was loaded and detected.
   */


  const getSoundData = path => {
    const soundData = getSoundsDataMap()[path];

    if (isObject(soundData)) {
      return soundData;
    }

    const tokenMatches = path.match(URL_REGEXP_TTS_TOKEN);

    if (tokenMatches) {
      return getNormalWordSoundData(path, tokenMatches.language);
    }

    return null;
  };
  /**
   * @type {string[]}
   */


  const SOUND_TYPE_RELEVANCE = [SOUND_TYPE_UNKNOWN, SOUND_TYPE_TTS_SENTENCE, SOUND_TYPE_TTS_WORD, SOUND_TYPE_TTS_MORPHEME, SOUND_TYPE_EFFECT];
  /**
   * @type {string[]}
   */

  const SOUND_SPEED_RELEVANCE = [SOUND_SPEED_NORMAL, SOUND_SPEED_SLOW];
  /**
   * @type {Function}
   * @param {SoundData} dataA Some sound data.
   * @param {SoundData} dataB Other sound data.
   * @returns {number}
   * A number:
   * - > 0 if the first sound data are more relevant than the second,
   * - < 0 if the second sound data are more relevant than the first,
   * - 0, if both sound data are equally relevant.
   */

  const compareSoundDataRelevance = (_arg28, _arg29) => {
    return compareWith([(_arg24, _arg25) => {
      return SOUND_TYPE_RELEVANCE.indexOf(_arg24.type) - SOUND_TYPE_RELEVANCE.indexOf(_arg25.type);
    }, (_arg26, _arg27) => {
      return SOUND_SPEED_RELEVANCE.indexOf(_arg26.speed) - SOUND_SPEED_RELEVANCE.indexOf(_arg27.speed);
    }], _arg28, _arg29);
  };
  /**
   * @param {SoundData[]} newData New data about a set of sounds.
   * @returns {void}
   */


  const registerSoundsData = newData => {
    const soundsData = getSoundsDataMap() || {};

    for (const soundData of newData) {
      const path = getUrlPath(soundData.url);

      if (!soundsData[path] || compareSoundDataRelevance(soundData, soundsData[path]) > 0) {
        soundsData[path] = soundData;
      }
    }

    setSharedGlobalVariable(KEY_SOUNDS_DATA_MAP, soundsData);
  };
  /**
   * @type {number}
   */


  const SOUND_DETECTION_LISTENERS_VERSION = 4;
  /**
   * @type {string}
   */

  const KEY_SOUND_DETECTION_LISTENERS_VERSION = 'sound_detection_listeners_version';
  /**
   * @type {string}
   */

  const KEY_SOUND_DETECTION_UNREGISTRATION_CALLBACKS = 'sound_detection_unregistration_callbacks';
  /**
   * @param {Object} sound The configuration of a speaker sound.
   * @param {string} type The type of the sound.
   * @param {string} language The language of the sound.
   * @returns {SoundData} Relevant data about the given sound.
   */

  const getSpeakerSoundData = (sound, type, language) => {
    var _sound$speed;

    return {
      url: sound.url,
      type,
      speed: ((_sound$speed = sound.speed) === null || _sound$speed === void 0 ? void 0 : _sound$speed.value) || SOUND_SPEED_NORMAL,
      language
    };
  };
  /**
   * @param {Array} challenges A list of challenges.
   * @returns {void}
   */


  const registerPracticeChallengesSoundsData = challenges => {
    const challengeSounds = [];

    for (const challenge of challenges) {
      var _challenge$metadata;

      const challengeType = getChallengeType(challenge);
      const sourceLanguage = getChallengeSourceLanguage(challenge);
      const targetLanguage = getChallengeTargetLanguage(challenge);

      if (isString(challenge.tts)) {
        // The challenge statement.
        const getTtsSoundData = MORPHEME_CHALLENGE_TYPES.indexOf(challengeType) >= 0 ? getNormalMorphemeSoundData : getNormalSentenceSoundData;
        challengeSounds.push(getTtsSoundData(challenge.tts, sourceLanguage));
      }

      if (isString(challenge.slowTts)) {
        // The challenge statement, slowed down.
        challengeSounds.push(getSlowSentenceSoundData(challenge.slowTts, sourceLanguage));
      }

      if (isString(challenge.solutionTts)) {
        // The challenge solution.
        challengeSounds.push(getNormalSentenceSoundData(challenge.solutionTts, targetLanguage));
      }

      if (isArray(challenge.choices)) {
        // The possible choices for MCQ-like challenges, or the available words for the word banks.
        const getChoiceSoundData = MORPHEME_CHALLENGE_TYPES.indexOf(challengeType) === -1 ? getNormalWordSoundData : getNormalMorphemeSoundData;
        challengeSounds.push(challenge.choices.map(_it5 => {
          return _it5 === null || _it5 === void 0 ? void 0 : _it5.tts;
        }).filter(isString).map(_arg30 => {
          return getChoiceSoundData(_arg30, targetLanguage);
        }));
      }

      if (isArray(challenge.tokens)) {
        // The words that make up the statement for most types of challenges.
        challengeSounds.push(challenge.tokens.map(_it6 => {
          return _it6 === null || _it6 === void 0 ? void 0 : _it6.tts;
        }).filter(isString).map(_arg31 => {
          return getNormalWordSoundData(_arg31, sourceLanguage);
        }));
      }

      if (isArray(challenge.displayTokens)) {
        // The words that make up the statement for (at least) definitions.
        challengeSounds.push(challenge.displayTokens.map(_it7 => {
          var _it7$hintToken;

          return _it7 === null || _it7 === void 0 ? void 0 : (_it7$hintToken = _it7.hintToken) === null || _it7$hintToken === void 0 ? void 0 : _it7$hintToken.tts;
        }).filter(isString).map(_arg32 => {
          return getNormalWordSoundData(_arg32, sourceLanguage);
        }));
      }

      if (isArray(challenge.questionTokens)) {
        // The words that make up the statement for (at least) listening comprehension challenges.
        challengeSounds.push(challenge.questionTokens.map(_it8 => {
          return _it8 === null || _it8 === void 0 ? void 0 : _it8.tts;
        }).filter(isString).map(_arg33 => {
          return getNormalWordSoundData(_arg33, targetLanguage);
        }));
      }

      if (isArray((_challenge$metadata = challenge.metadata) === null || _challenge$metadata === void 0 ? void 0 : _challenge$metadata.speakers)) {
        // The sentences (and corresponding words) that make up a dialogue, voiced  by different speakers.
        for (const speaker of challenge.metadata.speakers) {
          var _speaker$tts, _speaker$tts2;

          if (isObject((_speaker$tts = speaker.tts) === null || _speaker$tts === void 0 ? void 0 : _speaker$tts.tokens)) {
            challengeSounds.push(Object.values(speaker.tts.tokens).filter(_arg34 => {
              return isString(_arg34.url);
            }).map(_arg35 => {
              return getSpeakerSoundData(_arg35, SOUND_TYPE_TTS_WORD, targetLanguage);
            }));
          }

          if (isArray((_speaker$tts2 = speaker.tts) === null || _speaker$tts2 === void 0 ? void 0 : _speaker$tts2.sentence)) {
            challengeSounds.push(speaker.tts.sentence.filter(_arg36 => {
              return isString(_arg36.url);
            }).map(_arg37 => {
              return getSpeakerSoundData(_arg37, SOUND_TYPE_TTS_SENTENCE, targetLanguage);
            }));
          }
        }
      }

      if (isArray(challenge.pairs)) {
        // The pairs of characters or words for matching challenges.
        const getPairSoundData = MORPHEME_CHALLENGE_TYPES.indexOf(challengeType) === -1 ? getNormalWordSoundData : getNormalMorphemeSoundData;
        challengeSounds.push(challenge.pairs.map(_it9 => {
          return _it9 === null || _it9 === void 0 ? void 0 : _it9.tts;
        }).filter(isString).map(_arg38 => {
          return getPairSoundData(_arg38, targetLanguage);
        }));
      }

      if (isArray(challenge.options)) {
        // The choices for listening fill-in-the-blank challenges, or "How do I say?" challenges.
        challengeSounds.push(challenge.options.map(_it10 => {
          return _it10 === null || _it10 === void 0 ? void 0 : _it10.tts;
        }).filter(isString).map(_arg39 => {
          return getNormalWordSoundData(_arg39, targetLanguage);
        }));
      }

      if (isArray(challenge.dialogue)) {
        // The sentences (and corresponding words) that make up a dialogue, voiced  by different speakers.
        challengeSounds.push(challenge.dialogue.map(_it11 => {
          return _it11 === null || _it11 === void 0 ? void 0 : _it11.tts;
        }).filter(isString).map(_arg40 => {
          return getNormalSentenceSoundData(_arg40, targetLanguage);
        }));
        challengeSounds.push(challenge.dialogue.map(_it12 => {
          return _it12 === null || _it12 === void 0 ? void 0 : _it12.hintTokens;
        }).filter(isArray).flat().map(_it13 => {
          return _it13 === null || _it13 === void 0 ? void 0 : _it13.tts;
        }).filter(isString).map(_arg41 => {
          return getNormalWordSoundData(_arg41, targetLanguage);
        }));
      }
    }

    registerSoundsData(challengeSounds.flat());
  };
  /**
   * @param {object} story A story.
   * @returns {void}
   */


  const registerStorySoundsData = story => {
    const _ref = story.learningLanguage;
    isArray(story === null || story === void 0 ? void 0 : story.elements) && registerSoundsData(story.elements.map(_it14 => {
      var _it14$line;

      return (_it14 === null || _it14 === void 0 ? void 0 : (_it14$line = _it14.line) === null || _it14$line === void 0 ? void 0 : _it14$line.content) || (_it14 === null || _it14 === void 0 ? void 0 : _it14.learningLanguageTitleContent);
    }).flatMap(_arg => {
      return [_arg === null || _arg === void 0 ? void 0 : _arg.audio, _arg === null || _arg === void 0 ? void 0 : _arg.audioPrefix, _arg === null || _arg === void 0 ? void 0 : _arg.audioSuffix];
    }).map(_it15 => {
      return _it15 === null || _it15 === void 0 ? void 0 : _it15.url;
    }).filter(isString).map(_arg42 => {
      return getNormalSentenceSoundData(_arg42, _ref);
    }));
  };
  /**
   * @param {object} payload The response payload.
   * @param {object} languages Language data from the alphabets request.
   * @returns {void}
   */


  const registerAlphabetsSoundsData = (payload, languages) => {
    if (isArray(payload === null || payload === void 0 ? void 0 : payload.alphabets) && isString(languages === null || languages === void 0 ? void 0 : languages.toLanguage)) {
      const _ref2 = languages.toLanguage;
      registerSoundsData(payload.alphabets.flatMap(_it16 => {
        return _it16 === null || _it16 === void 0 ? void 0 : _it16.groups;
      }).flatMap(_it17 => {
        return _it17 === null || _it17 === void 0 ? void 0 : _it17.characters;
      }).flat().map(_it18 => {
        return _it18 === null || _it18 === void 0 ? void 0 : _it18.ttsUrl;
      }).filter(isString).map(_arg43 => {
        return getNormalMorphemeSoundData(_arg43, _ref2);
      }));
      const hintsUrls = [];

      for (const alphabet of payload.alphabets) {
        var _alphabet$explanation;

        if (isString(alphabet.explanationUrl)) {
          hintsUrls.push(alphabet.explanationUrl);
        }

        if (isArray((_alphabet$explanation = alphabet.explanationListing) === null || _alphabet$explanation === void 0 ? void 0 : _alphabet$explanation.groups)) {
          hintsUrls.push(...alphabet.explanationListing.groups.flatMap(_it19 => {
            return _it19 === null || _it19 === void 0 ? void 0 : _it19.tips;
          }).map(_it20 => {
            return _it20 === null || _it20 === void 0 ? void 0 : _it20.url;
          }).filter(isString));
        }
      }

      if (hintsUrls.length > 0) {
        registerAdditionalUrlEvents(EVENT_TYPE_ALPHABET_HINTS_LOADED, hintsUrls, languages);
      }
    }
  };
  /**
   * @param {object} payload The response payload.
   * @param {object} languages Language data from the original alphabets request.
   * @returns {void}
   */


  const registerAlphabetHintsSoundsData = (payload, languages) => {
    if (isArray(payload === null || payload === void 0 ? void 0 : payload.elements) && isString(languages === null || languages === void 0 ? void 0 : languages.toLanguage)) {
      const tokenSounds = payload.elements.map(_it21 => {
        return _it21 === null || _it21 === void 0 ? void 0 : _it21.element;
      }).flatMap(_it22 => {
        var _it22$tokenTTS;

        return _it22 === null || _it22 === void 0 ? void 0 : (_it22$tokenTTS = _it22.tokenTTS) === null || _it22$tokenTTS === void 0 ? void 0 : _it22$tokenTTS.tokenTTSCollection;
      });
      tokenSounds.push(...payload.elements.map(_it23 => {
        return _it23 === null || _it23 === void 0 ? void 0 : _it23.element;
      }).flatMap(_it24 => {
        return _it24 === null || _it24 === void 0 ? void 0 : _it24.cells;
      }).flat().flatMap(_it25 => {
        var _it25$tokenTTS;

        return _it25 === null || _it25 === void 0 ? void 0 : (_it25$tokenTTS = _it25.tokenTTS) === null || _it25$tokenTTS === void 0 ? void 0 : _it25$tokenTTS.tokenTTSCollection;
      }));
      const _ref3 = languages.toLanguage;
      registerSoundsData(tokenSounds.map(_it26 => {
        return _it26 === null || _it26 === void 0 ? void 0 : _it26.ttsURL;
      }).filter(isString).map(_arg44 => {
        return getNormalMorphemeSoundData(_arg44, _ref3);
      }));
    }
  };
  /**
   * @param {object} discussion A forum discussion.
   * @returns {void}
   */


  const registerForumDiscussionSoundsData = discussion => {
    isString(discussion === null || discussion === void 0 ? void 0 : discussion.tts_url) && registerSoundsData([getNormalSentenceSoundData(discussion.tts_url, discussion.sentence_language)]);
  };
  /**
   * @param {object} element A guidebook element.
   * @param {string} language The language the user is learning.
   * @returns {SoundData[]} The sounds data for the given guidebook element.
   */


  const getGuidebookElementSoundsData = (element, language) => {
    var _element$tokenTTS, _element$text, _element$text$tokenTT, _element$subtext, _element$subtext$toke;

    const elementSounds = [];
    const sentenceTts = element.ttsURL;

    if (isString(sentenceTts)) {
      elementSounds.push(getNormalSentenceSoundData(sentenceTts, language));
    }

    return elementSounds.concat([((_element$tokenTTS = element.tokenTTS) === null || _element$tokenTTS === void 0 ? void 0 : _element$tokenTTS.tokenTTSCollection) || [], ((_element$text = element.text) === null || _element$text === void 0 ? void 0 : (_element$text$tokenTT = _element$text.tokenTTS) === null || _element$text$tokenTT === void 0 ? void 0 : _element$text$tokenTT.tokenTTSCollection) || [], ((_element$subtext = element.subtext) === null || _element$subtext === void 0 ? void 0 : (_element$subtext$toke = _element$subtext.tokenTTS) === null || _element$subtext$toke === void 0 ? void 0 : _element$subtext$toke.tokenTTSCollection) || []].flat().filter(isObject).map(_it27 => {
      return _it27 === null || _it27 === void 0 ? void 0 : _it27.ttsURL;
    }).filter(_arg46 => {
      return (_arg45 => {
        return isString(_arg45);
      }) && _arg46 !== sentenceTts;
    }).map(_arg47 => {
      return getNormalWordSoundData(_arg47, language);
    }));
  };
  /**
   * @param {object} guidebook A guidebook.
   * @param {object} languages Language data from the guidebook request.
   * @returns {void}
   */


  const registerGuidebookSoundsData = (guidebook, languages) => {
    if (isArray(guidebook === null || guidebook === void 0 ? void 0 : guidebook.elements) && isString(languages === null || languages === void 0 ? void 0 : languages.toLanguage)) {
      const _ref4 = languages.toLanguage;
      registerSoundsData(guidebook.elements.flatMap(({
        element
      }) => isObject(element) && [element].concat(element.phrases || []).concat(element.examples || [])).filter(isObject).flatMap(_arg48 => {
        return getGuidebookElementSoundsData(_arg48, _ref4);
      }));
    }
  };
  /**
   * Registers the event listeners required for detecting the sounds used for TTS sentences and words, if necessary.
   *
   * @returns {void}
   */

  const registerSoundDetectionListeners = () => {
    const listenersVersion = Number(getSharedGlobalVariable(KEY_SOUND_DETECTION_LISTENERS_VERSION));
    const isDetectionActive = !!getSharedGlobalVariable(KEY_SOUND_DETECTION_UNREGISTRATION_CALLBACKS);
    const isDetectionUpToDate = SOUND_DETECTION_LISTENERS_VERSION <= (listenersVersion || 0);

    if (!isDetectionActive || !isDetectionUpToDate) {
      if (!isDetectionUpToDate) {
        unregisterUnusedSoundDetectionListeners();
      }

      setSharedGlobalVariable(KEY_SOUND_DETECTION_LISTENERS_VERSION, SOUND_DETECTION_LISTENERS_VERSION);
      setSharedGlobalVariable(KEY_SOUND_DETECTION_UNREGISTRATION_CALLBACKS, [onStoryLoaded(_arg49 => {
        return registerStorySoundsData(_arg49);
      }), onAlphabetsLoaded((_arg50, _arg51) => {
        return registerAlphabetsSoundsData(_arg50, _arg51);
      }), onAlphabetHintsLoaded((_arg52, _arg53) => {
        return registerAlphabetHintsSoundsData(_arg52, _arg53);
      }), onForumDiscussionLoaded(_arg54 => {
        return registerForumDiscussionSoundsData(_arg54);
      }), onGuidebookLoaded((_arg55, _arg56) => {
        return registerGuidebookSoundsData(_arg55, _arg56);
      }), onPracticeChallengesLoaded(_arg57 => {
        return registerPracticeChallengesSoundsData(_arg57.challenges);
      })]);
    }
  };
  /**
   * Unregisters the event listeners dedicated to detecting the sounds used for TTS sentences and words,
   * if all the listeners for sound playback events have also been unregistered.
   *
   * @returns {void}
   */


  const unregisterUnusedSoundDetectionListeners = () => {
    const unregistrationCallbacks = getSharedGlobalVariable(KEY_SOUND_DETECTION_UNREGISTRATION_CALLBACKS);

    if (isArray(unregistrationCallbacks) && !hasEventListeners(EVENT_TYPE_SOUND_INITIALIZED) && !hasEventListeners(EVENT_TYPE_SOUND_PLAYBACK_REQUESTED) && !hasEventListeners(EVENT_TYPE_SOUND_PLAYBACK_CANCELLED) && !hasEventListeners(EVENT_TYPE_SOUND_PLAYBACK_CONFIRMED)) {
      unregistrationCallbacks.forEach(_it28 => {
        return _it28();
      });
      setSharedGlobalVariable(KEY_SOUND_DETECTION_LISTENERS_VERSION, null);
      setSharedGlobalVariable(KEY_SOUND_DETECTION_UNREGISTRATION_CALLBACKS, null);
    }
  };
  /**
   * @param {*} sound A sound object, whose type depends on the playback strategy.
   * @param {string} url The sound URL.
   * @param {string} playbackStrategy The strategy used for playing the sound.
   * @returns {Object} The payload usable for events related to the given sound.
   */


  const getSoundEventPayload = (sound, url, playbackStrategy) => {
    const soundData = getSoundData(getUrlPath(url));
    return {
      url,
      type: (soundData === null || soundData === void 0 ? void 0 : soundData.type) || SOUND_TYPE_UNKNOWN,
      speed: (soundData === null || soundData === void 0 ? void 0 : soundData.speed) || SOUND_SPEED_NORMAL,
      language: soundData === null || soundData === void 0 ? void 0 : soundData.language,
      playbackStrategy,
      sound
    };
  };
  /**
   * @param {*} sound The sound to be played, whose type depends on the playback strategy.
   * @param {string} url The sound URL.
   * @param {string} playbackStrategy The strategy used for playing the sound.
   * @param {Function} play A callback usable to trigger the sound playback.
   * @returns {*|null} The result of calling the playback callback, or null if it was cancelled.
   */


  const processSoundPlayback = (sound, url, playbackStrategy, play) => {
    const payload = getSoundEventPayload(sound, url, playbackStrategy);
    let isCancelled = false;

    try {
      var _dispatchEvent;

      isCancelled = (_dispatchEvent = dispatchEvent(EVENT_TYPE_SOUND_PLAYBACK_REQUESTED, payload)) === null || _dispatchEvent === void 0 ? void 0 : _dispatchEvent.some(_it29 => {
        return false === _it29;
      });

      if (!isCancelled) {
        dispatchEvent(EVENT_TYPE_SOUND_PLAYBACK_CONFIRMED, payload);
      } else {
        dispatchEvent(EVENT_TYPE_SOUND_PLAYBACK_CANCELLED, payload);
      }
    } catch (error) {
      logError(error, `Could not handle playback for sound "${url}" (using "${playbackStrategy}"): `);
    }

    return isCancelled ? null : play();
  };
  /**
   * @param {string} event A type of sound playback event.
   * @param {Function} callback The function to be called with the event payload when a matching event is dispatched.
   * @returns {Function} A function usable to unregister the listener.
   */

  const registerSoundPlaybackEventListener = (event, callback) => {
    overrideInstanceMethod('Howl', 'play', originalHowlPlay => function (id) {
      var _this$_parent2;

      setSharedGlobalVariable(KEY_IS_HOWLER_USED, true);
      const soundUrl = String(this._src || ((_this$_parent2 = this._parent) === null || _this$_parent2 === void 0 ? void 0 : _this$_parent2._src) || '').trim();

      if ('' !== soundUrl) {
        return processSoundPlayback(this, soundUrl, SOUND_PLAYBACK_STRATEGY_HOWLER, () => originalHowlPlay.call(this, id));
      }

      return originalHowlPlay.call(this, id);
    });
    registerSoundDetectionListeners();
    const unregisterDerived = registerEventListener(event, callback);
    return () => {
      unregisterDerived();
      unregisterUnusedSoundDetectionListeners();
    };
  };
  /**
   * @type {Function}
   * @param {Function} callback
   * The function to be called with the corresponding sound data when a playback is requested.
   * If this function returns false, the sound playback will be cancelled.
   * @returns {Function} A function usable to stop being notified of sound playback requests.
   */


  const onSoundPlaybackRequested = _arg58 => {
    return registerSoundPlaybackEventListener(EVENT_TYPE_SOUND_PLAYBACK_REQUESTED, _arg58);
  };
  /**
   * @type {string}
   */

  const KEY_IS_UI_LOADED = 'is_ui_loaded';
  /**
   * @type {string}
   */

  const KEY_IS_UI_LOADING_DETECTED = 'is_ui_loading_detected';
  /**
   * @param {Function} callback The function to be called when the UI is fully loaded.
   * @returns {void}
   */

  const onUiLoaded = callback => {
    if (getSharedGlobalVariable(KEY_IS_UI_LOADED)) {
      setTimeout(callback);
      return;
    }

    if (!getSharedGlobalVariable(KEY_IS_UI_LOADING_DETECTED)) {
      var _window$duo;

      let cssLoadedPromise;

      if (isArray((_window$duo = window.duo) === null || _window$duo === void 0 ? void 0 : _window$duo.stylesheets)) {
        cssLoadedPromise = new Promise(resolve => {
          // Regularly check if any of the stylesheets has been loaded
          // (the "stylesheets" array contain styles for both LTR and RTL directions).
          const checkStylesheets = () => {
            const isCssLoaded = Array.from(document.styleSheets).some(sheet => window.duo.stylesheets.some(href => String(sheet.href || '').indexOf(href) >= 0));

            if (isCssLoaded) {
              clearInterval(checkInterval);
              resolve();
            }
          };

          const checkInterval = setInterval(checkStylesheets, 1000);
          checkStylesheets();
        });
      } else {
        cssLoadedPromise = Promise.resolve();
      }

      const callback = () => cssLoadedPromise.then(() => {
        setSharedGlobalVariable(KEY_IS_UI_LOADED, true);
        dispatchEvent(EVENT_TYPE_UI_LOADED);
      });

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(callback, 1);
      } else {
        document.addEventListener('DOMContentLoaded', callback);
      }
    }

    registerEventListener(EVENT_TYPE_UI_LOADED, callback);
  };

  /**
   * @type {string}
   */

  const ACTION_RESULT_SUCCESS = 'success';
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_ACTION_REQUEST = getUniqueKey('action_request');
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_ACTION_RESULT = getUniqueKey('action_result');
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION = getUniqueKey('background_event_notification');
  /**
   * Sends an action request from a UI script to the content scripts.
   *
   * @param {string} action The action type.
   * @param {*=} value The action payload.
   * @returns {Promise} A promise for the result of the action.
   */

  const sendActionRequestToContentScript = async (action, value) => new Promise((resolve, reject) => {
    const resultListener = event => {
      if (event.source === window && isObject(event.data) && MESSAGE_TYPE_ACTION_RESULT === event.data.type && action === event.data.action) {
        if (event.data.result === ACTION_RESULT_SUCCESS) {
          resolve(event.data.value);
        } else {
          reject(event.data.error);
        }

        event.stopPropagation();
        window.removeEventListener('message', resultListener);
      }
    };

    window.addEventListener('message', resultListener);
    window.postMessage({
      type: MESSAGE_TYPE_ACTION_REQUEST,
      action,
      value
    }, '*');
  });
  /**
   * Registers a listener for background events.
   *
   * This function can be called from any script.
   *
   * @param {Function} callback
   * The function to be called when a background event is fired, with the event type and payload as parameters.
   * @param {(string[])=} eventTypes
   * The types of background events that the listener should be notified of, if not all.
   * @returns {Function}
   * A function usable to unregister the event listener.
   */

  const onBackgroundEvent = (callback, eventTypes) => {
    var _chrome$runtime;

    const isRelevantEventType = !isArray(eventTypes) ? () => true : _arg => {
      return eventTypes.indexOf(_arg) >= 0;
    };

    const listener = event => {
      const eventData = isObject(event.data) ? event.data : event;
      return eventData && MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION === eventData.type && isRelevantEventType(eventData.event) && callback(eventData.event, eventData.value);
    };

    if (typeof chrome !== 'undefined' && (_chrome$runtime = chrome.runtime) !== null && _chrome$runtime !== void 0 && _chrome$runtime.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  };

  /**
   * @type {string}
   */

  const KEY_MUTEXES = 'mutexes';
  /**
   * @typedef {object} Mutex
   * @property {?MutexHolder} currentHolder
   * The holder that is currently locking the mutex, if any.
   * @property {MutexHolder[]} pendingHolders
   * The holders that are waiting for the mutex to become available.
   */

  /**
   * @typedef {object} MutexHolder
   * @property {number} uniqueId
   * A unique key identifying the holder.
   * @property {number} priority
   * The priority of the holder.
   * @property {Function} onAcquired
   * The callback usable to notify the holder when it has acquired the mutex.
   * @property {Function} onSupersessionRequest
   * The callback usable to notify the holder when a request with a higher priority is made to acquire the mutex it holds.
   */

  /**
   * @returns {number} The next unique ID usable for a mutex holder.
   */

  const getNextHolderId = () => bumpGlobalCounter('last_mutex_holder_id');
  /**
   * Updates a mutex, initializing it if necessary.
   *
   * @param {string} mutexCode The code of a mutex.
   * @param {Function} updateCallback The callback usable to update the mutex.
   * @returns {void}
   */

  const updateMutex = (mutexCode, updateCallback) => {
    updateSharedGlobalVariable(KEY_MUTEXES, mutexes => {
      if (!isObject(mutexes[mutexCode])) {
        mutexes[mutexCode] = {
          currentHolder: null,
          pendingHolders: []
        };
      }

      mutexes[mutexCode] = updateCallback(mutexes[mutexCode]);
      return mutexes;
    }, {});
  };
  /**
   * Releases a mutex, and schedules the next pending acquisition (if any, based on priority).
   *
   * This only has an effect if the mutex is locked by the given holder.
   *
   * @param {string} mutexCode The code of the mutex to be released.
   * @param {number} holderId The ID of the holder that is releasing the mutex.
   * @returns {void}
   */


  const releaseMutex = (mutexCode, holderId) => {
    updateMutex(mutexCode, mutex => {
      var _mutex$currentHolder;

      if (((_mutex$currentHolder = mutex.currentHolder) === null || _mutex$currentHolder === void 0 ? void 0 : _mutex$currentHolder.uniqueId) !== holderId) {
        return;
      }

      const nextHolder = maxBy(mutex.pendingHolders, _it2 => {
        return _it2.priority;
      });

      if (nextHolder) {
        setTimeout(() => nextHolder.onAcquired());
        mutex.currentHolder = nextHolder;
        mutex.pendingHolders = mutex.pendingHolders.filter(_it3 => {
          return _it3.uniqueId !== nextHolder.uniqueId;
        });
      } else {
        mutex.currentHolder = null;
      }

      return mutex;
    });
  };
  /**
   * Attempts to acquire a mutex, waiting as long as necessary for it to become available.
   *
   * @param {string} mutexCode
   * The code of the mutex to acquire.
   * @param {object} config A set of configuration options.
   * @param {?number} config.priority
   * The priority of the request. Requests with higher priorities are handled first.
   * @param {?number} config.timeoutDelay
   * The maximum delay (if any) to wait for the mutex to become available, in milliseconds.
   * @param {?Function} config.onSupersessionRequest
   * A callback usable to be notified when another request with a higher priority is made to acquire the same mutex.
   * @returns {Promise<Function>}
   * A promise for when the mutex has been acquired, holding the callback usable to release it.
   * If the request times out, the promise will be rejected instead.
   */


  const requestMutex = async (mutexCode, {
    priority = PRIORITY_AVERAGE,
    timeoutDelay = null,
    onSupersessionRequest = noop
  } = {}) => new Promise((resolve, reject) => {
    const uniqueId = getNextHolderId();
    const cancelTimeoutId = timeoutDelay > 0 ? setTimeout(() => {
      updateMutex(mutexCode, mutex => {
        return { ...mutex,
          pendingHolders: mutex.pendingHolders.filter(_it4 => {
            return uniqueId !== _it4.uniqueId;
          })
        };
      });
      reject();
    }, timeoutDelay) : null;

    const onAcquired = () => {
      cancelTimeoutId && clearTimeout(cancelTimeoutId);
      resolve(() => releaseMutex(mutexCode, uniqueId));
    };

    const holder = {
      uniqueId,
      priority,
      onAcquired,
      onSupersessionRequest
    };
    updateMutex(mutexCode, mutex => {
      if (!mutex.currentHolder) {
        mutex.currentHolder = holder;
        setTimeout(() => onAcquired());
      } else {
        mutex.pendingHolders.push(holder);

        if (holder.priority > mutex.currentHolder.priority) {
          setTimeout(() => mutex.currentHolder.onSupersessionRequest());
        }
      }

      return mutex;
    });
  });
  /**
   * @type {string}
   */

  const MUTEX_HOTKEYS = 'hotkeys';

  /**
   * @type {string}
   */
  const ACTION_TYPE_GET_OPTIONS = 'get_options';

  /**
   * @type {string}
   */
  const BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED = 'options_changed';

  /**
   * @typedef {object} Options
   * @property {boolean} enableDnd Whether the drag'n'drop of words should be enabled.
   * @property {boolean} enableKeyboardShortcuts Whether the keyboard shortcuts should be enabled.
   * @property {boolean} disableWordButtonsTts Whether sounds should not be played when a word is added to an answer.
   * @property {string} disableWordAnimation Whether and when the original word animation should be disabled.
   */

  /**
   * @type {string}
   */
  const OPTION_TIMING_ALWAYS = 'always';

  /**
   * @type {string}
   */
  const OPTION_TIMING_NEVER = 'never';

  /**
   * @type {string}
   */
  const OPTION_TIMING_ON_DND = 'dnd';

  /**
   * @type {Options}
   */
  const DEFAULT_OPTIONS = {
    enableDnd: true,
    enableKeyboardShortcuts: true,
    disableWordButtonsTts: false,
    disableWordAnimation: OPTION_TIMING_NEVER
  };

  /**
   * @type {import('./options.js').Options}
   */
  let options = DEFAULT_OPTIONS;

  /**
   * Whether the "flying" animation of words should currently be disabled.
   * @type {boolean}
   */
  let isWordAnimationDisabled = false;

  /**
   * The last seen word-bank answer.
   * @type {Element|null}
   */
  let lastWordBankAnswer = null;

  /**
   * The last seen word-bank source.
   * @type {Element|null}
   */
  let lastWordBankSource = null;

  /**
   * The last seen wrapper of overlays.
   * @type {Element|null}
   */
  let lastOverlayWrapper = null;

  /**
   * Whether words fly into place rather than appearing directly in the answers.
   * @type {boolean|null}
   */
  let isUsingFlyingWords = null;

  /**
   * The words that were present in the current answer before the user started dragging a word.
   * @type {string[]}
   */
  let originalAnswerWords = [];

  /**
   * The callback usable to release the hotkeys mutex, once it has been acquired.
   * @type {Function|null}
   */
  let hotkeysMutexReleaseCallback = null;

  /**
   * Whether a (pending) request has been made to acquire the hotkeys mutex.
   * @type {boolean}
   */
  let hasPendingHotkeysMutexRequest = false;

  /**
   * Whether the user is currently dragging a word in the current answer.
   * @type {boolean}
   */
  let isDraggingWord = false;

  /**
   * Whether the user is currently moving a word in the current answer using the keyboard shortcuts.
   * @type {boolean}
   */
  let isMovingWord = false;

  /**
   * Whether we are currently rearranging words in the current answer.
   * @type {boolean}
   */
  let isRearrangingWords = false;

  /**
   * Whether we are currently reinserting words in the current answer.
   * @type {boolean}
   */
  let isReinsertingWords = false;

  /**
   * The last time a word action occurred (a word button was clicked, or a key was pressed).
   * @type {number|null}
   */
  let lastWordActionAt = null;

  /**
   * The index of the word button that is currently selected using the keyboard shortcuts.
   * @type {number|null}
   */
  let selectedWordButtonIndex = null;

  /**
   * The original index of the selected word button that is being moved using the keyboard shortcuts.
   * @type {number|null}
   */
  let originalSelectedWordButtonIndex = null;

  /**
   * @type {Function}
   * @param {Element} button A word button.
   * @returns {boolean} Whether the given button is the original button for the currently dragged word.
   */
  const isDraggedWordButton = _it => {
    return _it.classList.contains(CLASS_NAME_DRAGGED_WORD_BUTTON);
  };

  /**
   * @returns {boolean} Whether any word from a work bank is currently "flying".
   */
  const isAnyWordFlying = () => {
    var _lastOverlayWrapper;
    return isUsingFlyingWords && !!((_lastOverlayWrapper = lastOverlayWrapper) !== null && _lastOverlayWrapper !== void 0 && _lastOverlayWrapper.querySelector(SELECTOR_OVERLAY_WORD_BUTTON));
  };

  /**
   * @returns {Element[]} The list of all word buttons in the current answer.
   */
  const getAnswerWordButtons = () => !lastWordBankAnswer ? [] : Array.from(lastWordBankAnswer.querySelectorAll(SELECTOR_WORD_BUTTON));

  /**
   * @type {Function}
   * @param {Node} button A word button.
   * @returns {string} Whether the given button is disabled.
   */
  const isWordButtonDisabled = _it2 => {
    return _it2.disabled || 'true' === _it2.ariaDisabled;
  };

  /**
   * @type {Function}
   * @param {Node} element A word button.
   * @returns {string} The corresponding word.
   */
  const getWordButtonWord = element => {
    let baseButton = element.querySelector(SELECTOR_WORD_BUTTON_WORD) || element;
    if (baseButton.querySelector('rt')) {
      baseButton = baseButton.cloneNode(true);
      baseButton.querySelectorAll('rt').forEach(_it3 => {
        return _it3.remove();
      });
    }
    let word = baseButton.textContent.trim();
    if (word.length % 2 === 0) {
      // The word may be duplicated if some part of it was highlighted due to keyboard "auto-completion".
      const halfWord = word.slice(0, word.length / 2);
      if (Array.from(baseButton.childNodes).find(_it4 => {
        return _it4.textContent.trim() === halfWord;
      })) {
        word = halfWord;
      }
    }
    return word;
  };

  /**
   * @returns {string[]} The list of all relevant words in the current answer.
   */
  const getAnswerWords = () => getAnswerWordButtons().map(button => isDraggedWordButton(button) ? '' : getWordButtonWord(button)).filter(_it5 => {
    return _it5.length > 0;
  });

  /**
   * Captures and reapplies the order of words in the current answer, so that the React UI takes it into account.
   *
   * This function uses a small delay between each operation, to account for the words animation.
   * @param {number} offset The number of words to skip from the beginning.
   * @returns {void}
   */
  const applyFlyingWordsOrder = offset => {
    if (!lastWordBankSource) {
      return;
    }
    const sortedWords = [];
    const wordButtons = getAnswerWordButtons().slice(offset);
    if (OPTION_TIMING_NEVER !== options.disableWordAnimation) {
      toggleWordAnimation(false);
    }

    // Remove the necessary words one by one, to let everything animate smoothly.
    const removeAnswerWords = () => {
      const nextButton = wordButtons.shift();
      if (nextButton) {
        // Get the word first, because the structure changes unreliably once it is removed.
        const word = getWordButtonWord(nextButton);
        nextButton.click();
        if (!isDraggedWordButton(nextButton) && '' !== word) {
          sortedWords.push(word);
        }
        setTimeout(() => {
          if (nextButton.isConnected) {
            // If the button has not been removed by now, it is a (unwanted) leftover from the "draggable" plugin.
            const leftoverElement = nextButton.closest(WORD_SELECTORS.join(',')) || nextButton;
            leftoverElement.parentNode.removeChild(leftoverElement);
          }
          removeAnswerWords();
        }, 1);
        return;
      }

      // TTS sounds will be played when words are reinserted - prevent this.
      isReinsertingWords = true;
      setTimeout(reinsertAnswerWords, 1);
    };
    let hasReinsertionStarted = false;

    // Reinsert the removed words in the right order, one by one, again to let everything animate smoothly.
    const reinsertAnswerWords = () => {
      try {
        const sourceButtons = !lastWordBankSource ? [] : Array.from(lastWordBankSource.querySelectorAll(SELECTOR_WORD_BUTTON));

        // Wait for all the removed words to have flied back in place.
        if (hasReinsertionStarted || !isAnyWordFlying()) {
          hasReinsertionStarted = true;
          const nextWord = sortedWords.shift();
          const nextButton = sourceButtons.find(button => !isWordButtonDisabled(button) && getWordButtonWord(button) === nextWord);
          nextButton && nextButton.click();
        }
        if (sortedWords.length > 0) {
          setTimeout(reinsertAnswerWords, 1);
        } else {
          setTimeout(restoreBaseState, 200);
        }
      } catch (error) {
        restoreBaseState();
        throw error;
      }
    };
    const restoreBaseState = () => {
      isReinsertingWords = false;
      isRearrangingWords = false;
      refreshWordButtonsState();
      if (OPTION_TIMING_ALWAYS !== options.disableWordAnimation) {
        toggleWordAnimation(true);
      }
    };
    removeAnswerWords();
  };

  /**
   * Captures and reapplies the order of words in the current answer, so that the React UI takes it into account.
   *
   * This function assumes that the words are not animated, and therefore does not use any delay.
   * @param {number} offset The number of words to skip from the beginning.
   * @param {Event|null} event The "drag" event at the origin of the new word order, if any.
   * @returns {void}
   */
  const applyNonFlyingWordsOrder = function applyNonFlyingWordsOrder(offset) {
    let event = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (!lastWordBankSource) {
      return;
    }
    const wordButtons = getAnswerWordButtons();
    const sortedWords = wordButtons.slice(offset).map(button => {
      button.click();
      return isDraggedWordButton(button) ? '' : getWordButtonWord(button);
    }).filter(_it6 => {
      return _it6.length > 0;
    });
    if (event) {
      // Remove the additional button from the "draggable" plugin ourselves,
      // because it is not always automatically cleaned up.
      const dragSource = event.dragEvent.source;
      const fakeSourceWrapper = document.createElement('div');
      dragSource.parentNode.removeChild(dragSource);
      fakeSourceWrapper.appendChild(dragSource);
    }

    // TTS sounds will be played when words are reinserted - prevent this.
    isReinsertingWords = true;

    // Add the words back, in the right order.
    try {
      if (lastWordBankSource) {
        Array.from(lastWordBankSource.querySelectorAll(SELECTOR_WORD_BUTTON)).filter(_arg => {
          return !isWordButtonDisabled(_arg);
        }).map(button => {
          const index = sortedWords.indexOf(getWordButtonWord(button));
          if (index >= 0) {
            // Do not reuse a same word button twice.
            sortedWords[index] = null;
          }
          return [index, button];
        }).filter(_it7 => {
          return _it7[0] >= 0;
        }).sort((_arg2, _arg3) => {
          return _arg2[0] - _arg3[0];
        }).forEach(_it8 => {
          return _it8[1].click();
        });
      }
    } finally {
      isReinsertingWords = false;
      isRearrangingWords = false;
      refreshWordButtonsState();
    }
  };

  /**
   * Captures and reapplies the order of words in the current answer, so that the React UI takes it into account.
   * @param {number} offset The number of words to skip from the beginning.
   * @param {Event|null} event The "drag" event at the origin of the new word order, if any.
   * @returns {void}
   */
  const applyWordsOrder = function applyWordsOrder(offset) {
    let event = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    isRearrangingWords = true;
    selectedWordButtonIndex = null;
    originalSelectedWordButtonIndex = null;
    if (isUsingFlyingWords) {
      applyFlyingWordsOrder(offset);
    } else {
      applyNonFlyingWordsOrder(offset, event);
    }
  };

  /**
   * Reflects the currently selected button on the UI.
   * @param {Element[]|null} buttons The word buttons of the current answer.
   * @returns {void}
   */
  const refreshWordButtonsState = function refreshWordButtonsState() {
    let buttons = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    (buttons || getAnswerWordButtons()).forEach((button, index) => {
      button.classList.toggle(CLASS_NAME_HIGHLIGHTED_WORD_BUTTON, index === selectedWordButtonIndex);
    });
  };

  /**
   * Selects the word button next to the currently selected one in a given direction.
   *
   * If no button has been selected yet, the first or last button will be selected.
   *
   * If there is no button in the given direction, no other button will be selected..
   * @param {string} direction A direction.
   * @returns {void}
   */
  const selectNextWordButton = direction => {
    const wordButtons = getAnswerWordButtons();
    if (0 === wordButtons.length || DIRECTION_LEFT === direction && 0 === selectedWordButtonIndex || DIRECTION_RIGHT === direction && wordButtons.length - 1 === selectedWordButtonIndex) {
      selectedWordButtonIndex = null;
    } else if (null === selectedWordButtonIndex) {
      selectedWordButtonIndex = DIRECTION_RIGHT === direction ? 0 : wordButtons.length - 1;
    } else {
      selectedWordButtonIndex += DIRECTION_LEFT === direction ? -1 : 1;
    }
    refreshWordButtonsState(wordButtons);
  };

  /**
   * Moves the currently selected word button in a given direction in the answer.
   * @param {string} direction A direction.
   * @returns {void}
   */
  const moveSelectedWordButton = direction => {
    if (null !== selectedWordButtonIndex) {
      const wordButtons = getAnswerWordButtons();
      if (wordButtons[selectedWordButtonIndex]) {
        const selectedWrapper = wordButtons[selectedWordButtonIndex].closest(SELECTOR_DRAGGABLE_WORD);
        if (null === originalSelectedWordButtonIndex) {
          originalSelectedWordButtonIndex = selectedWordButtonIndex;
        }
        if (DIRECTION_LEFT === direction && selectedWordButtonIndex > 0) {
          isMovingWord = true;
          selectedWrapper.parentNode.insertBefore(selectedWrapper, wordButtons[selectedWordButtonIndex - 1].closest(SELECTOR_DRAGGABLE_WORD));
          selectedWordButtonIndex -= 1;
        } else if (DIRECTION_RIGHT === direction && selectedWordButtonIndex < wordButtons.length - 1) {
          isMovingWord = true;
          selectedWrapper.parentNode.insertBefore(wordButtons[selectedWordButtonIndex + 1].closest(SELECTOR_DRAGGABLE_WORD), selectedWrapper);
          selectedWordButtonIndex += 1;
        }
      }
    }
  };

  /**
   * Removes the currently selected word button from the answer.
   * @returns {void}
   */
  const removeSelectedWordButton = () => {
    if (null !== selectedWordButtonIndex) {
      var _wordButtons$selected;
      // The mutation observer will take care of refreshing the state of the buttons.
      const wordButtons = getAnswerWordButtons();
      (_wordButtons$selected = wordButtons[selectedWordButtonIndex]) === null || _wordButtons$selected === void 0 || _wordButtons$selected.click();
    }
  };

  /**
   * Toggles on / off the animation of words.
   * @type {Function}
   * @param {boolean} enabled Whether words should be animated.
   * @returns {void}
   */
  const toggleWordAnimation = enabled => {
    isWordAnimationDisabled = !enabled;
    document.body.classList.toggle(`_duo-wb-dnd_disabled_word_animation`, !isWordAnimationDisabled);
  };

  /**
   * Applies a new set of options.
   * @param {import('./options.js').Options} updated The new set of options.
   * @returns {void}
   */
  const applyOptions = updated => {
    options = updated;
    if (OPTION_TIMING_NEVER === options.disableWordAnimation) {
      toggleWordAnimation(true);
    } else if (OPTION_TIMING_ALWAYS === options.disableWordAnimation) {
      toggleWordAnimation(false);
    } else if (OPTION_TIMING_ON_DND === options.disableWordAnimation) {
      toggleWordAnimation(!isRearrangingWords);
    }
  };

  // Load and apply the current set of options.
  onUiLoaded(() => {
    sendActionRequestToContentScript(ACTION_TYPE_GET_OPTIONS).catch(() => DEFAULT_OPTIONS).then(applyOptions);
  });

  // Applies the new set of options every time a change occurs.
  onBackgroundEvent((event, payload) => BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED === event && applyOptions(payload));

  // Observe mutations on overlay wrappers to detect whether words are animated,
  // and tone down their animation when required.
  const overlayMutationObserver = new MutationObserver(records => {
    var _lastOverlayWrapper2;
    if ((_lastOverlayWrapper2 = lastOverlayWrapper) !== null && _lastOverlayWrapper2 !== void 0 && _lastOverlayWrapper2.querySelector(SELECTOR_OVERLAY_WORD_BUTTON)) {
      isUsingFlyingWords = true;
    }
    if (isWordAnimationDisabled) {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const button = node.querySelector(SELECTOR_OVERLAY_WORD_BUTTON);
          if (button) {
            for (const animation of button.getAnimations()) {
              animation.finish();
            }
          }
        }
      }
    }
  });

  // Observe mutations on word-bank answers to detect external changes made to the list of words,
  // and preserve the currently selected word button.
  const wordBankAnswerMutationObserver = new MutationObserver(() => {
    if (null !== selectedWordButtonIndex && !isMovingWord && !isDraggingWord && !isRearrangingWords) {
      const wordButtons = getAnswerWordButtons();
      let newSelectedIndex = wordButtons.findIndex(_it9 => {
        return _it9.classList.contains(CLASS_NAME_HIGHLIGHTED_WORD_BUTTON);
      });
      if (-1 === newSelectedIndex && wordButtons.length > 0) {
        newSelectedIndex = Math.max(0, Math.min(wordButtons.length - 1, selectedWordButtonIndex));
      }
      if (newSelectedIndex >= 0) {
        selectedWordButtonIndex = newSelectedIndex;
        refreshWordButtonsState(wordButtons);
      } else {
        selectedWordButtonIndex = null;
      }
    }
  });

  /**
   * Marks a word button from the current word-bank answer as dragged, or unmarks all of them.
   * @param {Element|null} button A word button, or null if all buttons should be unmarked.
   * @returns {void}
   */
  const markDraggedWordButton = button => {
    var _lastWordBankAnswer;
    (_lastWordBankAnswer = lastWordBankAnswer) === null || _lastWordBankAnswer === void 0 || (_lastWordBankAnswer = _lastWordBankAnswer.querySelectorAll(`.${CLASS_NAME_DRAGGED_WORD_BUTTON}`)) === null || _lastWordBankAnswer === void 0 || _lastWordBankAnswer.forEach(_it10 => {
      return _it10.classList.remove(CLASS_NAME_DRAGGED_WORD_BUTTON);
    });
    button === null || button === void 0 || button.classList.add(CLASS_NAME_DRAGGED_WORD_BUTTON);
  };

  /**
   * @returns {Element[]} The currently dragged word buttons.
   */
  const getDraggedWordButtons = () => {
    var _lastWordBankAnswer2;
    return Array.from(((_lastWordBankAnswer2 = lastWordBankAnswer) === null || _lastWordBankAnswer2 === void 0 ? void 0 : _lastWordBankAnswer2.getElementsByClassName(CLASS_NAME_DRAGGED_WORD_BUTTON)) || []);
  };

  /**
   * @param {Element} element A word element.
   * @returns {boolean} Whether the given word can be dragged natively.
   */
  const isNativeDraggableWord = element => {
    const isDraggableProps = props => {
      if (isObject(props)) {
        if (true === props.draggable) {
          return true;
        } else if (isArray(props.children)) {
          return props.children.some(_arg4 => {
            return isDraggableProps(_arg4 === null || _arg4 === void 0 ? void 0 : _arg4.props);
          });
        } else if (isObject(props.children)) {
          return isDraggableProps(props.children.props);
        }
      }
      return false;
    };
    for (const [key, value] of Object.entries(element)) {
      if (key.match(/^__reactProps\$.+$/)) {
        return isDraggableProps(value);
      }
    }
    return false;
  };

  /**
   * @type {Function}
   * @param {?Element} element A word element that can be used to determine whether words are natively draggable.
   * @returns {boolean} Whether words are natively draggable.
   */
  const isUsingNativeDnd = (() => {
    let isNativeDnd = false;
    return element => {
      if (!isNativeDnd && element) {
        var _element$closest;
        isNativeDnd = isNativeDraggableWord((_element$closest = element.closest(SELECTOR_WORD)) !== null && _element$closest !== void 0 ? _element$closest : element);
      }
      return isNativeDnd;
    };
  })();
  setInterval(() => {
    // Poll for new overlay wrappers to setup the detection of the words animation.
    const newOverlayWrapper = document.querySelector(SELECTOR_OVERLAY_WRAPPER);
    if (newOverlayWrapper !== lastOverlayWrapper) {
      overlayMutationObserver.disconnect();
      lastOverlayWrapper = newOverlayWrapper;
      if (!lastOverlayWrapper) {
        return;
      }
      overlayMutationObserver.observe(lastOverlayWrapper, {
        childList: true
      });
    }

    // Poll for new word-bank sources to setup the detection of clicks on word buttons.
    const newWordBankSource = document.querySelector(SELECTOR_WORD_SOURCE);
    if (newWordBankSource !== lastWordBankSource) {
      lastWordBankSource = newWordBankSource;
      if (lastWordBankSource) {
        lastWordBankSource.addEventListener('click', event => {
          if (event.target.matches('button') || event.target.closest('button')) {
            lastWordActionAt = Date.now();
          }
        });
      }
    }

    // Poll for new word-bank answers to setup the drag'n'drop plugin.
    const newWordBankAnswer = document.querySelector(SELECTOR_ANSWER);
    if (newWordBankAnswer !== lastWordBankAnswer) {
      var _lastWordBankSource;
      lastWordBankAnswer = newWordBankAnswer;
      selectedWordButtonIndex = null;
      originalSelectedWordButtonIndex = null;
      if (!lastWordBankAnswer) {
        return;
      }
      wordBankAnswerMutationObserver.observe(lastWordBankAnswer, {
        childList: true,
        subtree: true
      });
      if (isUsingNativeDnd((_lastWordBankSource = lastWordBankSource) === null || _lastWordBankSource === void 0 ? void 0 : _lastWordBankSource.querySelector(SELECTOR_WORD_BUTTON))) {
        return;
      }
      const sortable = new Sortable(lastWordBankAnswer, {
        draggable: SELECTOR_DRAGGABLE_WORD,
        distance: 5
      });
      sortable.removePlugin(Draggable.Plugins.Mirror);
      sortable.on('drag:start', event => {
        const draggableWord = event.originalSource.closest(SELECTOR_DRAGGABLE_WORD);
        if (!options.enableDnd || isMovingWord || !isChallengeUncompleted() || draggableWord && isUsingNativeDnd(draggableWord)) {
          event.cancel();
          return;
        }
        markDraggedWordButton(event.originalSource.querySelector(SELECTOR_WORD_BUTTON));
        isDraggingWord = true;
        originalAnswerWords = getAnswerWords();
      });
      sortable.on('sortable:stop', event => {
        isDraggingWord = false;
        if (null === isUsingFlyingWords) {
          isUsingFlyingWords = false;
        }
        const updatedAnswerWords = getAnswerWords();
        const draggedWordButtons = getDraggedWordButtons();
        const draggedWords = draggedWordButtons.map(_arg5 => {
          return getWordButtonWord(_arg5);
        });

        // Only reorder as many words as necessary.
        let preservedWordCount = Math.min(...[
        // First difference between two words.
        originalAnswerWords.findIndex((_arg6, _arg7) => {
          return _arg6 !== updatedAnswerWords[_arg7];
        }),
        // Account for false negatives that occur when a word is dragged to the left of the exact same word.
        ...draggedWords.map(_arg8 => {
          return updatedAnswerWords.indexOf(_arg8);
        }).filter(index => index >= 0 && updatedAnswerWords[index] === updatedAnswerWords[index + 1]),
        // Account for false negatives that occur when a word is dragged from the left of the exact same word.
        ...draggedWords.map(_arg9 => {
          return originalAnswerWords.indexOf(_arg9);
        }).filter(index => index >= 0 && originalAnswerWords[index] === originalAnswerWords[index + 1] && updatedAnswerWords[index] !== updatedAnswerWords[index + 1])].filter(_arg10 => {
          return _arg10 >= 0;
        }));
        if (-1 === preservedWordCount || Infinity === preservedWordCount) {
          if (updatedAnswerWords.length > originalAnswerWords.length) {
            preservedWordCount = originalAnswerWords.length;
          } else {
            markDraggedWordButton(null);
            return;
          }
        }
        applyWordsOrder(preservedWordCount, event);
      });
    }
  }, 50);

  // Prevent TTS words from being played when necessary.
  onSoundPlaybackRequested(sound => !(SOUND_TYPE_TTS_WORD === sound.type && (isReinsertingWords || options.disableWordButtonsTts && Math.abs(Date.now() - lastWordActionAt) <= WORD_ACTION_TTS_DELAY)));

  /**
   * Attempts to acquire the hotkeys mutex whenever it becomes available, but with the lowest possible priority,
   * always giving back control when another extension requests it (unless a word is being moved around).
   * @returns {void}
   */
  const requestHotkeysMutex = () => {
    if (hasPendingHotkeysMutexRequest || hotkeysMutexReleaseCallback) {
      return;
    }
    hasPendingHotkeysMutexRequest = true;
    requestMutex(MUTEX_HOTKEYS, {
      priority: PRIORITY_LOWEST,
      onSupersessionRequest: () => {
        if (hotkeysMutexReleaseCallback && !isMovingWord) {
          hotkeysMutexReleaseCallback();
          hotkeysMutexReleaseCallback = null;
          requestHotkeysMutex();
        }
      }
    }).then(releaseCallback => {
      hasPendingHotkeysMutexRequest = false;
      hotkeysMutexReleaseCallback = releaseCallback;
    }).catch(noop);
  };
  requestHotkeysMutex();

  /**
   * @returns {boolean} Whether the current context is an uncompleted challenge.
   */
  const isChallengeUncompleted = () => {
    const context = getCurrentContext();
    return CONTEXT_CHALLENGE === context.type && !context.isCompleted;
  };
  document.addEventListener('keydown', event => {
    if (isDraggingWord) {
      if ('Backspace' === event.key) {
        // Do not allow the user to remove words from the answer when dragging a word,
        // because it could mess things up (adding words is fine though).
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } else if (lastWordBankAnswer && !isRearrangingWords && null !== hotkeysMutexReleaseCallback && options.enableKeyboardShortcuts && isChallengeUncompleted() && !isAnyInputFocused()) {
      if ('ArrowLeft' === event.key) {
        discardEvent(event);
        if (event.ctrlKey) {
          moveSelectedWordButton(DIRECTION_LEFT);
        } else {
          selectNextWordButton(DIRECTION_LEFT);
        }
      } else if ('ArrowRight' === event.key) {
        discardEvent(event);
        if (event.ctrlKey) {
          moveSelectedWordButton(DIRECTION_RIGHT);
        } else {
          selectNextWordButton(DIRECTION_RIGHT);
        }
      } else if (!event.ctrlKey) {
        if ('Delete' === event.key) {
          discardEvent(event);
          removeSelectedWordButton();
        }
      }
    }
    if (lastWordBankAnswer) {
      lastWordActionAt = Date.now();
    }
  }, true);
  document.addEventListener('keyup', event => {
    if ('Control' === event.key) {
      if (isMovingWord && selectedWordButtonIndex !== originalSelectedWordButtonIndex) {
        applyWordsOrder(Math.max(0, Math.min(selectedWordButtonIndex, originalSelectedWordButtonIndex)));
      }
      isMovingWord = false;
    }
  });

  /**
   * The number of milliseconds during which not to play TTS after a word action occurred.
   * @type {number}
   */
  const WORD_ACTION_TTS_DELAY = 100;

  /**
   * @type {string}
   */
  const DIRECTION_LEFT = 'left';

  /**
   * @type {string}
   */
  const DIRECTION_RIGHT = 'right';

  /**
   * A CSS selector for overlay wrappers.
   * @type {string}
   */
  const SELECTOR_OVERLAY_WRAPPER = '#overlays';

  /**
   * A CSS selector for word-bank answers.
   * @type {string}
   */
  const SELECTOR_ANSWER = '.PcKtj, ._1Ga4w';

  /**
   * A CSS selector for sources of words.
   * @type {string}
   */
  const SELECTOR_WORD_SOURCE = '[data-test="word-bank"]';

  /**
   * The possible CSS selectors for the wrappers of word buttons.
   * @type {string[]}
   */
  const WORD_SELECTORS = ['._1-OTM', '_1x7lI', '._2x2Bu'];

  /**
   * A CSS selector for the wrappers of word buttons anywhere on the page.
   * @type {string}
   */
  const SELECTOR_WORD = WORD_SELECTORS.join(',');

  /**
   * A CSS selector for the word buttons anywhere on the page.
   * @type {string}
   */
  const SELECTOR_WORD_BUTTON = WORD_SELECTORS.map(_it11 => {
    return `${_it11} button`;
  }).join(',');

  /**
   * A CSS selector for the wrappers of word buttons in word-bank answers.
   * @type {string}
   */
  const SELECTOR_DRAGGABLE_WORD = WORD_SELECTORS.map(_it12 => {
    return `${SELECTOR_ANSWER} ${_it12}`;
  }).join(',');

  /**
   * A CSS selector for flying word buttons in the overlay wrapper.
   * @type {string}
   */
  const SELECTOR_OVERLAY_WORD_BUTTON = 'button._1O290, button[data-test$="-challenge-tap-token"]';

  /**
   * The class name that can be added to a word button to highlight it.
    * @type {string}
   */
  const CLASS_NAME_HIGHLIGHTED_WORD_BUTTON = '_dnd_-highlighted-word-button';

  /**
   * The class name that is added to the original word button when a word is dragged.
   * @type {string}
   */
  const CLASS_NAME_DRAGGED_WORD_BUTTON = '_dnd_-dragged-word-button';

  /**
   * A CSS selector for the word inside word buttons.
   * @type {string}
   */
  const SELECTOR_WORD_BUTTON_WORD = '._2J2do, ._3PW0K, *[data-test="challenge-tap-token-text"]';

})();
