/**
 * Provide orbit control for 3D objects
 *
 * @module echarts-gl/util/OrbitControl
 * @author Yi Shen(http://github.com/pissang)
 */

var Base = require('qtek/lib/core/Base');
var Vector2 = require('qtek/lib/math/Vector2');
var Vector3 = require('qtek/lib/math/Vector3');
var Quaternion = require('qtek/lib/math/Quaternion');

/**
 * @alias module:echarts-x/util/OrbitControl
 */
var OrbitControl = Base.extend(function () {

    return {
        /**
         * @type {module:zrender~ZRender}
         */
        zr: null,

        /**
         * @type {qtek.math.Vector3}
         */
        origin: new Vector3(),

        /**
         * Minimum distance to the origin
         * @type {number}
         * @default 0.5
         */
        minDistance: 0.5,

        /**
         * Maximum distance to the origin
         * @type {number}
         * @default 2
         */
        maxDistance: 1.5,

        /**
         * Start auto rotating after still for the given time
         */
        autoRotateAfterStill: 0,

        /**
         * Pan or rotate
         * @type {String}
         */
        mode: 'rotate',

        /**
         * @type {qtek.Camera}
         */
        _camera: null,

        _needsUpdate: false,

        _rotating: false,

        _rotateY: 0,
        _rotateX: 0,

        _mouseX: 0,
        _mouseY: 0,

        _rotateVelocity: new Vector2(),

        _panVelocity: new Vector2(),

        _distance: 100,

        _zoomSpeed: 0,

        _animating: false,

        _stillTimeout: 0,

        _animators: []
    };
}, {
    /**
     * Initialize.
     * Mouse event binding
     */
    init: function () {
        this._animating = false;
        this.zr.on('mousedown', this._mouseDownHandler, this);
        this.zr.on('mousewheel', this._mouseWheelHandler, this);

        this._decomposeRotation();

        this.zr.animation.on('frame', this._update, this);
    },

    /**
     * Dispose.
     * Mouse event unbinding
     */
    dispose: function () {
        this.zr.off('mousedown', this._mouseDownHandler);
        this.zr.off('mousemove', this._mouseMoveHandler);
        this.zr.off('mouseup', this._mouseUpHandler);
        this.zr.off('mousewheel', this._mouseWheelHandler);

        this.stopAllAnimation();
    },

    /**
     * Get distance
     * @return {number}
     */
    getDistance: function () {
        return this._distance;
    },

    /**
     * Set distance
     * @param {number} distance
     */
    setDistance: function (distance) {
        this._distance = distance;
        this._needsUpdate = false;
    },

    setCamera: function (target) {
        this._camera = target;
        this._decomposeRotation();
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
        if (!opts.rotation) {
            toQuat = new Quaternion();
            var view = new Vector3();
            Vector3.negate(view, opts.z);
            toQuat.setAxes(view, opts.x, opts.y);
        }
        else {
            toQuat = opts.rotation;
        }

        // TODO
        // var zr = this.zr;
        // var obj = {
        //     p: 0
        // };

        // var target = this._camera;
        // var fromQuat = target.rotation.clone();
        // this._animating = true;
        // return this._addAnimator(
        //     zr.animation.animate(obj)
        //         .when(opts.time || 1000, {
        //             p: 1
        //         })
        //         .during(function () {
        //             Quaternion.slerp(
        //                 target.rotation, fromQuat, toQuat, obj.p
        //             );
        //             zr.refresh();
        //         })
        //         .done(function () {
        //             self._animating = false;
        //             self._decomposeRotation();
        //         })
        //         .start(opts.easing || 'Linear')
        // );
    },

    /**
     * Zoom to animation
     * @param {Object} opts
     * @param {number} opts.distance
     * @param {number} [opts.time=1000]
     * @param {number} [opts.easing='Linear']
     */
    zoomTo: function (opts) {
        var zr = this.zr;
        var distance = opts.distance;
        var self = this;

        distance = Math.max(Math.min(this.maxDistance, distance), this.minDistance);
        this._animating = true;
        return this._addAnimator(
            zr.animation.animate(this)
                .when(opts.time || 1000, {
                    _distance: distance
                })
                .during(function () {
                    self._setDistance(self._distance);
                    zr.refresh();
                })
                .done(function () {
                    self._animating = false;
                })
                .start(opts.easing || 'Linear')
        );
    },

    /**
     * Stop all animation
     */
    stopAllAnimation: function () {
        for (var i = 0; i < this._animators.length; i++) {
            this._animators[i].stop();
        }
        this._animators.length = 0;
        this._animating = false;
    },

    /**
     * Call update each frame
     * @param  {number} deltaTime Frame time
     */
    _update: function (deltaTime) {
        if (this._animating) {
            return;
        }

        if (this._rotating) {
            this._rotateY -= deltaTime * 1e-4;
            this._needsUpdate = true;
        }
        else if (this._rotateVelocity.len() > 0) {
            this._needsUpdate = true;
        }
        if (Math.abs(this._zoomSpeed) > 1e-3) {
            this._needsUpdate = true;
        }

        if (!this._needsUpdate) {
            return;
        }

        this._camera.rotation.identity();
        this._camera.update();

        this._updateDistance(deltaTime);

        if (this.mode === 'rotate') {
            this._updateRotate(deltaTime);
        }
        else if (this.mode === 'pan') {
            this._updatePan(deltaTime);
        }

        this.zr.refresh();
        this.trigger('update');
        this._needsUpdate = false;
    },

    _updateRotate: function (deltaTime) {


        var velocity = this._rotateVelocity;
        this._rotateY = (velocity.y + this._rotateY) % (Math.PI * 2);
        this._rotateX = (velocity.x + this._rotateX) % (Math.PI * 2);

        this._rotateX = Math.max(Math.min(this._rotateX, Math.PI / 2), -Math.PI / 2);


        this._camera.rotateAround(this.origin, Vector3.UP, -this._rotateY);
        var xAxis = this._camera.localTransform.x;
        this._camera.rotateAround(this.origin, xAxis, -this._rotateX);

        // Rotate speed damping
        this._vectorDamping(velocity, 0.8);

    },

    _updateDistance: function (deltaTime) {

        this._setDistance(this._distance + this._zoomSpeed);

        // Zoom speed damping
        this._zoomSpeed *= 0.8;
    },

    _setDistance: function (distance) {
        this._distance = Math.max(Math.min(distance, this.maxDistance), this.minDistance);
        var distance = this._distance;

        var camera = this._camera;

        var position = this.origin;
        camera.position.copy(position).scaleAndAdd(
            camera.worldTransform.z, distance
        );
    },

    _updatePan: function (deltaTime) {
        var velocity = this._panVelocity;

        // TODO
        // var target = this._camera;
        // var yAxis = target.worldTransform.y;
        // var xAxis = target.worldTransform.x;

        // // FIXME Assume origin is ZERO
        // var len = this.camera.position.len();
        // // PENDING
        // target.position
        //     .scaleAndAdd(xAxis, velocity.x * len / 400)
        //     .scaleAndAdd(yAxis, velocity.y * len / 400);

        // Pan damping
        this._vectorDamping(velocity, 0.8);

        if (velocity.len() > 0) {
            this._needsUpdate = true;
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
        if (!this._camera) {
            return;
        }

        // TODO
        // var euler = new Vector3();
        // // Z Rotate at last so it can be zero
        // euler.eulerFromQuat(
        //     this._camera.rotation.normalize(), 'ZXY'
        // );

        // this._rotateX = euler.x;
        // this._rotateY = euler.y;
    },

    _mouseDownHandler: function (e) {
        if (e.target) {
            // If mouseon some zrender element.
            return;
        }
        if (this._animating) {
            return;
        }
        this.zr.on('mousemove', this._mouseMoveHandler, this);
        this.zr.on('mouseup', this._mouseUpHandler, this);

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
        if (delta === 0) {
            return;
        }

        var distance = Math.min(
            this._distance - this.minDistance,
            this.maxDistance - this._distance
        );
        this._zoomSpeed = delta > 0 ? distance / 40 : -distance / 40;

        this._rotating = false;

        if (this.autoRotate && this.mode === 'rotate') {
            this._startCountingStill();
        }
    },

    _mouseUpHandler: function () {
        this.zr.off('mousemove', this._mouseMoveHandler, this);
        this.zr.off('mouseup', this._mouseUpHandler, this);
    },

    _addAnimator: function (animator) {
        var animators = this._animators;
        animators.push(animator);
        animator.done(function () {
            var idx = animators.indexOf(animator);
            if (idx >= 0) {
                animators.splice(idx, 1);
            }
        });
        return animator;
    }
});

/**
 * If auto rotate the target
 * @type {boolean}
 * @default false
 */
Object.defineProperty(OrbitControl.prototype, 'autoRotate', {
    get: function (val) {
        return this._autoRotate;
    },
    set: function (val) {
        this._autoRotate = val;
        this._rotating = val;
    }
});


module.exports = OrbitControl;