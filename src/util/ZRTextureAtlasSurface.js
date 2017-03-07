/**
 * Texture Atlas for the sprites.
 * It uses zrender for 2d element management and rendering
 * @module echarts-gl/util/ZRTextureAtlasSurface
 */

// TODO Expand.
var echarts = require('echarts/lib/echarts');
var Texture2D = require('qtek/lib/Texture2D');

function ZRTextureAtlasSurfaceNode(zr, offsetX, offsetY, width, height, dpr) {
    this._zr = zr;
    this._offsetX = offsetX;
    this._offsetY = offsetY;

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
     * Atlas canvas width
     * @type {number}
     * @private
     */
    this._width = width;

    /**
     * Atlas canvas height
     * @type {number}
     * @private
     */
    this._height = height;

    /**
     * @type {number}
     */
    this._offsetX = offsetX;
    /**
     * @type {number}
     */
    this._offsetY = offsetY;

    this._dpr = dpr;
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
        width *= this._dpr;
        height *= this._dpr;

        this._fitElement(el, width, height);

        // var aspect = el.scale[1] / el.scale[0];
        // Adjust aspect ratio to make the text more clearly
        // FIXME If height > width, width is useless ?
        // width = height * aspect;
        // el.position[0] *= aspect;
        // el.scale[0] = el.scale[1];

        var x = this._x;
        var y = this._y;

        var canvasWidth = this._width * this._dpr;
        var canvasHeight = this._height * this._dpr;

        if (x + width > canvasWidth) {
            // Change a new row
            x = this._x = 0;
            y += this._rowHeight;
            this._y = y;
            // Reset row height
            this._rowHeight = 0;
        }

        this._x += width;

        this._rowHeight = Math.max(this._rowHeight, height);

        if (y + height > canvasHeight) {
            // There is no space anymore
            return null;
        }

        // Shift the el
        el.position[0] += this._offsetX + x;
        el.position[1] += this._offsetY + y;

        this._zr.add(el);

        var coords = [
            [x / canvasWidth, y / canvasHeight],
            [(x + width) / canvasWidth, (y + height) / canvasHeight]
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
 * @param {Function} opt.onupdate
 */
function ZRTextureAtlasSurface (opt) {

    opt = opt || {};
    opt.width = opt.width || 512;
    opt.height = opt.height || 512;
    opt.devicePixelRatio = opt.devicePixelRatio || 1;

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

    // Left sub atlas.
    this._textureAtlasNodes = [new ZRTextureAtlasSurfaceNode(
        this._zr, 0, 0, opt.width, opt.height, this._dpr
    )];

    this._nodeWidth = opt.width;
    this._nodeHeight = opt.height;
}

ZRTextureAtlasSurface.prototype = {

    /**
     * Clear the texture atlas
     */
    clear: function () {

        for (var i = 0; i < this._textureAtlasNodes.length; i++) {
            this._textureAtlasNodes[i].clear();
        }

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
        return this._textureAtlasNodes[this._textureAtlasNodes.length - 1];
    },

    _expand: function () {
        var maxSize = 4096 / this._dpr;
        var textureAtlasNodes = this._textureAtlasNodes;
        var nodeLen = textureAtlasNodes.length;
        var offsetX = (nodeLen * this._nodeWidth) % maxSize;
        var offsetY = Math.floor(nodeLen * this._nodeWidth / maxSize) * this._nodeHeight;
        if (offsetY >= maxSize) {
            // Failed if image is too large.
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
            this._zr, offsetX, offsetY, this._nodeWidth, this._nodeHeight, this._dpr
        );
        this._textureAtlasNodes.push(newNode);

        return newNode;
    },

    add: function (el, width, height) {
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
     * Get texture coords of sprite image
     * @param  {string} id Image id
     * @return {Array}
     */
    getImageCoords: function (id) {
        return this._coords[id];
    }
};

module.exports = ZRTextureAtlasSurface;