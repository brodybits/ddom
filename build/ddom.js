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
