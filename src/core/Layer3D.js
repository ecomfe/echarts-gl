define(function (require) {
    
    var Renderer = require('qtek/Renderer');
    var Scene = require('qtek/Scene');
    var PerspectiveCamera = require('qtek/camera/Perspective');
    var OrthoCamera = require('qtek/camera/Orthographic');
    var RayPicking = require('qtek/picking/RayPicking');

    var Eventful = require('zrender/mixin/Eventful');
    var zrUtil = require('zrender/tool/util');

    var Layer3D = function (id, painter) {

        Eventful.call(this);

        this.id = id;

        /**
         * Canvas dom for webgl rendering
         * @type {HTMLCanvasElement}
         */
        this.dom = document.createElement('canvas');
        this.dom.style.cssText = 'position:absolute; left: 0; top: 0';

        /**
         * @type {qtek.Renderer}
         */
        this.renderer = new Renderer({
            canvas: this.dom
        });
        this.renderer.resize(painter.getWidth(), painter.getHeight());

        /**
         * @type {qtek.camera.Perspective}
         */
        this.camera = new PerspectiveCamera();
        this.camera.aspect = painter.getWidth() / painter.getHeight();

        /**
         * @type {qtek.Scene}
         */
        this.scene = new Scene();

        this._initHandlers();
    }

    Layer3D.prototype._initHandlers = function () {

        // Mouse event handling
        this.bind('click', this._clickHandler, this);
        this.bind('mousedown', this._mouseDownHandler, this);
        this.bind('mouseup', this._mouseUpHandler, this);
        this.bind('mousemove', this._mouseMoveHandler, this);

        this._picking = new RayPicking({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer
        });
    };

    /**
     * Resize the canvas and viewport
     * @param  {number} width
     * @param  {number} height
     */
    Layer3D.prototype.resize = function (width, height) {
        this.renderer.resize(width, height);
        if (this.camera instanceof PerspectiveCamera) {
            this.camera.aspect = width / height;
        }
    };

    Layer3D.prototype.refresh = function () {
        this.renderer.render(this.scene, this.camera);
    };

    Layer3D.prototype.dispose = function () {
        this.renderer.disposeScene(this.scene);
    };

    // Event handlers
    Layer3D.prototype.onmousedown = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('mousedown', e, obj);
        }
    };

    Layer3D.prototype.onmousemove = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('mousemove', e, obj);
        }
    };

    Layer3D.prototype.onmouseup = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('mouseup', e, obj);
        }
    };

    Layer3D.prototype.onclick = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('click', e, obj);
        }
    };

    Layer3D.prototype.pickObject = function (x, y) {
        return this._picking.pick(x, y);
    };

    Layer3D.prototype._dispatchEvent = function (eveName, e, obj) {
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

    zrUtil.inherits(Layer3D, Eventful);

    return Layer3D;
});