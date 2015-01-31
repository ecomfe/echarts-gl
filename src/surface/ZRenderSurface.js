/**
 * Surface texture in the 3D scene.
 * Provide management and rendering of zrender shapes and groups
 *
 * @module echarts-x/surface/ZRenderSurface
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {

    var Storage = require('zrender/Storage');
    var Texture = require('qtek/Texture2D');
    var Vector3 = require('qtek/math/Vector3');
    var Vector2 = require('qtek/math/Vector2');

    /**
     * @constructor
     * @alias echarts-x/surface/ZRenderSurface
     * @param {number} width
     * @param {number} height
     */
    var ZRenderSurface = function (width, height) {
        /**
         * Callback after refreshing
         * @type {Function}
         */
        this.onrefresh = function () {};

        this._storage = new Storage();

        this._canvas = document.createElement('canvas');

        this._width = width || 512;
        this._height = height || 512;
        this._canvas.width = this._width;
        this._canvas.height = this._height;

        this._ctx = this._canvas.getContext('2d');

        this._texture = new Texture({
            image: this._canvas,
            anisotropic: 32,
            flipY: false
        });

        this.refreshNextTick = this.refreshNextTick.bind(this);
    }

    ZRenderSurface.prototype = {

        constructor: ZRenderSurface,

        /**
         * @type {string}
         */
        backgroundColor: '',

        /**
         * @type {HTMLImageElement|HTMLCanvasElement}
         */
        backgroundImage: null,

        addElement: function (el) {
            this._storage.addRoot(el);
        },

        delElement: function (el) {
            this._storage.delRoot(el);
        },

        clearElements: function () {
            this._storage.delRoot();
        },

        getTexture: function () {
            return this._texture;
        },

        resize: function (width, height) {
            if (
                this._width === width && this._height === height
            ) {
                return;
            }

            this._width = width;
            this._height = height;
            this._canvas.width = width;
            this._canvas.height = height;
            this.refresh();
        },

        getWidth: function () {
            return this._width;
        },

        getHeight: function () {
            return this._height;
        },

        refresh: function () {
            var ctx = this._ctx;

            ctx.clearRect(0, 0, this._width, this._height);
            if (this.backgroundColor) {
                ctx.fillStyle = this.backgroundColor;
                ctx.fillRect(0, 0, this._width, this._height);
            }

            var bg = this.backgroundImage;
            if (bg && bg.width && bg.height) {
                ctx.drawImage(this.backgroundImage, 0, 0, this._width, this._height);
            }

            var list = this._storage.getShapeList(true);
            for (var i = 0; i < list.length; i++) {
                var shape = list[i];
                if (!shape.invisible) {
                    shape.brush(ctx, shape.isHighlight, this.refreshNextTick);
                }
            }

            this._texture.dirty();

            this.onrefresh && this.onrefresh();
        },

        refreshNextTick: (function () {
            var timeout;
            return function() {
                var self = this;
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(function () {
                    self.refresh();
                }, 16);
            }
        })(),

        hover: function (e) {
            var list = this._storage.getShapeList();
            var shape = this.pick(e.target, e.face, e.point, list);

            var needsRefresh = false;
            for (var i = 0; i < list.length; i++) {
                list[i].isHighlight = false;
                list[i].zlevel = 0;
                if (
                    list[i] == shape && !list[i].isHighlight
                    || (list[i] != shape && list[i].isHighlight)
                ) {
                    needsRefresh = true;
                }
            }
            if (shape) {
                shape.isHighlight = true;
                shape.zlevel = 10;
            }

            if (needsRefresh) {
                this.refresh();
            }

            return shape;
        },

        pick: (function () {

            var p0 = new Vector3();
            var p1 = new Vector3();
            var p2 = new Vector3();
            var uv0 = new Vector2();
            var uv1 = new Vector2();
            var uv2 = new Vector2();
            var uv = new Vector2();

            var vCross = new Vector3();

            return function (attachedMesh, triangle, points, list) {
                var geo = attachedMesh.geometry;
                var position = geo.attributes.position;
                var texcoord = geo.attributes.texcoord0;

                position.get(triangle[0], p0);
                position.get(triangle[1], p1);
                position.get(triangle[2], p2);
                texcoord.get(triangle[0], uv0);
                texcoord.get(triangle[1], uv1);
                texcoord.get(triangle[2], uv2);

                Vector3.cross(vCross, p1, p2);
                var det = Vector3.dot(p0, vCross);
                var t = Vector3.dot(points, vCross) / det;
                Vector3.cross(vCross, p2, p0);
                var u = Vector3.dot(points, vCross) / det;
                Vector3.cross(vCross, p0, p1);
                var v = Vector3.dot(points, vCross) / det;

                Vector2.scale(uv, uv0, t);
                Vector2.scaleAndAdd(uv, uv, uv1, u);
                Vector2.scaleAndAdd(uv, uv, uv2, v);

                var x = uv.x * this._width;
                var y = uv.y * this._height;

                var list = list || this._storage.getShapeList();
                for (var i = list.length - 1; i >= 0; i--) {
                    var shape = list[i];
                    if (!shape.isSilent() && shape.isCover(x, y)) {
                        return shape;
                    }
                }
            }
        })()
    };

    return ZRenderSurface;
});