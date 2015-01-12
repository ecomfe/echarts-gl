// Surface texture which rendered with zrender
define(function (require) {

    var Storage = require('zrender/Storage');
    var Texture = require('qtek/texture/Texture2D');
    var Vector3 = require('qtek/math/Vector3');
    var Vector2 = require('qtek/math/Vector2');
    var zrConfig = require('zrender/config');

    var ZRenderSurface = function (zr, width, height) {

        this._zr = zr;

        this._storage = new Storage();

        this._canvas = document.createElement('canvas');

        this._width = width || 512;
        this._height = height || 512;
        this._canvas.width = this._width;
        this._canvas.height = this._height;

        this._ctx = this._canvas.getContext('2d');

        this._texture = new Texture({
            image: this._canvas,
            anisotropic: 32
        });
    }

    ZRenderSurface.prototype = {

        constructor: ZRenderSurface,

        clearColor: '',

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
            this._width = width;
            this._height = height;
            this._canvas.width = width;
            this._canvas.height = height;
            this.refresh();
        },

        refresh: function () {
            var ctx = this._ctx;

            ctx.clearRect(0, 0, this._width, this._height);
            if (this.clearColor) {
                ctx.fillStyle = this.clearColor;
                ctx.fillRect(0, 0, this._width, this._height);
            }

            var bg = this.backgroundImage;
            if (bg && bg.width && bg.height) {
                // flipY
                ctx.translate(0, this._height);
                ctx.scale(1, -1);
                ctx.drawImage(this.backgroundImage, 0, 0, this._width, this._height);
                ctx.scale(1, -1);
                ctx.translate(0, -this._height);
            }

            var list = this._storage.getShapeList(true);
            for (var i = 0; i < list.length; i++) {
                var shape = list[i];
                if (!shape.invisible) {
                    shape.brush(ctx, shape.isHighlight, this._refreshNextTick);
                }
            }

            this._texture.dirty();

            this._zr.refreshNextFrame();
        },

        _refreshNextTick: (function () {
            var timeout;
            return function() {
                var self = this;
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(function () {
                    self.refresh();
                }, 20);
            }
        }),

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
                // Trigger a global zr event to tooltip
                this._zr.handler.dispatch(zrConfig.EVENT.MOUSEMOVE, {
                    target: shape,
                    event: e.event,
                    type: zrConfig.EVENT.MOUSEMOVE
                });
            }

            if (needsRefresh) {
                this.refresh();
            }
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
                var y = (1 - uv.y) * this._height;

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