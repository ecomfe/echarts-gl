/**
 * Provide orbit control for 3D objects
 * 
 * @module echarts-x/util/OrbitControl
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {

    'use strict';

    var zrConfig = require('zrender/config');
    var Vector2 = require('qtek/math/Vector2');
    var Vector3 = require('qtek/math/Vector3');
    var Quaternion = require('qtek/math/Quaternion');

    var EVENT = zrConfig.EVENT;

    /**
     * @alias module:echarts-x/util/OrbitControl
     * @param {qtek.Node} target Target scene node
     * @param {module:zrender~ZRender} zr
     * @param {module:echarts-x/core/Layer3D} layer
     */
    var OrbitControl = function (target, zr, layer) {
        
        /**
         * @type {module:zrender~ZRender}
         */
        this.zr = zr;

        /**
         * @type {module:echarts-x/core/Layer3D}
         */
        this.layer = layer;

        /**
         * @type {qtek.Node}
         */
        this.target = target;

        /**
         * If auto rotate the target
         * @type {boolean}
         * @default false
         */
        var autoRotate = false;
        Object.defineProperty(this, 'autoRotate', {
            get: function (val) {
                return autoRotate;
            },
            set: function (val) {
                autoRotate = val;
                this._rotating = autoRotate;
            }
        })

        /**
         * Minimum zoom rate
         * @type {number}
         * @default 0.5
         */
        this.minZoom = 0.5;

        /**
         * Maximum zoom rate
         * @type {number}
         * @default 2
         */
        this.maxZoom = 1.5;

        /**
         * Start auto rotating after still for the given time
         */
        this.autoRotateAfterStill = 0;

        /**
         * Pan or rotate
         * @type {String}
         */
        this.mode = 'rotate';

        this._rotating = false;

        this._rotateY = 0;
        this._rotateX = 0;

        this._mouseX = 0;
        this._mouseY = 0;

        this._rotateVelocity = new Vector2();

        this._panVelocity = new Vector2();

        this._cameraStartPos = new Vector3();

        this._zoom = 1;

        this._zoomSpeed = 0;

        this._animating = false;

        this._stillTimeout = 0;
    };

    OrbitControl.prototype = {
        
        constructor: OrbitControl,

        /**
         * Initialize.
         * Mouse event binding
         */
        init: function () {
            this._animating = false;
            this.layer.bind(EVENT.MOUSEDOWN, this._mouseDownHandler, this);
            this.layer.bind(EVENT.MOUSEWHEEL, this._mouseWheelHandler, this);

            this._rotating = this.autoRotate;

            Vector3.copy(this._cameraStartPos, this.layer.camera.position);

            this._decomposeRotation();
        },

        /**
         * Dispose.
         * Mouse event unbinding
         */
        dispose: function () {
            this.layer.unbind(EVENT.MOUSEDOWN, this._mouseDownHandler); 
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler);
            this.layer.unbind(EVENT.MOUSEWHEEL, this._mouseWheelHandler);
        },

        /**
         * Get zoom ratio
         * @return {number}
         */
        getZoom: function () {
            return this._zoom
        },

        /**
         * Set zoom ratio
         * @param {number} zoom
         */
        setZoom: function (zoom) {
            this._zoom = zoom;
            this.zr.refreshNextFrame();
        },

        /**
         * Rotation to animation, Params can be target quaternion or x, y, z axis
         * @example
         *     control.rotateTo({
         *         x: transform.x,
         *         y: transform.y,
         *         z: transform.z,
         *         time: 1000
         *     });
         *     control.rotateTo({
         *         rotation: quat,
         *         time: 1000,
         *         easing: 'CubicOut'
         *     })
         *     .done(function() {
         *         xxx
         *     });
         * @param {Object} opts
         * @param {qtek.math.Quaternion} [opts.rotation]
         * @param {qtek.math.Vector3} [opts.x]
         * @param {qtek.math.Vector3} [opts.y]
         * @param {qtek.math.Vector3} [opts.z]
         * @param {number} [opts.time=1000]
         * @param {number} [opts.easing='Linear']
         */
        rotateTo: function (opts) {
            var toQuat;
            var self = this;
            if (! opts.rotation) {
                toQuat = new Quaternion();
                var view = new Vector3();
                Vector3.negate(view, opts.z);
                toQuat.setAxes(view, opts.x, opts.y);
            }
            else {
                toQuat = opts.rotation;
            }

            var zr = this.zr;
            var obj = {
                p: 0
            };

            var target = this.target;
            var fromQuat = target.rotation.clone();
            this._animating = true;
            return zr.animation.animate(obj)
                .when(opts.time || 1000, {
                    p: 1
                })
                .during(function () {
                    Quaternion.slerp(
                        target.rotation, fromQuat, toQuat, obj.p
                    );
                    zr.refreshNextFrame();
                })
                .done(function () {
                    self._animating = false;
                    self._decomposeRotation();
                })
                .start(opts.easing || 'Linear');
        },

        /**
         * Zoom to animation
         * @param {Object} opts
         * @param {number} opts.zoom
         * @param {number} [opts.time=1000]
         * @param {number} [opts.easing='Linear']
         */
        zoomTo: function (opts) {
            var zr = this.zr;
            var zoom = opts.zoom;
            var self = this;

            zoom = Math.max(Math.min(this.maxZoom, zoom), this.minZoom);
            this._animating = true;
            return zr.animation.animate(this)
                .when(opts.time || 1000, {
                    _zoom: zoom
                })
                .during(function () {
                    self._setZoom(this._zoom);
                    zr.refreshNextFrame();
                })
                .done(function () {
                    self._animating = false;
                })
                .start(opts.easing || 'Linear');
        },

        /**
         * Move to animation
         * @param {Object} opts
         * @param {qtek.math.Vector3} opts.position
         * @param {number} [opts.time=1000]
         * @param {number} [opts.easing='Linear']
         */
        moveTo: function (opts) {
            var zr = this.zr;
            var position = opts.position;
            var self = this;

            this._animating = true;

            return zr.animation.animate(this.target.position)
                .when(opts.time || 1000, {
                    x: position.x,
                    y: position.y,
                    z: position.z
                })
                .during(function () {
                    zr.refreshNextFrame();
                })
                .done(function () {
                    self._animating = false;
                })
                .start(opts.easing || 'Linear');
        },

        /**
         * Call update each frame
         * @param  {number} deltaTime Frame time
         */
        update: function (deltaTime) {
            if (this._animating) {
                return;
            }

            if (this.mode === 'rotate') {
                this._updateRotate(deltaTime);
            }
            else if (this.mode === 'pan') {
                this._updatePan(deltaTime);
            }

            this._updateZoom(deltaTime);
        },

        _updateRotate: function (deltaTime) {

            var velocity = this._rotateVelocity;
            this._rotateY = (velocity.y + this._rotateY) % (Math.PI * 2);
            this._rotateX = (velocity.x + this._rotateX) % (Math.PI * 2);

            this._rotateX = Math.max(Math.min(this._rotateX, Math.PI / 2), -Math.PI / 2);

            this.target.rotation
                .identity()
                .rotateX(this._rotateX)
                .rotateY(this._rotateY);

            // Rotate speed damping
            this._vectorDamping(velocity, 0.8);

            if (this._rotating) {
                this._rotateY -= deltaTime * 1e-4;
                this.zr.refreshNextFrame();
            }
            else if (velocity.len() > 0) {
                this.zr.refreshNextFrame();
            }
        },

        _updateZoom: function (deltaTime) {

            this._setZoom(this._zoom + this._zoomSpeed);

            // Zoom speed damping
            this._zoomSpeed *= 0.8;
            if (Math.abs(this._zoomSpeed) > 1e-3) {
                this.zr.refreshNextFrame();
            }
        },

        _setZoom: function (zoom) {
            this._zoom = Math.max(Math.min(zoom, this.maxZoom), this.minZoom);
            var zoom = this._zoom;

            var camera = this.layer.camera;
            var z = camera.worldTransform.z.normalize();

            // FIXME Assume origin is ZERO
            var len = this._cameraStartPos.len() * zoom;
            camera.position.normalize().scale(len);

        },

        _updatePan: function (deltaTime) {
            var velocity = this._panVelocity;
            var target = this.target;
            var yAxis = target.worldTransform.y;
            var xAxis = target.worldTransform.x;

            // FIXME Assume origin is ZERO
            var len = this.layer.camera.position.len();
            // PENDING
            target.position
                .scaleAndAdd(xAxis, velocity.x * len / 400)
                .scaleAndAdd(yAxis, velocity.y * len / 400)

            // Pan damping
            this._vectorDamping(velocity, 0.8);

            if (velocity.len() > 0) {
                this.zr.refreshNextFrame();
            }
        },

        _startCountingStill: function () {
            clearTimeout(this._stillTimeout);

            var time = this.autoRotateAfterStill;
            var self = this;
            if (!isNaN(time) && time > 0) {
                this._stillTimeout = setTimeout(function () {
                    self._rotating = true;
                }, time * 1000);
            }
        },

        _vectorDamping: function (v, damping) {
            var speed = v.len();
            speed = speed * damping;
            if (speed < 1e-4) {
                speed = 0;
            }
            v.normalize().scale(speed);
        },

        _decomposeRotation: function () {
            var euler = new Vector3();
            // Z Rotate at last so it can be zero
            euler.eulerFromQuaternion(
                this.target.rotation.normalize(), 'ZXY'
            );

            this._rotateX = euler.x;
            this._rotateY = euler.y;
        },

        _mouseDownHandler: function (e) {
            if (this._animating) {
                return;
            }
            this.layer.bind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.bind(EVENT.MOUSEUP, this._mouseUpHandler, this);

            e = e.event;

            if (this.mode === 'rotate') {
                // Reset rotate velocity
                this._rotateVelocity.set(0, 0);

                this._rotating = false;

                if (this.autoRotate) {
                    this._startCountingStill();
                }
            }

            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
        },

        _mouseMoveHandler: function (e) {
            if (this._animating) {
                return;
            }
            e = e.event;

            if (this.mode === 'rotate') {
                this._rotateVelocity.y = (e.pageX - this._mouseX) / 500;
                this._rotateVelocity.x = (e.pageY - this._mouseY) / 500;   
            }
            else if (this.mode === 'pan') {
                this._panVelocity.x = e.pageX - this._mouseX;
                this._panVelocity.y = -e.pageY + this._mouseY;
            }

            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
        },

        _mouseWheelHandler: function (e) {
            if (this._animating) {
                return;
            }
            e = e.event;
            var delta = e.wheelDelta // Webkit
                        || -e.detail; // Firefox

            this._zoomSpeed = delta > 0 ? 0.05 : -0.05;

            this._rotating = false;

            if (this.autoRotate && this.mode === 'rotate') {
                this._startCountingStill();
            }
        },

        _mouseUpHandler: function () {
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler, this);
        }
    };

    return OrbitControl;
});