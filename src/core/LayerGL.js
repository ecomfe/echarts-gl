/**
 * Provide WebGL layer to zrender. Which is rendered on top of clay.
 *
 *
 * Relationship between zrender, LayerGL(renderer) and ViewGL(Scene, Camera, Viewport)
 *           zrender
 *           /     \
 *      LayerGL   LayerGL
 *    (renderer) (renderer)
 *      /     \
 *  ViewGL   ViewGL
 */

import * as echarts from 'echarts/lib/echarts';
import Renderer from 'claygl/src/Renderer';
import RayPicking from 'claygl/src/picking/RayPicking';
import Texture from 'claygl/src/Texture';
import graphicGL from '../util/graphicGL';

// PENDING, clay. notifier is same with zrender Eventful
import notifier from 'claygl/src/core/mixin/notifier';
import requestAnimationFrame from 'zrender/lib/animation/requestAnimationFrame';

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
     * @type {clay.Renderer}
     */
    try {
        this.renderer = new Renderer({
            clearBit: 0,
            devicePixelRatio: zr.painter.dpr,
            preserveDrawingBuffer: true,
            // PENDING
            premultipliedAlpha: true
        });
        this.renderer.resize(zr.painter.getWidth(), zr.painter.getHeight());
    }
    catch (e) {
        this.renderer = null;
        this.dom = document.createElement('div');
        this.dom.style.cssText = 'position:absolute; left: 0; top: 0; right: 0; bottom: 0;';
        this.dom.className = 'ecgl-nowebgl';
        this.dom.innerHTML = 'Sorry, your browser does not support WebGL';

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
     * @type {Array.<clay.Scene>}
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

    this._zrEventProxy = new echarts.graphic.Rect({
        shape: {x: -1, y: -1, width: 2, height: 2},
        // FIXME Better solution.
        __isGLToZRProxy: true
    });

    this._backgroundColor = null;

    this._disposed = false;
};

LayerGL.prototype.setUnpainted = function () {};

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
    var clearColor = this._backgroundColor || [0, 0, 0, 0];
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
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
LayerGL.prototype.refresh = function (bgColor) {

    this._backgroundColor = bgColor ? graphicGL.parseColor(bgColor) : [0, 0, 0, 0];
    this.renderer.clearColor = this._backgroundColor;

    for (var i = 0; i < this.views.length; i++) {
        this.views[i].prepareRender(this.renderer);
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


LayerGL.prototype.renderToCanvas = function (ctx) {
    // PENDING will block the page
    this._startAccumulating(true);
    ctx.drawImage(this.dom, 0, 0, ctx.canvas.width, ctx.canvas.height);
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
LayerGL.prototype._startAccumulating = function (immediate) {
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

            if (immediate) {
                accumulate(id);
            }
            else {
                requestAnimationFrame(function () {
                    accumulate(id);
                });
            }
        }
    }

    this._accumulatingId = accumulatingId++;

    if (immediate) {
        accumulate(self._accumulatingId);
    }
    else {
        this._accumulatingTimeout = setTimeout(function () {
            accumulate(self._accumulatingId);
        }, 50);
    }
};

LayerGL.prototype._trackAndClean = function () {
    var textureList = [];
    var geometriesList = [];

    // Mark all resources unused;
    if (this._textureList) {
        markUnused(this._textureList);
        markUnused(this._geometriesList);
    }

    for (var i = 0; i < this.views.length; i++) {
        collectResources(this.views[i].scene, textureList, geometriesList);
    }

    // Dispose those unsed resources.
    if (this._textureList) {
        checkAndDispose(this.renderer, this._textureList);
        checkAndDispose(this.renderer, this._geometriesList);
    }

    this._textureList = textureList;
    this._geometriesList = geometriesList;
};

function markUnused(resourceList) {
    for (var i = 0; i < resourceList.length; i++) {
        resourceList[i].__used__ = 0;
    }
}
function checkAndDispose(renderer, resourceList) {
    for (var i = 0; i < resourceList.length; i++) {
        if (!resourceList[i].__used__) {
            resourceList[i].dispose(renderer);
        }
    }
}
function updateUsed(resource, list) {
    resource.__used__ = resource.__used__ || 0;
    resource.__used__++;
    if (resource.__used__ === 1) {
        // Don't push to the list twice.
        list.push(resource);
    }
}
function collectResources(scene, textureResourceList, geometryResourceList) {
    var prevMaterial;
    var prevGeometry;
    scene.traverse(function (renderable) {
        if (renderable.isRenderable()) {
            var geometry = renderable.geometry;
            var material = renderable.material;

            // TODO optimize!!
            if (material !== prevMaterial) {
                var textureUniforms = material.getTextureUniforms();
                for (var u = 0; u < textureUniforms.length; u++) {
                    var uniformName = textureUniforms[u];
                    var val = material.uniforms[uniformName].value;
                    if (!val) {
                        continue;
                    }
                    if (val instanceof Texture) {
                        updateUsed(val, textureResourceList);
                    }
                    else if (val instanceof Array) {
                        for (var k = 0; k < val.length; k++) {
                            if (val[k] instanceof Texture) {
                                updateUsed(val[k], textureResourceList);
                            }
                        }
                    }
                }
            }
            if (geometry !== prevGeometry) {
                updateUsed(geometry, geometryResourceList);
            }

            prevMaterial = material;
            prevGeometry = geometry;
        }
    });

    for (var k = 0; k < scene.lights.length; k++) {
        // Track AmbientCubemap
        if (scene.lights[k].cubemap) {
            updateUsed(scene.lights[k].cubemap, textureResourceList);
        }
    }
}
/**
 * Dispose the layer
 */
LayerGL.prototype.dispose = function () {
    if (this._disposed) {
        return;
    }
    this._stopAccumulating();
    if (this._textureList) {
        markUnused(this._textureList);
        markUnused(this._geometriesList);
        checkAndDispose(this.renderer, this._textureList);
        checkAndDispose(this.renderer, this._geometriesList);
    }
    this.zr.off('globalout', this.onglobalout);
    this._disposed = true;
};

// Event handlers
LayerGL.prototype.onmousedown = function (e) {
    if (e.target && e.target.__isGLToZRProxy) {
        return;
    }

    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);
    if (obj) {
        this._dispatchEvent('mousedown', e, obj);
        this._dispatchDataEvent('mousedown', e, obj);
    }

    this._downX = e.offsetX;
    this._downY = e.offsetY;
};

LayerGL.prototype.onmousemove = function (e) {
    if (e.target && e.target.__isGLToZRProxy) {
        return;
    }

    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);

    var target = obj && obj.target;
    var lastHovered = this._hovered;
    this._hovered = obj;

    if (lastHovered && target !== lastHovered.target) {
        lastHovered.relatedTarget = target;
        this._dispatchEvent('mouseout', e, lastHovered);
        // this._dispatchDataEvent('mouseout', e, lastHovered);

        this.zr.setCursorStyle('default');
    }

    this._dispatchEvent('mousemove', e, obj);

    if (obj) {
        this.zr.setCursorStyle('pointer');

        if (!lastHovered || (target !== lastHovered.target)) {
            this._dispatchEvent('mouseover', e, obj);
            // this._dispatchDataEvent('mouseover', e, obj);
        }
    }

    this._dispatchDataEvent('mousemove', e, obj);
};

LayerGL.prototype.onmouseup = function (e) {
    if (e.target && e.target.__isGLToZRProxy) {
        return;
    }

    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);

    if (obj) {
        this._dispatchEvent('mouseup', e, obj);
        this._dispatchDataEvent('mouseup', e, obj);
    }

    this._upX = e.offsetX;
    this._upY = e.offsetY;
};

LayerGL.prototype.onclick = LayerGL.prototype.dblclick = function (e) {
    if (e.target && e.target.__isGLToZRProxy) {
        return;
    }

    // Ignore click event if mouse moved
    var dx = this._upX - this._downX;
    var dy = this._upY - this._downY;
    if (Math.sqrt(dx * dx + dy * dy) > 20) {
        return;
    }

    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);

    if (obj) {
        this._dispatchEvent(e.type, e, obj);
        this._dispatchDataEvent(e.type, e, obj);
    }

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

LayerGL.prototype._dispatchDataEvent = function (eveName, originalEvent, newEvent) {
    var mesh = newEvent && newEvent.target;

    var dataIndex = mesh && mesh.dataIndex;
    var seriesIndex = mesh && mesh.seriesIndex;
    // Custom event data
    var eventData = mesh && mesh.eventData;
    var elChangedInMouseMove = false;

    var eventProxy = this._zrEventProxy;
    eventProxy.x = originalEvent.offsetX;
    eventProxy.y = originalEvent.offsetY;
    eventProxy.update();

    var targetInfo = {
        target: eventProxy
    };
    const ecData = echarts.helper.getECData(eventProxy);
    if (eveName === 'mousemove') {
        if (dataIndex != null) {
            if (dataIndex !== this._lastDataIndex) {
                if (parseInt(this._lastDataIndex, 10) >= 0) {
                    ecData.dataIndex = this._lastDataIndex;
                    ecData.seriesIndex = this._lastSeriesIndex;
                    // FIXME May cause double events.
                    this.zr.handler.dispatchToElement(targetInfo, 'mouseout', originalEvent);
                }
                elChangedInMouseMove = true;
            }
        }
        else if (eventData != null) {
            if (eventData !== this._lastEventData) {
                if (this._lastEventData != null) {
                    ecData.eventData = this._lastEventData;
                    // FIXME May cause double events.
                    this.zr.handler.dispatchToElement(targetInfo, 'mouseout', originalEvent);
                }
                elChangedInMouseMove = true;
            }
        }
        this._lastEventData = eventData;
        this._lastDataIndex = dataIndex;
        this._lastSeriesIndex = seriesIndex;
    }

    ecData.eventData = eventData;
    ecData.dataIndex = dataIndex;
    ecData.seriesIndex = seriesIndex;

    if (eventData != null || (parseInt(dataIndex, 10) >= 0 && parseInt(seriesIndex, 10) >= 0)) {
        this.zr.handler.dispatchToElement(targetInfo, eveName, originalEvent);

        if (elChangedInMouseMove) {
            this.zr.handler.dispatchToElement(targetInfo, 'mouseover', originalEvent);
        }
    }
};

LayerGL.prototype._dispatchToView = function (eventName, e) {
    for (var i = 0; i < this.views.length; i++) {
        if (this.views[i].containPoint(e.offsetX, e.offsetY)) {
            this.views[i].trigger(eventName, e);
        }
    }
};

Object.assign(LayerGL.prototype, notifier);

export default LayerGL;