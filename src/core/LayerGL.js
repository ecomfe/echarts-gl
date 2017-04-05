/**
 * Provide WebGL layer to zrender. Which is rendered on top of qtek.
 *
 *
 * Relationship between zrender, LayerGL and ViewGL(Scene, Camera, Viewport)
 *           zrender
 *           /     \
 *      LayerGL   LayerGL
 *    (renderer) (renderer)
 *      /     \
 *  ViewGL   ViewGL
 *
 * @module echarts-gl/core/LayerGL
 * @author Yi Shen(http://github.com/pissang)
 */

var echarts = require('echarts/lib/echarts');
var Renderer = require('qtek/lib/Renderer');
var RayPicking = require('qtek/lib/picking/RayPicking');
var Texture = require('qtek/lib/Texture');

// PENDING, qtek notifier is same with zrender Eventful
var notifier = require('qtek/lib/core/mixin/notifier');
var requestAnimationFrame = require('zrender/lib/animation/requestAnimationFrame');

/**
 * @constructor
 * @alias module:echarts-gl/core/LayerGL
 * @param {string} id Layer ID
 * @param {module:zrender/ZRender} zr
 */
var LayerGL = function (id, zr) {

    /**
     * Layer ID
     * @type {string}
     */
    this.id = id;

    /**
     * @type {module:zrender/ZRender}
     */
    this.zr = zr;

    /**
     * @type {qtek.Renderer}
     */
    try {
        this.renderer = new Renderer({
            clearBit: 0,
            devicePixelRatio: zr.painter.dpr,
            preserveDrawingBuffer: true
        });
        this.renderer.resize(zr.painter.getWidth(), zr.painter.getHeight());
    }
    catch (e) {
        this.renderer = null;
        this.dom = document.createElement('div');
        this.dom.style.cssText = 'position:absolute; left: 0; top: 0; right: 0; bottom: 0;';
        this.dom.className = 'ecgl-nowebgl';
        this.dom.innerHTML = 'Sorry, your browser does support WebGL';

        console.error(e);
        return;
    }

    this.onglobalout = this.onglobalout.bind(this);
    zr.on('globalout', this.onglobalout);

    /**
     * Canvas dom for webgl rendering
     * @type {HTMLCanvasElement}
     */
    this.dom = this.renderer.canvas;
    var style = this.dom.style;
    style.position = 'absolute';
    style.left = '0';
    style.top = '0';

    /**
     * @type {Array.<qtek.Scene>}
     */
    this.views = [];

    this._picking = new RayPicking({
        renderer: this.renderer
    });

    this._viewsToDispose = [];

    /**
     * Current accumulating id.
     */
    this._accumulatingId = 0;
};

/**
 * @param {module:echarts-gl/core/ViewGL} view
 */
LayerGL.prototype.addView = function (view) {
    if (view.layer === this) {
        return;
    }
    // If needs to dispose in this layer. unmark it.
    var idx = this._viewsToDispose.indexOf(view);
    if (idx >= 0) {
        this._viewsToDispose.splice(idx, 1);
    }

    this.views.push(view);

    view.layer = this;

    var zr = this.zr;
    view.scene.traverse(function (node) {
        node.__zr = zr;
        if (node.addAnimatorsToZr) {
            node.addAnimatorsToZr(zr);
        }
    });
};

function removeFromZr(node) {
    var zr = node.__zr;
    node.__zr = null;
    if (zr && node.removeAnimatorsFromZr) {
        node.removeAnimatorsFromZr(zr);
    }
}
/**
 * @param {module:echarts-gl/core/ViewGL} view
 */
LayerGL.prototype.removeView = function (view) {
    if (view.layer !== this) {
        return;
    }

    var idx = this.views.indexOf(view);
    if (idx >= 0) {
        this.views.splice(idx, 1);
        view.scene.traverse(removeFromZr, this);
        view.layer = null;

        // Mark to dispose in this layer.
        this._viewsToDispose.push(view);
    }
};

/**
 * Remove all views
 */
LayerGL.prototype.removeViewsAll = function () {
    this.views.forEach(function (view) {
        view.scene.traverse(removeFromZr, this);
        view.layer = null;

        // Mark to dispose in this layer.
        this._viewsToDispose.push(view);
    }, this);

    this.views.length = 0;

};

/**
 * Resize the canvas and viewport, will be invoked by zrender
 * @param  {number} width
 * @param  {number} height
 */
LayerGL.prototype.resize = function (width, height) {
    var renderer = this.renderer;
    renderer.resize(width, height);
};

/**
 * Clear color and depth
 * @return {[type]} [description]
 */
LayerGL.prototype.clear = function () {
    var gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
};

/**
 * Clear depth
 */
LayerGL.prototype.clearDepth = function () {
    var gl = this.renderer.gl;
    gl.clear(gl.DEPTH_BUFFER_BIT);
};

/**
 * Clear color
 */
LayerGL.prototype.clearColor = function () {
    var gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
};

/**
 * Mark layer to refresh next tick
 */
LayerGL.prototype.needsRefresh = function () {
    this.zr.refresh();
};

/**
 * Refresh the layer, will be invoked by zrender
 */
LayerGL.prototype.refresh = function () {

    for (var i = 0; i < this.views.length; i++) {
        this.views[i].prepareRender();
    }

    this._doRender(false);

    // Auto dispose unused resources on GPU, like program(shader), texture, geometry(buffers)
    this._trackAndClean();

    // Dispose trashed views
    for (var i = 0; i < this._viewsToDispose.length; i++) {
        this._viewsToDispose[i].dispose(this.renderer);
    }
    this._viewsToDispose.length = 0;

    this._startAccumulating();
};

LayerGL.prototype._doRender = function (accumulating) {
    this.clear();
    this.renderer.saveViewport();
    for (var i = 0; i < this.views.length; i++) {
        this.views[i].render(this.renderer, accumulating);
    }
    this.renderer.restoreViewport();
};

/**
 * Stop accumulating
 */
LayerGL.prototype._stopAccumulating = function () {
    this._accumulatingId = 0;
    clearTimeout(this._accumulatingTimeout);
};

var accumulatingId = 1;
/**
 * Start accumulating all the views.
 * Accumulating is for antialising and have more sampling in SSAO
 * @private
 */
LayerGL.prototype._startAccumulating = function () {
    var self = this;
    this._stopAccumulating();

    var needsAccumulate = false;
    for (var i = 0; i < this.views.length; i++) {
        needsAccumulate = this.views[i].needsAccumulate() || needsAccumulate;
    }
    if (!needsAccumulate) {
        return;
    }

    function accumulate(id) {
        if (!self._accumulatingId || id !== self._accumulatingId) {
            return;
        }

        var isFinished = true;
        for (var i = 0; i < self.views.length; i++) {
            isFinished = self.views[i].isAccumulateFinished() && needsAccumulate;
        }

        if (!isFinished) {
            self._doRender(true);
            requestAnimationFrame(function () {
                accumulate(id);
            });
        }
    }

    this._accumulatingId = accumulatingId++;
    this._accumulatingTimeout = setTimeout(function () {
        accumulate(self._accumulatingId);
    }, 50);
};

function getId(resource) {
    return resource.__GUID__;
}
// configs for Auto GC for GPU resources
// PENDING
var MAX_SHADER_COUNT = 60;
var MAX_GEOMETRY_COUNT = 20;
var MAX_TEXTURE_COUNT = 20;

function checkAndDispose(gl, resourceMap, maxCount) {
    var count = 0;
    // FIXME not allocate array.
    var unused = [];
    for (var id in resourceMap) {
        if (!resourceMap[id].count) {
            unused.push(resourceMap[id].target);
        }
        else {
            count++;
        }
    }
    for (var i = 0; i < Math.min(count - maxCount, unused.length); i++) {
        unused[i].dispose(gl);
    }
}

function addToMap(map, target) {
    var id = getId(target);
    map[id] = map[id] || {
        count: 0, target: target
    };
    map[id].count++;
}
LayerGL.prototype._trackAndClean = function () {
    var shadersMap = this._shadersMap = this._shadersMap || {};
    var texturesMap = this._texturesMap = this._texturesMap || {};
    var geometriesMap = this._geometriesMap = this._geometriesMap || {};

    for (var id in shadersMap) {
        shadersMap[id].count = 0;
    }
    for (var id in texturesMap) {
        texturesMap[id].count = 0;
    }
    for (var id in geometriesMap) {
        geometriesMap[id].count = 0;
    }

    function trackQueue(queue) {
        for (var i = 0; i < queue.length; i++) {
            var renderable = queue[i];
            var geometry = renderable.geometry;
            var material = renderable.material;
            var shader = material.shader;
            addToMap(geometriesMap, geometry);
            addToMap(shadersMap, shader);

            for (var name in material.uniforms) {
                var val = material.uniforms[name].value;
                if (val instanceof Texture) {
                    addToMap(texturesMap, val);
                }
                else if (val instanceof Array) {
                    for (var k = 0; k < val.length; k++) {
                        if (val[k] instanceof Texture) {
                            addToMap(texturesMap, val[k]);
                        }
                    }
                }
            }
        }
    }
    for (var i = 0; i < this.views.length; i++) {
        var viewGL = this.views[i];
        var scene = viewGL.scene;

        trackQueue(scene.opaqueQueue);
        trackQueue(scene.transparentQueue);

        for (var k = 0; k < scene.lights.length; k++) {
            // Track AmbientCubemap
            if (scene.lights[k].cubemap) {
                addToMap(texturesMap, scene.lights[k].cubemap);
            }
        }
    }
    // Dispose those unsed resources
    var gl = this.renderer.gl;

    checkAndDispose(gl, shadersMap, MAX_SHADER_COUNT);
    checkAndDispose(gl, texturesMap, MAX_TEXTURE_COUNT);
    checkAndDispose(gl, geometriesMap, MAX_GEOMETRY_COUNT);
};

/**
 * Dispose the layer
 */
LayerGL.prototype.dispose = function () {
    this._stopAccumulating();
    this.renderer.disposeScene(this.scene);

    this.zr.off('globalout', this.onglobalout);
};

// Event handlers
LayerGL.prototype.onmousedown = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);
    if (obj) {
        this._dispatchEvent('mousedown', e, obj);
    }

    this._downX = e.offsetX;
    this._downY = e.offsetY;
};

LayerGL.prototype.onmousemove = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);

    var target = obj && obj.target;
    var lastHovered = this._hovered;
    this._hovered = obj;

    if (lastHovered && target !== lastHovered.target) {
        lastHovered.relatedTarget = target;
        this._dispatchEvent('mouseout', e, lastHovered);

        this.zr.setCursorStyle('default');
    }

    this._dispatchEvent('mousemove', e, obj);

    if (obj) {
        this.zr.setCursorStyle('pointer');

        if (!lastHovered || (target !== lastHovered.target)) {
            this._dispatchEvent('mouseover', e, obj);
        }
    }
};

LayerGL.prototype.onmouseup = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);

    this._dispatchEvent('mouseup', e, obj);

    this._upX = e.offsetX;
    this._upY = e.offsetY;
};

LayerGL.prototype.onclick = function (e) {
    // Ignore click event if mouse moved
    var dx = this._upX - this._downX;
    var dy = this._upY - this._downY;
    if (Math.sqrt(dx * dx + dy * dy) > 20) {
        return;
    }

    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);

    this._dispatchEvent('click', e, obj);

    // Try set depth of field onclick
    var result = this._clickToSetFocusPoint(e);
    if (result) {
        var success = result.view.setDOFFocusOnPoint(result.distance);
        if (success) {
            this.zr.refresh();
        }
    }
};

LayerGL.prototype._clickToSetFocusPoint = function (e) {
    var renderer = this.renderer;
    var oldViewport = renderer.viewport;
    for (var i = this.views.length - 1; i >= 0; i--) {
        var viewGL = this.views[i];
        if (viewGL.hasDOF() && viewGL.containPoint(e.offsetX, e.offsetY)) {
            this._picking.scene = viewGL.scene;
            this._picking.camera = viewGL.camera;
            // Only used for picking, renderer.setViewport will also invoke gl.viewport.
            // Set directly, PENDING.
            renderer.viewport = viewGL.viewport;
            var result = this._picking.pick(e.offsetX, e.offsetY, true);
            if (result) {
                result.view = viewGL;
                return result;
            }
        }
    }
    renderer.viewport = oldViewport;
};

LayerGL.prototype.onglobalout = function (e) {
    var lastHovered = this._hovered;
    if (lastHovered) {
        this._dispatchEvent('mouseout', e, {
            target: lastHovered.target
        });
    }
};

LayerGL.prototype.pickObject = function (x, y) {

    var output = [];
    var renderer = this.renderer;
    var oldViewport = renderer.viewport;
    for (var i = 0; i < this.views.length; i++) {
        var viewGL = this.views[i];
        if (viewGL.containPoint(x, y)) {
            this._picking.scene = viewGL.scene;
            this._picking.camera = viewGL.camera;
            // Only used for picking, renderer.setViewport will also invoke gl.viewport.
            // Set directly, PENDING.
            renderer.viewport = viewGL.viewport;
            this._picking.pickAll(x, y, output);
        }
    }
    renderer.viewport = oldViewport;
    output.sort(function (a, b) {
        return a.distance - b.distance;
    });
    return output[0];
};

LayerGL.prototype._dispatchEvent = function (eveName, originalEvent, newEvent) {
    if (!newEvent) {
        newEvent = {};
    }
    var current = newEvent.target;

    newEvent.cancelBubble = false;
    newEvent.event = originalEvent;
    newEvent.type = eveName;
    newEvent.offsetX = originalEvent.offsetX;
    newEvent.offsetY = originalEvent.offsetY;

    while (current) {
        current.trigger(eveName, newEvent);
        current = current.getParent();

        if (newEvent.cancelBubble) {
            break;
        }
    }

    this._dispatchToView(eveName, newEvent);
};

LayerGL.prototype._dispatchToView = function (eventName, e) {
    for (var i = 0; i < this.views.length; i++) {
        if (this.views[i].containPoint(e.offsetX, e.offsetY)) {
            this.views[i].trigger(eventName, e);
        }
    }
};

echarts.util.extend(LayerGL.prototype, notifier);

module.exports = LayerGL;