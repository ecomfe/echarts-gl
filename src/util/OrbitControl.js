define(function (require) {

    'use strict';

    var zrConfig = require('zrender/config');
    var Vector2 = require('qtek/math/Vector2');

    var EVENT = zrConfig.EVENT;

    var OrbitControl = function (target, zr, layer) {
        
        this.zr = zr;

        this.layer = layer;

        this.target = target;

        this.autoRotate = false;

        this.minZoom = 0.5;
        this.maxZoom = 2;

        this._zoom = 1;

        this._rotateY = 0;
        this._rotateX = 0;

        this._mouseX = 0;
        this._mouseY = 0;

        this._rotateVelocity = new Vector2();

        this._zoomSpeed = 0;
    };

    OrbitControl.prototype = {
        
        constructor: OrbitControl,

        init: function () {
            this.layer.bind(EVENT.MOUSEDOWN, this._mouseDownHandler, this);
            this.layer.bind(EVENT.MOUSEWHEEL, this._mouseWheelHandler, this);
        },

        dispose: function () {
            this.layer.unbind(EVENT.MOUSEDOWN, this._mouseDownHandler); 
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler);
            this.layer.unbind(EVENT.MOUSEWHEEL, this._mouseWheelHandler);
        },

        update: function (deltaTime) {
            this._rotateY = (this._rotateVelocity.y + this._rotateY) % (Math.PI * 2);
            this._rotateX = (this._rotateVelocity.x + this._rotateX) % (Math.PI * 2);

            this._rotateX = Math.max(Math.min(this._rotateX, Math.PI / 2), -Math.PI / 2);

            this._zoom += this._zoomSpeed;
            this._zoom = Math.max(Math.min(this._zoom, this.maxZoom), this.minZoom);

            this.target.rotation
                .identity()
                .rotateX(this._rotateX)
                .rotateY(this._rotateY);

            var zoom = this._zoom;
            this.target.scale.set(zoom, zoom, zoom);

            if (this.autoRotate) {
                this._rotateY -= deltaTime * 1e-4;
                this.zr.refreshNextFrame();
            } else if (this._rotateVelocity.len() > 0 || this._zoomSpeed !== 0) {
                this.zr.refreshNextFrame();
            }
            // Rotate speed damping
            var speed = this._rotateVelocity.len();
            speed = speed * 0.8;
            if (speed < 1e-4) {
                speed = 0;
            }
            this._rotateVelocity.normalize().scale(speed);
            // Zoom speed damping
            this._zoomSpeed *= 0.8;
            if (Math.abs(this._zoomSpeed) < 1e-3) {
                this._zoomSpeed = 0;
            }
        },

        _mouseDownHandler: function (e) {
            this.layer.bind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.bind(EVENT.MOUSEUP, this._mouseUpHandler, this);

            e = e.event;
            // Reset rotate velocity
            this._rotateVelocity.set(0, 0);
            this._mouseX = e.pageX;
            this._mouseY = e.pageY;

            if (this.autoRotate) {
                this.autoRotate = false;
            }
        },

        _mouseMoveHandler: function (e) {
            e = e.event;

            this._rotateVelocity.y = (e.pageX - this._mouseX) / 500;
            this._rotateVelocity.x = (e.pageY - this._mouseY) / 500;

            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
        },

        _mouseWheelHandler: function (e) {
            e = e.event;
            var delta = e.wheelDelta // Webkit
                        || -e.detail; // Firefox

            this._zoomSpeed = delta > 0 ? 0.05 : -0.05;
        },

        _mouseUpHandler: function () {
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler, this);
        }
    };

    return OrbitControl;
});