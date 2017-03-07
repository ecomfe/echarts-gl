/**
 * Texture Atlas for the sprites.
 * It uses zrender for 2d element management and rendering
 * @module echarts-gl/util/ZRTextureAtlasSurface
 */

// TODO Expand.
var echarts = require('echarts/lib/echarts');
var graphicGL = require('./graphicGL');
/**
 * constructor
 * @alias module:echarts-gl/util/ZRTextureAtlasSurface
 * @param {number} opt.width
 * @param {number} opt.height
 * @param {number} opt.devicePixelRatio
 * @param {Function} opt.onupdate
 */
var ZRTextureAtlasSurface = function (opt) {

    opt = opt || {};
    opt.width = opt.width || 512;
    opt.height = opt.height || 512;
    opt.devicePixelRatio = opt.devicePixelRatio || 1;

    var canvas = document.createElement('canvas');
    canvas.width = opt.width * opt.devicePixelRatio;
    canvas.height = opt.height * opt.devicePixelRatio;

    this._dpr = opt.devicePixelRatio;
    /**
     * zrender instance in the Chart
     * @type {zrender~ZRender}
     */
    this._zr = echarts.zrender.init(canvas);
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

    /**
     * Atlas canvas width
     * @type {number}
     * @private
     */
    this._width = opt.width;

    /**
     * Atlas canvas height
     * @type {number}
     * @private
     */
    this._height = opt.height;

    /**
     * Current row height
     * @type {number}
     * @private
     */
    this._rowHeight = 0;

    /**
     * Texture coords map for each sprite image
     * @type {Object}
     */
    this._coords = {};

    this.onupdate = opt.onupdate;

    // Left sub atlas.
    this.left;
    // Right sub atlas.
    this.right;
    // Top sub atlas
    this.top;
    // Bottom sub atlas
    this.bottom;

    this._texture = new graphicGL.Texture2D({
        image: canvas,
        flipY: false
    });

    var self = this;
    var oldRefreshImmediately = this._zr.refreshImmediately;
    this._zr.refreshImmediately = function () {
        oldRefreshImmediately.call(this);
        self._texture.dirty();
        self.onupdate && self.onupdate();
    };
};

ZRTextureAtlasSurface.prototype = {

    /**
     * Clear the texture atlas
     */
    clear: function () {
        this._x = 0;
        this._y = 0;
        this._rowHeight = 0;

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

    /**
     * Resize the texture atlas. Images must be added again after resize
     * @param  {number} width
     * @param  {number} height
     */
    resize: function (width, height) {
        this._zr.resize({
            width: width,
            height: height
        });
    },

    /**
     * Add shape to atlas
     * @param {module:zrender/graphic/Displayable} shape
     * @param {number} width
     * @param {number} height
     * @return {Array}
     */
    add: function (el, width, height) {
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

        if (x + width > canvasWidth && y + this._rowHeight > canvasHeight) {
            // There is no space anymore
            return null;
        }

        if (x + width > canvasWidth) {
            // Change a new row
            x = this._x = 0;
            y += this._rowHeight;
            this._y = y;
            // Reset row height
            this._rowHeight = 0;
        }
        this._x += width;

        if (this._x > this._width && this._y > this._height) {
            this._expand();
        }

        this._rowHeight = Math.max(this._rowHeight, height);

        // Shift the el
        el.position[0] += x;
        el.position[1] += y;
        this._zr.add(el);

        var coords = [
            [x / canvasWidth, y / canvasHeight],
            [(x + width) / canvasWidth, (y + height) / canvasHeight]
        ];

        this._coords[el.id] = coords;

        return coords;
    },

    refresh: function () {
        this._zr.refresh();
    },

    _expand: function () {
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