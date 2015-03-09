/**
 * Texture Atlas for the sprites.
 * It uses ZRenderSurface for shape management and rendering
 * @module echarts-x/surface/TextureAtlasSurface
 */

define(function (require) {

    var Texture2D = require('qtek/Texture2D');
    var ZRenderSurface = require('./ZRenderSurface');
    var area = require('zrender/tool/area');
    /**
     * constructor
     * @alias module:echarts-x/surface/TextureAtlasSurface
     * @param {number} width
     * @param {number} height
     */
    var TextureAtlasSurface = function (zr, width, height) {

        /**
         * zrender instance in the Chart
         * @type {zrender~ZRender}
         */
        this.zr = zr;
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

        this._zrenderSurface = new ZRenderSurface(width, height);
        this._zrenderSurface.onrefresh = function () {
            zr.refreshNextFrame();
        };
    };

    TextureAtlasSurface.prototype = {

        /**
         * Clear the texture atlas
         */
        clear: function () {
            this._x = 0;
            this._y = 0;
            this._rowHeight = 0;

            this._zrenderSurface.clearElements();
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
            return this._zrenderSurface.getTexture();
        },

        /**
         * Resize the texture atlas. Images must be added again after resize
         * @param  {number} width
         * @param  {number} height
         */
        resize: function (width, height) {
            this._zrenderSurface.resize(width, height);
        },

        /**
         * Add shape to atlas
         * @param {zrender/shape/Base} shape
         * @param {number} width
         * @param {number} height
         * @return {Array}
         */
        addShape: function (shape, width, height) {
            this._fitShape(shape, width, height);

            var aspect = shape.scale[1] / shape.scale[0];

            // Adjust aspect ratio to make the text more clearly
            // FIXME If height > width, width is useless ?
            width = height * aspect;
            shape.position[0] *= aspect;
            shape.scale[0] = shape.scale[1];

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

            // Shift the shape
            shape.position[0] += x;
            shape.position[1] += y;
            this._zrenderSurface.addElement(shape);

            var coords = [
                [x / this._width, y / this._height],
                [(x + width) / this._width, (y + height) / this._height]
            ];
            this._coords[shape.id] = coords;

            return coords;
        },

        refresh: function () {
            this._zrenderSurface.refresh();
        },

        refreshNextTick: function () {
            this._zrenderSurface.refreshNextTick();
        },

        /**
         * Fit shape size by correct its position and scaling
         * @param {zrender/shape/Base} shape
         * @param {number} spriteWidth
         * @param {number} spriteHeight
         */
        _fitShape: function (shape, spriteWidth, spriteHeight) {
            var shapeStyle = shape.style;
            var rect = shape.getRect(shapeStyle);
            var lineWidth = shapeStyle.lineWidth || 0;
            var shadowBlur = shapeStyle.shadowBlur || 0;
            var margin = lineWidth + shadowBlur;
            var textWidth = 0, textHeight = 0;
            if (shapeStyle.text) {
                textHeight = area.getTextHeight('国', shapeStyle.textFont);
                textWidth = area.getTextWidth(shapeStyle.text, shapeStyle.textFont);
            }

            rect.x -= margin;
            rect.y -= margin;
            rect.width += margin * 2;
            rect.height += margin * 2;

            if (shapeStyle.text) {
                var width = rect.width;
                var height = rect.height;
                // 文本与图形间空白间隙
                // ZRender 里是写死的，这里也写死了
                var dd = 10;

                // FIXME textAlign and textBaseline
                switch (shapeStyle.textPosition) {
                    case 'inside':
                        width = Math.max(textWidth, width);
                        height = Math.max(textHeight, height);
                        rect.x -= (width - rect.width) / 2;
                        rect.y -= (height - rect.height) / 2;
                        break;
                    case 'top':
                        width = Math.max(textWidth, width);
                        height += textHeight + dd;
                        rect.x -= (width - rect.width) / 2;
                        rect.y -= textHeight + dd;
                        break;
                    case 'bottom':
                        width = Math.max(textWidth, width);
                        height += textHeight + dd;
                        rect.x -= (width - rect.width) / 2;
                        break;
                    case 'left':
                        width += textWidth + dd;
                        height = Math.max(textHeight, height);
                        rect.x -= textWidth + dd;
                        rect.y -= (height - rect.height) / 2;
                        break;
                    case 'right':
                        width += textWidth + dd;
                        height = Math.max(textHeight, height);
                        rect.y -= (height - rect.height) / 2;
                        break;
                }

                rect.width = width;
                rect.height = height;
            }

            var scaleX = spriteWidth / rect.width;
            var scaleY = spriteHeight / rect.height;
            var x = rect.x;
            var y = rect.y;
            shape.position = [-rect.x * scaleX, -rect.y * scaleY];
            shape.scale = [scaleX, scaleY];
            shape.updateTransform();
        },

        /**
         * @param {Object|number} x Event object delivered from Layer3D or x coord
         * @param {number} [y] y
         */
        hover: function (x, y) {
            return this._zrenderSurface.hover(x, y);
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

    return TextureAtlasSurface;
});