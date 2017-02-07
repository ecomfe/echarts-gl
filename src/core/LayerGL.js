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

var Renderer = require('qtek/lib/Renderer');
var RayPicking = require('qtek/lib/picking/RayPicking');


// PENDING
var Eventful = require('zrender/lib/mixin/Eventful');
var zrUtil = require('zrender/lib/core/util');

/**
 * @constructor
 * @alias module:echarts-gl/core/LayerGL
 * @param {string} id Layer ID
 * @param {module:zrender/ZRender} zr
 */
var LayerGL = function (id, zr) {

    Eventful.call(this);

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
            clear: 0
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

    this._initHandlers();
};

/**
 * Register event handling functions
 */
LayerGL.prototype._initHandlers = function () {

    // Mouse event handling
    this.on('click', this._clickHandler, this);
    this.on('mousedown', this._mouseDownHandler, this);
    this.on('mouseup', this._mouseUpHandler, this);
    this.on('mousemove', this._mouseMoveHandler, this);

    this._picking = new RayPicking({
        renderer: this.renderer
    });
};

/**
 * @param {module:echarts-gl/core/ViewGL} view
 */
LayerGL.prototype.addView = function (view) {
    if (view.layer === this) {
        return;
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

        view.scene.traverse(function (node) {
            var zr = node.__zr;
            node.__zr = null;
            if (zr && node.removeAnimatorsFromZr) {
                node.removeAnimatorsFromZr(zr);
            }
        }, this);

        view.layer = null;
    }
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
}
/**
 * Refresh the layer, will be invoked by zrender
 */
LayerGL.prototype.refresh = function () {
    this.clear();

    this.renderer.saveViewport();
    for (var i = 0; i < this.views.length; i++) {
        var viewGL = this.views[i];

        this.renderer.setViewport(viewGL.viewport);
        this.renderer.render(viewGL.scene, viewGL.camera);
    }
    this.renderer.restoreViewport();
};

/**
 * Render the give scene with layer renderer and camera
 * Without clear the buffer
 * @return {qtek.Scene}
 */
LayerGL.prototype.renderScene = function (scene) {
    this.renderer.render(scene, this.camera);
};

/**
 * Dispose the layer
 */
LayerGL.prototype.dispose = function () {
    this.renderer.disposeScene(this.scene);
};

// Event handlers
LayerGL.prototype.onmousedown = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);
    if (obj) {
        this._dispatchEvent('mousedown', e, obj);
    }
};

LayerGL.prototype.onmousemove = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);
    if (obj) {
        this._dispatchEvent('mousemove', e, obj);
    }
};

LayerGL.prototype.onmouseup = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);
    if (obj) {
        this._dispatchEvent('mouseup', e, obj);
    }
};

LayerGL.prototype.onclick = function (e) {
    e = e.event;
    var obj = this.pickObject(e.offsetX, e.offsetY);
    if (obj) {
        this._dispatchEvent('click', e, obj);
    }
};

LayerGL.prototype.pickObject = function (x, y) {

    var output = [];
    for (var i = 0; i < this.views.length; i++) {
        var viewGL = this.views[i];
        if (viewGL.containPoint(x, y)) {
            this._picking.scene = viewGL.scene;
            this._picking.camera = viewGL.camera;
            this._picking.pickAll(x, y, output);
        }
    }
    output.sort(function (a, b) {
        return a.distance - b.distance;
    })
    return output[0];
};

LayerGL.prototype._dispatchEvent = function (eveName, e, obj) {
    var current = obj.target;
    obj.cancelBubble = false;
    obj.event = e;
    obj.type = eveName;
    while (current) {
        current.trigger(eveName, obj);
        current = current.getParent();

        if (obj.cancelBubble) {
            break;
        }
    }
};

zrUtil.inherits(LayerGL, Eventful);

module.exports = LayerGL;