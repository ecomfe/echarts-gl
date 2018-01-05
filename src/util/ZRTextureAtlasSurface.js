/**
 * Texture Atlas for the sprites.
 * It uses zrender for 2d element management and rendering
 * @module echarts-gl/util/ZRTextureAtlasSurface
 */

// TODO Expand.
import echarts from 'echarts/lib/echarts';
import Texture2D from 'claygl/src/Texture2D';

function ZRTextureAtlasSurfaceNode(zr, offsetX, offsetY, width, height, gap, dpr) {
    this._zr = zr;

    /**
     * Current cursor x
     * @type {number}
     * @private
     */
    this._x = 0;

    /**
     * Current cursor y
     * @type {number}
     */
    this._y = 0;

    this._rowHeight = 0;
    /**
     * width without dpr.
     * @type {number}
     * @private
     */
    this.width = width;

    /**
     * height without dpr.
     * @type {number}
     * @private
     */
    this.height = height;

    /**
     * offsetX without dpr
     * @type {number}
     */
    this.offsetX = offsetX;
    /**
     * offsetY without dpr
     * @type {number}
     */
    this.offsetY = offsetY;

    this.dpr = dpr;

    this.gap = gap;
}

ZRTextureAtlasSurfaceNode.prototype = {

    constructor: ZRTextureAtlasSurfaceNode,

    clear: function () {
        this._x = 0;
        this._y = 0;
        this._rowHeight = 0;
    },

    /**
     * Add shape to atlas
     * @param {module:zrender/graphic/Displayable} shape
     * @param {number} width
     * @param {number} height
     * @return {Array}
     */
    add: function (el, width, height) {
        // FIXME Text element not consider textAlign and textVerticalAlign.

        // TODO, inner text, shadow
        var rect = el.getBoundingRect();

        // FIXME aspect ratio
        if (width == null) {
            width = rect.width;
        }
        if (height == null) {
            height = rect.height;
        }
        width *= this.dpr;
        height *= this.dpr;

        this._fitElement(el, width, height);

        // var aspect = el.scale[1] / el.scale[0];
        // Adjust aspect ratio to make the text more clearly
        // FIXME If height > width, width is useless ?
        // width = height * aspect;
        // el.position[0] *= aspect;
        // el.scale[0] = el.scale[1];

        var x = this._x;
        var y = this._y;

        var canvasWidth = this.width * this.dpr;
        var canvasHeight = this.height * this.dpr;
        var gap = this.gap;

        if (x + width + gap > canvasWidth) {
            // Change a new row
            x = this._x = 0;
            y += this._rowHeight + gap;
            this._y = y;
            // Reset row height
            this._rowHeight = 0;
        }

        this._x += width + gap;

        this._rowHeight = Math.max(this._rowHeight, height);

        if (y + height + gap > canvasHeight) {
            // There is no space anymore
            return null;
        }

        // Shift the el
        el.position[0] += this.offsetX * this.dpr + x;
        el.position[1] += this.offsetY * this.dpr + y;

        this._zr.add(el);

        var coordsOffset = [
            this.offsetX / this.width,
            this.offsetY / this.height
        ];
        var coords = [
            [x / canvasWidth + coordsOffset[0], y / canvasHeight + coordsOffset[1]],
            [(x + width) / canvasWidth + coordsOffset[0], (y + height) / canvasHeight + coordsOffset[1]]
        ];

        return coords;
    },

    /**
     * Fit element size by correct its position and scaling
     * @param {module:zrender/graphic/Displayable} el
     * @param {number} spriteWidth
     * @param {number} spriteHeight
     */
    _fitElement: function (el, spriteWidth, spriteHeight) {
        // TODO, inner text, shadow
        var rect = el.getBoundingRect();

        var scaleX = spriteWidth / rect.width;
        var scaleY = spriteHeight / rect.height;
        el.position = [-rect.x * scaleX, -rect.y * scaleY];
        el.scale = [scaleX, scaleY];
        el.update();
    }
}
/**
 * constructor
 * @alias module:echarts-gl/util/ZRTextureAtlasSurface
 * @param {number} opt.width
 * @param {number} opt.height
 * @param {number} opt.devicePixelRatio
 * @param {number} opt.gap Gap for safe.
 * @param {Function} opt.onupdate
 */
function ZRTextureAtlasSurface (opt) {

    opt = opt || {};
    opt.width = opt.width || 512;
    opt.height = opt.height || 512;
    opt.devicePixelRatio = opt.devicePixelRatio || 1;
    opt.gap = opt.gap == null ? 2 : opt.gap;

    var canvas = document.createElement('canvas');
    canvas.width = opt.width * opt.devicePixelRatio;
    canvas.height = opt.height * opt.devicePixelRatio;

    this._canvas = canvas;

    this._texture = new Texture2D({
        image: canvas,
        flipY: false
    });

    var self = this;
    /**
     * zrender instance in the Chart
     * @type {zrender~ZRender}
     */
    this._zr = echarts.zrender.init(canvas);
    var oldRefreshImmediately = this._zr.refreshImmediately;
    this._zr.refreshImmediately = function () {
        oldRefreshImmediately.call(this);
        self._texture.dirty();
        self.onupdate && self.onupdate();
    };

    this._dpr = opt.devicePixelRatio;

    /**
     * Texture coords map for each sprite image
     * @type {Object}
     */
    this._coords = {};

    this.onupdate = opt.onupdate;

    this._gap = opt.gap;

    // Left sub atlas.
    this._textureAtlasNodes = [new ZRTextureAtlasSurfaceNode(
        this._zr, 0, 0, opt.width, opt.height, this._gap, this._dpr
    )];

    this._nodeWidth = opt.width;
    this._nodeHeight = opt.height;

    this._currentNodeIdx = 0;
}

ZRTextureAtlasSurface.prototype = {

    /**
     * Clear the texture atlas
     */
    clear: function () {

        for (var i = 0; i < this._textureAtlasNodes.length; i++) {
            this._textureAtlasNodes[i].clear();
        }

        this._currentNodeIdx = 0;

        this._zr.clear();
        this._coords = {};
    },

    /**
     * @return {number}
     */
    getWidth: function () {
        return this._width;
    },

    /**
     * @return {number}
     */
    getHeight: function () {
        return this._height;
    },

    /**
     * @return {number}
     */
    getTexture: function () {
        return this._texture;
    },

    /**
     * @return {number}
     */
    getDevicePixelRatio: function () {
        return this._dpr;
    },

    getZr: function () {
        return this._zr;
    },

    _getCurrentNode: function () {
        return this._textureAtlasNodes[this._currentNodeIdx];
    },

    _expand: function () {
        this._currentNodeIdx++;
        if (this._textureAtlasNodes[this._currentNodeIdx]) {
            // Use the node created previously.
            return this._textureAtlasNodes[this._currentNodeIdx];
        }

        var maxSize = 4096 / this._dpr;
        var textureAtlasNodes = this._textureAtlasNodes;
        var nodeLen = textureAtlasNodes.length;
        var offsetX = (nodeLen * this._nodeWidth) % maxSize;
        var offsetY = Math.floor(nodeLen * this._nodeWidth / maxSize) * this._nodeHeight;
        if (offsetY >= maxSize) {
            // Failed if image is too large.
            if (__DEV__) {
                console.error('Too much labels. Some will be ignored.');
            }
            return;
        }

        var width = (offsetX + this._nodeWidth) * this._dpr;
        var height = (offsetY + this._nodeHeight) * this._dpr;
        try {
            // Resize will error in node.
            this._zr.resize({
                width: width,
                height: height
            });
        }
        catch (e) {
            this._canvas.width = width;
            this._canvas.height = height;
        }

        var newNode = new ZRTextureAtlasSurfaceNode(
            this._zr, offsetX, offsetY, this._nodeWidth, this._nodeHeight, this._gap, this._dpr
        );
        this._textureAtlasNodes.push(newNode);

        return newNode;
    },

    add: function (el, width, height) {
        if (this._coords[el.id]) {
            if (__DEV__) {
                console.warn('Element already been add');
            }
            return this._coords[el.id];
        }
        var coords = this._getCurrentNode().add(el, width, height);
        if (!coords) {
            var newNode = this._expand();
            if (!newNode) {
                // To maximum
                return;
            }
            coords = newNode.add(el, width, height);
        }

        this._coords[el.id] = coords;

        return coords;
    },

    /**
     * Get coord scale after texture atlas is expanded.
     * @return {Array.<number>}
     */
    getCoordsScale: function () {
        var dpr = this._dpr;
        return [this._nodeWidth / this._canvas.width * dpr, this._nodeHeight / this._canvas.height * dpr];
    },

    /**
     * Get texture coords of sprite image
     * @param  {string} id Image id
     * @return {Array}
     */
    getCoords: function (id) {
        return this._coords[id];
    }
};

export default ZRTextureAtlasSurface;