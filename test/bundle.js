(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var util = require('./util');
var _ = require('derivable');
;
;
var ddom;
(function (ddom) {
    function applyBehvaiour(node, b) {
        var maybeReactor = b(node);
        if (_.isReactor(maybeReactor)) {
            lifecycle(node, maybeReactor);
        }
    }
    var specialPropertyHandlers = {
        class: function (node, val) {
            if (!_.isDerivable(val)) {
                val = _.struct([val]);
            }
            var className = val.derive(util.renderClass);
            lifecycle(node, className.reactor(function (cn) { return node.className = cn; }));
        },
        style: function (node, styles) {
            if (_.isDerivable(styles)) {
                styles = styles.derive(util.deepDeref);
                lifecycle(node, styles.reactor(function (styles) {
                    Object.assign(node.style, styles);
                }));
            }
            else {
                for (var _i = 0, _a = Object.keys(styles); _i < _a.length; _i++) {
                    var style = _a[_i];
                    var val = styles[style];
                    if (_.isDerivable(val)) {
                        (function (style, val) {
                            lifecycle(node, val.reactor(function (v) { return node.style[style] = v; }));
                        })(style, val);
                    }
                    else {
                        node.style[style] = val;
                    }
                }
            }
        },
        behaviour: function (node, behaviour) {
            var apply = function (b) { return applyBehvaiour(node, b); };
            if (typeof behaviour === 'function') {
                apply(behaviour);
            }
            else {
                behaviour.forEach(apply);
            }
        }
    };
    var IN_DOM = '__ddom__elemInDom';
    var PARENT = '__ddom__elemParent';
    var KIDS = '__ddom__kids';
    var CURRENT_KIDS = '__ddom__current__kids';
    var TREE = '__ddom__tree';
    var CURRENT_SUBTREE = '__ddom__current__subtree';
    function ensureChildState(child) {
        if (child && child !== document.body && !child[PARENT]) {
            child[PARENT] = _.atom(ensureChildState(child.parentElement));
            child[IN_DOM] = child[PARENT].derive(function (parent) {
                return parent && (parent === document.body || parent[IN_DOM].get());
            });
        }
        return child;
    }
    function lifecycle(child, onMount, onUnmount) {
        ensureChildState(child);
        var r;
        if (_.isReactor(onMount)) {
            r = child[IN_DOM].reactor(function (inDom) {
                if (inDom) {
                    onMount.start().force();
                }
                else {
                    onMount.stop();
                }
            }).start();
        }
        else {
            r = child[IN_DOM].reactor(function (inDom) {
                if (inDom) {
                    onMount && onMount();
                }
                else {
                    onUnmount && onUnmount();
                }
            }).start();
        }
    }
    ddom.lifecycle = lifecycle;
    ddom.renderable = Symbol('ddom_renderable');
    function flattenKids(thing) {
        var result = [];
        function descend(thing) {
            if (thing != null) {
                if (_.isDerivable(thing)) {
                    descend(thing.get());
                }
                else if (thing instanceof Array) {
                    for (var i = 0; i < thing.length; i++) {
                        descend(thing[i]);
                    }
                }
                else if (typeof thing.forEach === 'function') {
                    thing.forEach(descend);
                }
                else if (typeof thing === 'string' || thing instanceof String) {
                    result.push(thing);
                }
                else if (thing[ddom.renderable]) {
                    descend(thing[ddom.renderable]());
                }
                else if (thing[Symbol.iterator]) {
                    for (var _i = 0; _i < thing.length; _i++) {
                        var item = thing[_i];
                        descend(item);
                    }
                }
                else {
                    result.push(thing);
                }
            }
        }
        descend(thing);
        return result;
    }
    function buildKidNodes(nodeCache, kids) {
        var result = [];
        var newCache = {};
        for (var _i = 0; _i < kids.length; _i++) {
            var kid = kids[_i];
            if (kid instanceof Node) {
                result.push(kid);
            }
            else {
                var s = kid.toString();
                var node = void 0;
                var oldNodes = nodeCache[s];
                if (oldNodes && oldNodes.length > 0) {
                    node = oldNodes.shift();
                }
                if (!node) {
                    node = document.createTextNode(s);
                }
                if (!Object.prototype.hasOwnProperty.call(newCache, s)) {
                    newCache[s] = [node];
                }
                else {
                    newCache[s].push(node);
                }
                result.push(node);
            }
        }
        return [result, newCache];
    }
    function remove(kid) {
        kid.remove();
        if (kid instanceof HTMLElement) {
            kid[PARENT].set(null);
        }
    }
    function insert(parent, node, before) {
        parent.insertBefore(node, before);
        if (node instanceof HTMLElement) {
            ensureChildState(node);
            node[PARENT].set(parent);
        }
    }
    function buildTree(nodes) {
        var result = [];
        for (var i = 0, len = nodes.length; i < len; i++) {
            var node = nodes[i];
            if (node instanceof HTMLElement && node[TREE]) {
                result.push(node[TREE].get());
            }
            else {
                result.push(node);
            }
        }
        return result;
    }
    function dom(tagName, props) {
        var children = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            children[_i - 2] = arguments[_i];
        }
        if (typeof tagName !== 'string') {
            throw new Error("domlock only supports regular html tags.");
        }
        var result = document.createElement(tagName);
        if (props) {
            for (var _a = 0, _b = Object.keys(props); _a < _b.length; _a++) {
                var key = _b[_a];
                var val = props[key];
                var special = specialPropertyHandlers[key];
                if (special) {
                    special(result, val);
                }
                else {
                    if (_.isDerivable(val)) {
                        (function (key, val) {
                            lifecycle(result, val.reactor(function (v) { return result[key] = v; }));
                        })(key, val);
                    }
                    else {
                        result[key] = val;
                    }
                }
            }
        }
        if (children.length) {
            var textNodeCache = {};
            result[KIDS] = _.derivation(function () { return flattenKids(children); }).derive(function (items) {
                var _a = buildKidNodes(textNodeCache, items), nodes = _a[0], newCache = _a[1];
                textNodeCache = newCache;
                return nodes;
            });
            result[CURRENT_KIDS] = [];
            result[TREE] = result[KIDS].derive(function (kids) { return [result, kids, buildTree(kids)]; });
            result[CURRENT_SUBTREE] = [];
        }
        return result;
    }
    ddom.dom = dom;
    function processTree(tree) {
        if (tree instanceof Array) {
            var node = tree[0], newKids = tree[1], subTree = tree[2];
            var currentKids = node[CURRENT_KIDS];
            if (newKids !== currentKids) {
                var text = function (x) { return x.textContent; };
                var lcs = util.longestCommonSubsequence(currentKids, newKids);
                var x = 0;
                currentKids.forEach(function (ck) {
                    if (ck !== lcs[x]) {
                        remove(ck);
                    }
                    else {
                        x++;
                    }
                });
                x = 0;
                newKids.forEach(function (nk) {
                    if (nk !== lcs[x]) {
                        insert(node, nk, lcs[x]);
                    }
                    else {
                        x++;
                    }
                });
                node[CURRENT_KIDS] = newKids;
            }
            var currentSubTree = node[CURRENT_SUBTREE];
            if (currentSubTree !== subTree) {
                subTree.forEach(processTree);
                node[CURRENT_SUBTREE] = subTree;
            }
        }
    }
    function root(parent, child) {
        parent.appendChild(child);
        if (child instanceof HTMLElement) {
            ensureChildState(child);
            child[PARENT].set(parent);
            var tree = child[TREE];
            if (tree) {
                tree.react(_.transaction(function (tree) {
                    processTree(tree);
                }));
            }
        }
    }
    ddom.root = root;
    ddom.React = { createElement: dom };
    var behaviour;
    (function (behaviour) {
        var identity = function (x) { return x; };
        function ShowWhen(when) {
            return function (node) { return when.reactor(function (condition) {
                if (condition) {
                    node.style.display = null;
                }
                else {
                    node.style.display = 'none';
                }
            }); };
        }
        behaviour.ShowWhen = ShowWhen;
        function HideWhen(when) {
            return ShowWhen(when.not());
        }
        behaviour.HideWhen = HideWhen;
        function BindValue(atom) {
            return function (node) {
                if ((node instanceof HTMLInputElement)
                    || node instanceof HTMLTextAreaElement
                    || node instanceof HTMLSelectElement) {
                    node.addEventListener('input', function () {
                        atom.set(node.value);
                    });
                }
                else {
                    throw new Error('BindValue only works with input, textarea, and select');
                }
            };
        }
        behaviour.BindValue = BindValue;
        function Value() {
            var atom = _.atom(null);
            return [atom.derive(identity), BindValue(atom)];
        }
        behaviour.Value = Value;
        function BindFocus(atom) {
            return function (node) {
                node.addEventListener('focus', function () { return atom.set(true); });
                node.addEventListener('blur', function () { return atom.set(false); });
            };
        }
        behaviour.BindFocus = BindFocus;
        function Focus() {
            var atom = _.atom(false);
            return [atom.derive(identity), BindFocus(atom)];
        }
        behaviour.Focus = Focus;
        function BindHover(atom) {
            return function (node) {
                node.addEventListener('mouseover', function () { return atom.set(true); });
                node.addEventListener('mouseout', function () { return atom.set(false); });
            };
        }
        behaviour.BindHover = BindHover;
        function Hover() {
            var atom = _.atom(false);
            return [atom.derive(identity), BindHover(atom)];
        }
        behaviour.Hover = Hover;
    })(behaviour = ddom.behaviour || (ddom.behaviour = {}));
})(ddom || (ddom = {}));
module.exports = ddom;

},{"./util":2,"derivable":3}],2:[function(require,module,exports){
var derivable_1 = require('derivable');
function populateMatrix(a, b) {
    var matrix = [];
    for (var i = 0; i < b.length; i++) {
        var row = [];
        for (var j = 0; j < a.length; j++) {
            var rowPrev = row[j - 1] || 0;
            var colPrev = i > 0 ? matrix[i - 1][j] : 0;
            var best = Math.max(rowPrev, colPrev) + (a[j] === b[i] ? 1 : 0);
            row[j] = best;
        }
        matrix.push(row);
    }
    return matrix;
}
function backtrack(result, matrix, a, b, i, j) {
    if (i === -1 || j === -1) {
        return;
    }
    else if (a[j] === b[i]) {
        result.unshift(a[j]);
        backtrack(result, matrix, a, b, i - 1, j - 1);
    }
    else if ((i > 0 ? matrix[i - 1][j] : 0) > (j > 0 ? matrix[i][j - 1] : 0)) {
        backtrack(result, matrix, a, b, i - 1, j);
    }
    else {
        backtrack(result, matrix, a, b, i, j - 1);
    }
}
function longestCommonSubsequence(a, b) {
    var result = [];
    backtrack(result, populateMatrix(a, b), a, b, b.length - 1, a.length - 1);
    return result;
}
exports.longestCommonSubsequence = longestCommonSubsequence;
function renderClass(obj) {
    if (obj instanceof Array) {
        return obj.map(renderClass).join(" ");
    }
    else if (typeof obj === 'string' || obj instanceof String) {
        return obj;
    }
    else {
        var result = "";
        for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
            var k = _a[_i];
            if (obj[k]) {
                result += " " + k;
            }
        }
        return result.slice(1);
    }
}
exports.renderClass = renderClass;
function entries(obj) {
    var ks = Object.keys(obj);
    return ks.map(function (k) { return [k, obj[k]]; });
}
exports.entries = entries;
function deepDeref(obj) {
    if (derivable_1.isDerivable(obj)) {
        return deepDeref(obj.get());
    }
    else if (obj instanceof Array) {
        return obj.map(deepDeref);
    }
    else if (obj.constructor === Object) {
        var result = {};
        Object.keys(obj).forEach(function (k) {
            result[k] = deepDeref(obj[k]);
        });
        return result;
    }
    else {
        return obj;
    }
}
exports.deepDeref = deepDeref;

},{"derivable":3}],3:[function(require,module,exports){
// UMD loader
(function (global, factory) {
  "use strict";
  if (global && typeof global.define === "function" && global.define.amd) {
    global.define(["exports"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports);
  } else {
    factory(global.Derivable = {});
  }
})(this, function (exports) {
"use strict";

var util_keys = Object.keys;

function util_extend(obj) {
  for (var i = 1; i < arguments.length; i++) {
    var other = arguments[i];
    var keys = util_keys(other);
    for (var j = keys.length; j--;) {
      var prop = keys[j];
      obj[prop] = other[prop];
    }
  }
  return obj;
}

function _is(a, b) {
  // SameValue algorithm
  if (a === b) { // Steps 1-5, 7-10
    // Steps 6.b-6.e: +0 != -0
    return a !== 0 || 1 / a === 1 / b;
  } else {
    // Step 6.a: NaN == NaN
    return a !== a && b !== b;
  }
}

function util_equals (a, b) {
  return _is(a, b) || (a && typeof a.equals === 'function' && a.equals(b));
}

function util_addToArray (a, b) {
  var i = a.indexOf(b);
  if (i < 0) {
    a.push(b);
  }
}

function util_removeFromArray (a, b) {
  var i = a.indexOf(b);
  if (i >= 0) {
    a.splice(i, 1);
  }
}

function util_arrayContains (a, b) {
  return a.indexOf(b) >= 0;
}

var nextId = 0;
function util_nextId () {
  return nextId++;
}

function util_slice (a, i) {
  return Array.prototype.slice.call(a, i);
}

var util_unique = Object.freeze({equals: function () { return false; }});

function util_some (x) {
  return (x !== null) && (x !== void 0);
}

var util_DEBUG_MODE = false;
function util_setDebugMode(val) {
  util_DEBUG_MODE = !!val;
}

// node modes
var gc_NEW = 0,
    gc_CHANGED = 1,
    gc_UNCHANGED = 2,
    gc_ORPHANED = 3,
    gc_UNSTABLE = 4,
    gc_STABLE = 5,
    gc_DISOWNED = 6;

function gc_mark(node, reactors) {
  // make everything unstable
  if (node._type === types_REACTION) {
    if (node.reacting) {
      throw new Error("Cycle detected! Don't do this!");
    }
    reactors.push(node);
  } else {
    for (var i = node._children.length; i--;) {
      var child = node._children[i];
      if (child._state !== gc_UNSTABLE) {
        child._state = gc_UNSTABLE;
        gc_mark(child, reactors);
      }
    }
  }
}

function gc_sweep(node) {
  var i;
  switch (node._state) {
  case gc_CHANGED:
  case gc_UNCHANGED:
    // changed or unchanged means the node was visited
    // during the react phase, which means we keep it in
    // the graph for the next go round
    for (i = node._children.length; i--;) {
      var child = node._children[i];
      gc_sweep(child);
      if (child._state !== gc_STABLE) {
        node._children.splice(i, 1);
      }
    }
    node._state = gc_STABLE;
    break;
  case gc_UNSTABLE:
    if (node._type === types_REACTION) {
      // only happens when reaction created in transaction. see issue #14
      node._state = gc_STABLE;
    } else {
      // unstable means the node was not visited during
      // the react phase, which means we kick it out of the
      // graph.

      // but first we check if all of its parents were unchanged
      // if so, we can avoid recalculating it in future by
      // caching its parents' current values.
      var stashedParentStates = [];
      for (i = node._parents.length; i--;) {
        var parent = node._parents[i];
        if (parent._state !== gc_UNCHANGED) {
          // nope, its parents either have changed or weren't visited,
          // so we have to orphan this node
          node._state = gc_ORPHANED;
          break;
        }
        stashedParentStates.push([parent, parent._value]);
      }
      if (node._state !== gc_ORPHANED) {
        node._state = gc_DISOWNED;
        node._parents = stashedParentStates;
      }
    }
    break;
  case gc_STABLE:
  case gc_ORPHANED:
  case gc_DISOWNED:
    break;
  default:
    throw new Error("can't sweep state " + node._state);
  }
}

function gc_abort_sweep(node) {
  // set everything to unstable, kill all derivation caches and disconnect
  // the graph
  var doChildren = false;
  switch (node._type) {
  case types_ATOM:
    node._state = gc_STABLE;
    doChildren = true;
    break;
  case types_DERIVATION:
  case types_LENS:
    node._state = gc_NEW;
    node._value = util_unique;
    doChildren = true;
    break;
  case types_REACTION:
    node._state = gc_STABLE;
    doChildren = false;
    break;
  }
  if (doChildren) {
    for (var i = node._children.length; i--;) {
      gc_abort_sweep(node._children[i]);
    }
    node._children = [];
  }
}

var parentsStack = [];

function parents_capturingParents(f) {
  var i = parentsStack.length;
  parentsStack.push([]);
  try {
    f();
    return parentsStack[i];
  } finally {
    parentsStack.pop();
  }
}

function parents_maybeCaptureParent(p) {
  if (parentsStack.length > 0) {
    util_addToArray(parentsStack[parentsStack.length - 1], p);
  }
}

var types_ATOM = "ATOM",
    types_DERIVATION = "DERIVATION",
    types_LENS = "LENS",
    types_REACTION = "REACTION";

var RUNNING = 0,
    COMPLETED = 1,
    ABORTED = 3;

var TransactionAbortion = {};

function abortTransaction() {
  throw TransactionAbortion;
}

function transactions_newContext () {
  return {currentTxn: null};
}

function transactions_inTransaction (ctx) {
  return ctx.currentTxn !== null;
}

function transactions_currentTransaction (ctx) {
  return ctx.currentTxn;
}

function begin (ctx, txn) {
  txn._parent = ctx.currentTxn;
  txn._state = RUNNING;
  ctx.currentTxn = txn;
}

function popTransaction (ctx, cb) {
  var txn = ctx.currentTxn;
  ctx.currentTxn = txn._parent;
  if (txn._state !== RUNNING) {
    throw new Error("unexpected state: " + txn._state);
  }
  cb(txn);
}

function commit (ctx) {
  popTransaction(ctx, function (txn) {
    txn._state = COMPLETED;
    txn.onCommit && txn.onCommit();
  });
}

function abort (ctx) {
  popTransaction(ctx, function (txn) {
    txn._state = ABORTED;
    txn.onAbort && txn.onAbort();
  });
}

function transactions_transact (ctx, txn, f) {
  begin(ctx, txn);
  try {
    f(abortTransaction);
  } catch (e) {
    abort(ctx);
    if (e !== TransactionAbortion) {
      throw e;
    } else {
      return;
    }
  }
  commit(ctx);
}

function transactions_ticker (ctx, txnConstructor) {
  begin(ctx, txnConstructor());
  var disposed = false;
  return {
    tick: function () {
      if (disposed) throw new Error("can't tick disposed ticker");
      commit(ctx);
      begin(ctx, txnConstructor());
    },
    stop: function () {
      if (disposed) throw new Error("ticker already disposed");
      commit(ctx);
    }
  }
}

function reactorBase (parent, control) {
  var base = {
    control: control,      // the actual object the user gets
    parent: parent,        // the parent derivable
    parentReactor: null,
    dependentReactors: [],
    _state: gc_STABLE,
    active: false,         // whether or not listening for changes in parent
    _type: types_REACTION,
    uid: util_nextId(),
    reacting: false,       // whether or not reaction function being invoked
    stopping: false,
    yielding: false,       // whether or not letting parentReactor react first
  };
  if (util_DEBUG_MODE) {
    base.stack = Error().stack;
  }
  return base;
}
var cycleMsg = "Cyclical Reactor Dependency! Not allowed!";

function stop (base) {
  if (base.active) {
    if (base.stopping) {
      throw Error(cycleMsg);
    }
    try {
      base.stopping = true;
      while (base.dependentReactors.length) {
        var dr = base.dependentReactors.pop();
        stop(dr);
      }
    } finally {
      util_removeFromArray(base.parent._children, base);
      if (base.parentReactor) {
        orphan(base);
      }
      base.active = false;
      base.stopping = false;
    }
    base.control.onStop && base.control.onStop();
  }
}

var parentReactorStack = [];

function start (base) {
  if (!base.active) {
    util_addToArray(base.parent._children, base);
    base.active = true;
    base.parent._get();
    // capture reactor dependency relationships
    var len = parentReactorStack.length;
    if (len > 0) {
      base.parentReactor = parentReactorStack[len - 1];
      util_addToArray(base.parentReactor.dependentReactors, base);
    }

    base.control.onStart && base.control.onStart();
  }
}

function orphan (base) {
  if (base.parentReactor) {
    util_removeFromArray(base.parentReactor.dependentReactors, base);
    base.parentReactor = null;
  }
}

function adopt (parentBase, childBase) {
  orphan(childBase);
  if (parentBase.active) {
    childBase.parentReactor = parentBase;
    util_addToArray(parentBase.dependentReactors, childBase);
  } else {
    stop(childBase);
  }
}

function reactors_maybeReact (base) {
  if (base.yielding) {
    throw Error(cycleMsg);
  }
  if (base.active && base._state === gc_UNSTABLE) {
    if (base.parentReactor !== null) {
      try {
        base.yielding = true;
        reactors_maybeReact(base.parentReactor);
      } finally {
        base.yielding = false;
      }
    }
    // parent might have deactivated this one
    if (base.active) {
      var parent = base.parent, parentState = parent._state;
      if (parentState === gc_UNSTABLE ||
          parentState === gc_ORPHANED ||
          parentState === gc_DISOWNED ||
          parentState === gc_NEW) {
        parent._get();
      }
      parentState = parent._state;

      if (parentState === gc_UNCHANGED) {
        base._state = gc_STABLE;
      } else if (parentState === gc_CHANGED) {
        force(base);
      } else {
          throw new Error("invalid parent state: " + parentState);
      }
    }
  }
}

function force (base) {
  // base.reacting check now in gc_mark; total solution there as opposed to here
  if (base.control.react) {
    base._state = gc_STABLE;
    try {
      base.reacting = true;
      parentReactorStack.push(base);
      if (!util_DEBUG_MODE) {
        base.control.react(base.parent._get());
      } else {
        try {
          base.control.react(base.parent._get());
        } catch (e) {
          console.error(base.stack);
          throw e;
        }
      }
    } finally {
      parentReactorStack.pop();
      base.reacting = false;
    }
  } else {
      throw new Error("No reactor function available.");
  }
}

function reactors_Reactor () {
  /*jshint validthis:true */
  this._type = types_REACTION;
}

function reactors_createBase (control, parent) {
  if (control._base) {
    throw new Error("This reactor has already been initialized");
  }
  control._base = reactorBase(parent, control);
  return control;
}

util_extend(reactors_Reactor.prototype, {
  start: function () {
    start(this._base);
    return this;
  },
  stop: function () {
    stop(this._base);
    return this;
  },
  force: function () {
    force(this._base);
    return this;
  },
  isActive: function () {
    return this._base.active;
  },
  orphan: function () {
    orphan(this._base);
    return this;
  },
  adopt: function (child) {
    if (child._type !== types_REACTION) {
      throw Error("reactors can only adopt reactors");
    }
    adopt(this._base, child._base);
    return this;
  }
});

function reactors_StandardReactor (f) {
  /*jshint validthis:true */
  this._type = types_REACTION;
  this.react = f;
}

util_extend(reactors_StandardReactor.prototype, reactors_Reactor.prototype);

function reactors_anonymousReactor (descriptor) {
  return util_extend(new reactors_Reactor(), descriptor);
}

function derivable_createPrototype (D, opts) {
  var x = {
    /**
     * Creates a derived value whose state will always be f applied to this
     * value
     */
    derive: function (f, a, b, c, d) {
      var that = this;
      switch (arguments.length) {
      case 0:
        return that;
      case 1:
        return D.derivation(function () {
          return f(that.get());
        });
      case 2:
        return D.derivation(function () {
          return f(that.get(), D.unpack(a));
        });
      case 3:
        return D.derivation(function () {
          return f(that.get(), D.unpack(a), D.unpack(b));
        });
      case 4:
        return D.derivation(function () {
          return f(that.get(),
                   D.unpack(a),
                   D.unpack(b),
                   D.unpack(c));
        });
      case 5:
        return D.derivation(function () {
          return f(that.get(),
                   D.unpack(a),
                   D.unpack(b),
                   D.unpack(c),
                   D.unpack(d));
        });
      default:
        var args = ([that]).concat(util_slice(arguments, 1));
        return D.derivation(function () {
          return f.apply(null, args.map(D.unpack));
        });
      }
    },



    reactor: function (f) {
      if (typeof f === 'function') {
        return reactors_createBase(new reactors_StandardReactor(f), this);
      } else if (f instanceof reactors_Reactor) {
        return reactors_createBase(f, this);
      } else if (f && f.react) {
        return reactors_createBase(reactors_anonymousReactor(f), this);
      } else {
        throw new Error("Unrecognized type for reactor " + f);
      }
    },

    react: function (f) {
      return this.reactor(f).start().force();
    },

    get: function () {
      parents_maybeCaptureParent(this);
      return this._get(); // abstract protected method, in Java parlance
    },

    is: function (other) {
      return D.lift(opts.equals)(this, other);
    },

    and: function (other) {
      return this.derive(function (x) {return x && D.unpack(other);});
    },

    or: function (other) {
      return this.derive(function (x) {return x || D.unpack(other);});
    },

    then: function (thenClause, elseClause) {
      return this.derive(function (x) {
        return D.unpack(x ? thenClause : elseClause);
      });
    },

    mThen: function (thenClause, elseClause) {
      return this.derive(function (x) {
        return D.unpack(util_some(x) ? thenClause : elseClause);
      });
    },

    mOr: function (other) {
      return this.mThen(this, other);
    },

    mDerive: function () {
      return this.mThen(this.derive.apply(this, arguments));
    },

    mAnd: function (other) {
      return this.mThen(other, this);
    },

    not: function () {
      return this.derive(function (x) { return !x; });
    },
  };
  x.switch = function () {
    var args = arguments;
    return this.derive(function (x) {
      var i;
      for (i = 0; i < args.length-1; i+=2) {
        if (opts.equals(x, D.unpack(args[i]))) {
          return D.unpack(args[i+1]);
        }
      }
      if (i === args.length - 1) {
        return D.unpack(args[i]);
      }
    });
  };
  return x;
}

function derivation_createPrototype (D, opts) {
  return {
    _clone: function () {
      return D.derivation(this._deriver);
    },

    _forceGet: function () {
      var that = this,
          i;
      var newParents = parents_capturingParents(function () {
        var newState;
        if (!util_DEBUG_MODE) {
          newState = that._deriver();
        } else {
          try {
            newState = that._deriver();
          } catch (e) {
            console.error(that._stack);
            throw e;
          }
        }
        that._state = opts.equals(newState, that._value) ? gc_UNCHANGED : gc_CHANGED;
        that._value = newState;
      });

      // organise parents
      for (i = this._parents.length; i--;) {
        var possiblyFormerParent = this._parents[i];
        if (!util_arrayContains(newParents, possiblyFormerParent)) {
          util_removeFromArray(possiblyFormerParent._children, this);
        }
      }

      this._parents = newParents;

      // add this as child to new parents
      for (i = newParents.length; i--;) {
        util_addToArray(newParents[i]._children, this);
      }
    },

    _get: function () {
      var i, parent;
      outer: switch (this._state) {
      case gc_NEW:
      case gc_ORPHANED:
        this._forceGet();
        break;
      case gc_UNSTABLE:
        for (i = 0; i < this._parents.length; i++) {
          parent = this._parents[i];
          var parentState = parent._state;
          if (parentState === gc_UNSTABLE ||
              parentState === gc_ORPHANED ||
              parentState === gc_DISOWNED) {
            parent._get();
          }
          parentState = parent._state;
          if (parentState === gc_CHANGED) {
            this._forceGet();
            break outer;
          } else if (!(parentState === gc_STABLE ||
                       parentState === gc_UNCHANGED)) {
            throw new Error("invalid parent mode: " + parentState);
          }
        }
        this._state = gc_UNCHANGED;
        break;
      case gc_DISOWNED:
        var parents = [];
        for (i = 0; i < this._parents.length; i++) {
          var parentStateTuple = this._parents[i],
              state = parentStateTuple[1];
          parent = parentStateTuple[0];
          if (!opts.equals(parent._get(), state)) {
            this._parents = [];
            this._forceGet();
            break outer;
          } else {
            parents.push(parent);
          }
        }
        for (i = parents.length; i--;) {
          util_addToArray(parents[i]._children, this);
        }
        this._parents = parents;
        this._state = gc_UNCHANGED;
        break;
      default:
        // noop
      }

      return this._value;
    }
  }
}

function derivation_construct(obj, deriver) {
  obj._children = [];
  obj._parents = [];
  obj._deriver = deriver;
  obj._state = gc_NEW;
  obj._type = types_DERIVATION;
  obj._value = util_unique;

  if (util_DEBUG_MODE) {
    obj._stack = Error().stack;
  }

  return obj;
}

function mutable_createPrototype (D, _) {
  return {
    swap: function (f) {
      var args = util_slice(arguments, 0);
      args[0] = this.get();
      return this.set(f.apply(null, args));
    },
    lens: function (lensDescriptor) {
      return D.lens(this, lensDescriptor);
    }
  }
}

function lens_createPrototype(D, _) {
  return {
    _clone: function () {
      return D.lens(this._parent, {
        get: this._getter,
        set: this._setter
      });
    },

    set: function (value) {
      this._parent.set(this._setter(this._parent._get(), value));
      return this;
    }
  }
}

function lens_construct(derivation, parent, descriptor) {
  derivation._getter = descriptor.get;
  derivation._setter = descriptor.set;
  derivation._parent = parent;
  derivation._type = types_LENS;

  return derivation;
}

function processReactorQueue (rq) {
  for (var i = rq.length; i--;) {
    reactors_maybeReact(rq[i]);
  }
}

var TXN_CTX = transactions_newContext();

var NOOP_ARRAY = {push: function () {}};

function TransactionState () {
  this.inTxnValues = {};
  this.reactorQueue = [];
}

function getState (txnState, atom) {
  var inTxnValue = txnState.inTxnValues[atom._uid];
  if (inTxnValue) {
    return inTxnValue[1];
  } else {
    return atom._value;
  }
}

function setState (txnState, atom, state) {
  txnState.inTxnValues[atom._uid] = [atom, state];
  gc_mark(atom, txnState.reactorQueue);
}

util_extend(TransactionState.prototype, {
  onCommit: function () {
    var i, atomValueTuple;
    var keys = util_keys(this.inTxnValues);
    if (transactions_inTransaction(TXN_CTX)) {
      // push in-txn vals up to current txn
      for (i = keys.length; i--;) {
        atomValueTuple = this.inTxnValues[keys[i]];
        atomValueTuple[0].set(atomValueTuple[1]);
      }
    } else {
      // change root state and run reactors.
      for (i = keys.length; i--;) {
        atomValueTuple = this.inTxnValues[keys[i]];
        atomValueTuple[0]._value = atomValueTuple[1];
        gc_mark(atomValueTuple[0], NOOP_ARRAY);
      }

      processReactorQueue(this.reactorQueue);

      // then sweep for a clean finish
      for (i = keys.length; i--;) {
        gc_sweep(this.inTxnValues[keys[i]][0]);
      }
    }
  },

  onAbort: function () {
    if (!transactions_inTransaction(TXN_CTX)) {
      var keys = util_keys(this.inTxnValues);
      for (var i = keys.length; i--;) {
        gc_abort_sweep(this.inTxnValues[keys[i]][0]);
      }
    }
  }
})


function atom_createPrototype (D, opts) {
  return {
    _clone: function () {
      return D.atom(this._value);
    },

    withValidator: function (f) {
      if (f === null) {
        return this._clone();
      } if (typeof f === 'function') {
        var result = this._clone();
        var existing = this._validator;
        if (existing) {
          result._validator = function (x) { return f(x) && existing(x); }
        } else {
          result._validator = f;
        }
        return result;
      } else {
        throw new Error(".withValidator expects function or null");
      }
    },

    validate: function () {
      this._validate(this.get());
    },

    _validate: function (value) {
      var validationResult = this._validator && this._validator(value);
      if (this._validator && validationResult !== true) {
        throw new Error("Failed validation with value: '" + value + "'." +
                        " Validator returned '" + validationResult + "' ");
      }
    },

    set: function (value) {

      this._validate(value);
      if (!opts.equals(value, this._value)) {
        this._state = gc_CHANGED;

        if (transactions_inTransaction(TXN_CTX)) {
          setState(transactions_currentTransaction(TXN_CTX), this, value);
        } else {
          this._value = value;

          var reactorQueue = [];
          gc_mark(this, reactorQueue);
          processReactorQueue(reactorQueue);
          gc_sweep(this);
        }
      }
      return this;
    },

    _get: function () {
      if (transactions_inTransaction(TXN_CTX)) {
        return getState(transactions_currentTransaction(TXN_CTX), this);
      }
      return this._value;
    }
  };
}

function atom_construct (atom, value) {
  atom._uid = util_nextId();
  atom._children = [];
  atom._state = gc_STABLE;
  atom._value = value;
  atom._type = types_ATOM;
  return atom;
}

function atom_transact (f) {
  transactions_transact(TXN_CTX, new TransactionState(), f);
}

function atom_transaction (f) {
  return function () {
    var args = util_slice(arguments, 0);
    var that = this;
    var result;
    atom_transact(function () {
      result = f.apply(that, args);
    });
    return result;
  }
}

var ticker = null;

function atom_ticker () {
  if (ticker) {
    ticker.refCount++;
  } else {
    ticker = transactions_ticker(TXN_CTX, function () {
      return new TransactionState();
    });
    ticker.refCount = 1;
  }
  var done = false;
  return {
    tick: function () {
      if (done) throw new Error('tyring to use ticker after release');
      ticker.tick();
    },
    release: function () {
      if (done) throw new Error('ticker already released');
      if (--ticker.refCount === 0) {
        ticker.stop();
        ticker = null;
      }
      done = true;
    }
  };
}

var defaultConfig = { equals: util_equals };

function constructModule (config) {
  config = util_extend({}, defaultConfig, config || {});

  var D = {
    transact: atom_transact,
    defaultEquals: util_equals,
    setDebugMode: util_setDebugMode,
    transaction: atom_transaction,
    ticker: atom_ticker,
    Reactor: reactors_Reactor,
    isAtom: function (x) {
      return x && (x._type === types_ATOM || x._type === types_LENS);
    },
    isDerivable: function (x) {
      return x && (x._type === types_ATOM ||
                   x._type === types_LENS ||
                   x._type === types_DERIVATION);
    },
    isDerivation: function (x) {
      return x && (x._type === types_DERIVATION || x._type === types_LENS)
    },
    isLensed: function (x) {
      return x && x._type === types_LENS;
    },
    isReactor: function (x) {
      return x && x._type === types_REACTION;
    },
  };

  var Derivable  = derivable_createPrototype(D, config);
  var Mutable    = mutable_createPrototype(D, config);

  var Atom       = util_extend({}, Mutable, Derivable,
                               atom_createPrototype(D, config));

  var Derivation = util_extend({}, Derivable,
                               derivation_createPrototype(D, config));

  var Lens       = util_extend({}, Mutable, Derivation,
                              lens_createPrototype(D, config));


  /**
   * Constructs a new atom whose state is the given value
   */
  D.atom = function (val) {
    return atom_construct(Object.create(Atom), val);
  };

  /**
   * Sets the e's state to be f applied to e's current state and args
   */
  D.swap = function (atom, f) {
    var args = util_slice(arguments, 1);
    args[0] = atom.get();
    return atom.set(f.apply(null, args));
  };

  D.derivation = function (f) {
    return derivation_construct(Object.create(Derivation), f);
  };

  /**
   * Creates a new derivation. Can also be used as a template string tag.
   */
  D.derive = function (a) {
    if (a instanceof Array) {
      return deriveString.apply(null, arguments);
    } else if (arguments.length > 0) {
      return Derivable.derive.apply(a, util_slice(arguments, 1));
    } else {
      throw new Error("Wrong arity for derive. Expecting 1+ args");
    }
  };

  function deriveString (parts) {
    var args = util_slice(arguments, 1);
    return D.derivation(function () {
      var s = "";
      for (var i=0; i<parts.length; i++) {
        s += parts[i];
        if (i < args.length) {
          s += D.unpack(args[i]);
        }
      }
      return s;
    });
  }

  D.mDerive = function (a) {
    return Derivable.mDerive.apply(a, util_slice(arguments, 1));
  };

  /**
   * creates a new lens
   */
  D.lens = function (parent, descriptor) {
    var lens = Object.create(Lens);
    return lens_construct(
      derivation_construct(
        lens,
        function () { return descriptor.get(parent.get()); }
      ),
      parent,
      descriptor
    );
  };

  /**
   * dereferences a thing if it is dereferencable, otherwise just returns it.
   */
  D.unpack = function (thing) {
    if (D.isDerivable(thing)) {
      return thing.get();
    } else {
      return thing;
    }
  };

  /**
   * lifts a non-monadic function to work on derivables
   */
  D.lift = function (f) {
    return function () {
      var args = arguments;
      var that = this;
      return D.derivation(function () {
        return f.apply(that, Array.prototype.map.call(args, D.unpack));
      });
    }
  };

  /**
   * sets a to v, returning v
   */
  D.set = function (a, v) {
    return a.set(v);
  };

  D.get = function (d) {
    return d.get();
  };

  function deepUnpack (thing) {
    if (D.isDerivable(thing)) {
      return thing.get();
    } else if (thing instanceof Array) {
      return thing.map(deepUnpack);
    } else if (thing.constructor === Object) {
      var result = {};
      var keys = util_keys(thing);
      for (var i = keys.length; i--;) {
        var prop = keys[i];
        result[prop] = deepUnpack(thing[prop]);
      }
      return result;
    } else {
      return thing;
    }
  }

  D.struct = function (arg) {
    if (arg.constructor === Object || arg instanceof Array) {
      return D.derivation(function () {
        return deepUnpack(arg);
      });
    } else {
      throw new Error("`struct` expects plain Object or Array");
    }
  };

  D.destruct = function (arg) {
    var args = arguments;
    var result = [];
    for (var i = 1; i < args.length; i++) {
      result.push(D.lookup(arg, args[i]));
    }
    return result;
  };

  D.lookup = function (arg, prop) {
    return D.derivation(function () {
      return D.unpack(arg)[D.unpack(prop)];
    })
  };

  D.ifThenElse = function (a, b, c) { return a.then(b, c) };

  D.ifThenElse = function (testValue, thenClause, elseClause) {
    return D.derivation(function () {
      return D.unpack(
        D.unpack(testValue) ? thenClause : elseClause
      );
    });
  }

  D.mIfThenElse = function (testValue, thenClause, elseClause) {
    return D.derivation(function () {
      var x = D.unpack(testValue);
      return D.unpack(
        util_some(x) ? thenClause : elseClause
      );
    });
  };

  D.or = function () {
    var args = arguments;
    return D.derivation(function () {
      var val;
      for (var i = 0; i < args.length; i++) {
        val = D.unpack(args[i]);
        if (val) {
          break;
        }
      }
      return val;
    });
  };

  D.mOr = function () {
    var args = arguments;
    return D.derivation(function () {
      var val;
      for (var i = 0; i < args.length; i++) {
        val = D.unpack(args[i]);
        if (util_some(val)) {
          break;
        }
      }
      return val;
    });
  };

  D.and = function () {
    var args = arguments;
    return D.derivation(function () {
      var val;
      for (var i = 0; i < args.length; i++) {
        val = D.unpack(args[i]);
        if (!val) {
          break;
        }
      }
      return val;
    });
  };

  D.mAnd = function () {
    var args = arguments;
    return D.derivation(function () {
      var val;
      for (var i = 0; i < args.length; i++) {
        val = D.unpack(args[i]);
        if (!util_some(val)) {
          break;
        }
      }
      return val;
    });
  };

  D.not = function (x) { return x.derive(function (x) { return !x; }); };

  D.switchCase = function (x) {
    return Derivable.switch.apply(x, util_slice(arguments, 1));
  };

  return D;
}

util_extend(exports, constructModule());
exports.withEquality = function (equals) {
  return constructModule({equals: equals});
};
exports['default'] = exports;

});


},{}],4:[function(require,module,exports){
var ddom_1 = require('../build/ddom');
var derivable_1 = require('../node_modules/derivable');
var ShowWhen = ddom_1.behaviour.ShowWhen, BindValue = ddom_1.behaviour.BindValue;
var $Time = derivable_1.atom(Date.now());
setInterval(function () { return $Time.set(Date.now()); }, 16);
var $seconds = $Time.derive(function (t) { return t - (t % 1000); });
var blink = ShowWhen($Time.derive(function (t) { return Math.round(t / 250) % 2 == 0; }));
function TranslateX($amount) {
    return function (node) { return $amount.reactor(function (x) {
        node.style.transform = "translateX(" + x + ")";
    }); };
}
var wobble = TranslateX($Time.derive(function (t) { return (Math.sin(t / 300) * 40) + "px"; }));
var page = (ddom_1.React.createElement("div", {"behaviour": [blink, wobble]}, "The time is now ", $seconds.derive(function (t) { return new Date(t).toString(); })));
var $Name = derivable_1.atom("");
var $Bio = derivable_1.atom("");
var $Age = derivable_1.atom(0);
var form = (ddom_1.React.createElement("div", null, ddom_1.React.createElement("input", {"type": 'text', "behaviour": BindValue($Name)}), ddom_1.React.createElement("br", null), ddom_1.React.createElement("textarea", {"behaviour": BindValue($Bio)}), ddom_1.React.createElement("br", null), ddom_1.React.createElement("select", {"behaviour": BindValue($Age)}, ddom_1.React.createElement("option", {"value": 1}, "1"), ddom_1.React.createElement("option", {"value": 2}, "2"), ddom_1.React.createElement("option", {"value": 3}, "3"))));
var _a = ddom_1.behaviour.Hover(), $hovering = _a[0], hover = _a[1];
var junk = (ddom_1.React.createElement("div", {"behaviour": hover}, ddom_1.React.createElement("div", null, "the name is ", $Name), ddom_1.React.createElement("div", null, "the bio is ", $Bio), ddom_1.React.createElement("div", null, "the age is ", $Age.derive(function (a) { return a + 50; })), ddom_1.React.createElement("div", {"behaviour": ShowWhen($hovering)}, "hovering yo")));
window.addEventListener('load', function () {
    ddom_1.root(document.body, page);
    ddom_1.root(document.body, form);
    ddom_1.root(document.body, junk);
});

},{"../build/ddom":1,"../node_modules/derivable":3}]},{},[4]);
