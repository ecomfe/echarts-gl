/**
 * Texture Atlas for the sprites
 *
 * @module echarts-x/core/TextureAtlas
 */

define(function (require) {

    var Texture2D = require('qtek/Texture2D');
    /**
     * constructor
     * @alias module:echarts-x/core/TextureAtlas
     * @param {number} width
     * @param {number} height
     */
    var TextureAtlas = function (width, height) {

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
        this._width = width || 1024;

        /**
         * Atlas canvas height
         * @type {number}
         * @private
         */
        this._height = height || 1024;

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

        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d');

        this._canvas.width = this._width;
        this._canvas.height = this._height;

        this._texture = new Texture2D({
            anisotropic: 32,
            image: this._canvas,
            flipY: false
        });
    };

    TextureAtlas.prototype = {

        /**
         * Clear the texture atlas
         */
        clear: function () {
            this._x = 0;
            this._y = 0;
            this._rowHeight = 0;

            this._ctx.clearRect(0, 0, this._width, this._height);
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

        getTexture: function () {
            return this._texture;
        },

        /**
         * Resize the texture atlas. Images must be added again after resize
         * @param  {number} width
         * @param  {number} height
         */
        resize: function (width, height) {
            if (
                width === this._width
                && height === this._height
            ) {
                return;
            }
            this._width = width;
            this._height = height;
            this._canvas.width = width;
            this._canvas.height = height;

            this.clear();
        },

        /**
         * Add image to atlas
         * @param {string} id Image ID
         * @param {HTMLImageElement|HTMLCanvasElement} image
         * @param {number} [width]
         * @param {number} [height]
         * @return {Array}
         */
        addImage: function (id, image, width, height) {
            var imgWidth = image.width;
            var imgHeight = image.height;
            if (! imgWidth || ! imgHeight) {
                // Image is not renderable
                return null;
            }
            if (height == null) {
                width = imgWidth;
                if (width == null) {
                    height = imgHeight;
                } else {
                    // Ratio scaling
                    height = width / imgWidth * imgHeight;
                }
            }

            var x = this._x;
            var y = this._y;

            if (x + width > this._width && y + this._rowHeight > this._height) {
                // There is no space anymore
                return null;
            }

            if (x + width > this._width) {
                // Change a new row
                x = this._x = 0;
                y += this._rowHeight;
                this._y = y;
                // Reset row height
                this._rowHeight = 0;
            }
            this._x += width;

            this._rowHeight = Math.max(this._rowHeight, height);

            this._ctx.drawImage(image, x, y, width, height);

            var coords = [
                [x / this._width, y / this._height],
                [(x + width) / this._width, (y + height) / this._height]
            ];
            this._coords[id] = coords;

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
    }

    return TextureAtlas;
});