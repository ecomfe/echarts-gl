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
var retrieve = require('./retrieve');

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
         * @type {module:echarts-gl/core/ViewGL}
         */
        viewGL: null,

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
         * Minimum alpha rotation
         */
        minAlpha: -90,

        /**
         * Maximum alpha rotation
         */
        maxAlpha: 90,

        /**
         * Minimum beta rotation
         */
        minBeta: -180,
        /**
         * Maximum beta rotation
         */
        maxBeta: 180,

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

        // Rotation around yAxis
        _phi: 0,
        // Rotation around xAxis
        _theta: 0,

        _mouseX: 0,
        _mouseY: 0,

        _rotateVelocity: new Vector2(),

        _panVelocity: new Vector2(),

        _distance: 500,

        _zoomSpeed: 0,

        _stillTimeout: 0,

        _animators: []
    };
}, function () {
    // Each OrbitControl has it's own handler
    this._mouseDownHandler = this._mouseDownHandler.bind(this);
    this._mouseWheelHandler = this._mouseWheelHandler.bind(this);
    this._mouseMoveHandler = this._mouseMoveHandler.bind(this);
    this._mouseUpHandler = this._mouseUpHandler.bind(this);
    this._update = this._update.bind(this);
}, {
    /**
     * Initialize.
     * Mouse event binding
     */
    init: function () {
        var zr = this.zr;

        zr.on('mousedown', this._mouseDownHandler);
        zr.on('mousewheel', this._mouseWheelHandler);

        this._decomposeTransform();

        zr.animation.on('frame', this._update);
    },

    /**
     * Dispose.
     * Mouse event unbinding
     */
    dispose: function () {
        var zr = this.zr;
        zr.off('mousedown', this._mouseDownHandler);
        zr.off('mousemove', this._mouseMoveHandler);
        zr.off('mouseup', this._mouseUpHandler);
        zr.off('mousewheel', this._mouseWheelHandler);

        zr.animation.off('frame', this._update);
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
        this._needsUpdate = true;
    },

    /**
     * Get alpha rotation
     * Alpha angle for top-down rotation. Positive to rotate to top.
     *
     * Which means camera rotation around x axis.
     */
    getAlpha: function () {
        return this._theta / Math.PI * 180;
    },

    /**
     * Get beta rotation
     * Beta angle for left-right rotation. Positive to rotate to right.
     *
     * Which means camera rotation around y axis.
     */
    getBeta: function () {
        return -this._phi / Math.PI * 180;
    },

    /**
     * Set alpha rotation angle
     * @param {number} alpha
     */
    setAlpha: function (alpha) {
        alpha = Math.max(Math.min(this.maxAlpha, alpha), this.minAlpha);

        this._theta = alpha / 180 * Math.PI;
        this._needsUpdate = true;
    },

    /**
     * Set beta rotation angle
     * @param {number} beta
     */
    setBeta: function (beta) {
        beta = Math.max(Math.min(this.maxBeta, beta), this.minBeta);

        this._phi = -beta / 180 * Math.PI;
        this._needsUpdate = true;
    },

    setCamera: function (target) {
        this._camera = target;
        this._decomposeTransform();

        this._needsUpdate = true;
    },

    setViewGL: function (viewGL) {
        this.viewGL = viewGL;
    },

    getCamera: function () {
        return this._camera;
    },

    setFromViewControlModel: function (viewControlModel, baseDistance) {
        this.autoRotate = viewControlModel.get('autoRotate');
        this.autoRotateAfterStill = viewControlModel.get('autoRotateAfterStill');

        this.minDistance = viewControlModel.get('minDistance') + baseDistance;
        this.maxDistance = viewControlModel.get('maxDistance') + baseDistance;

        var targetDistance = viewControlModel.get('distance') + baseDistance;
        if (this._distance !== targetDistance) {
            this.zoomTo({
                distance: targetDistance
            });
            // this.setDistance(targetDistance);
        }

        this.minAlpha = retrieve.firstNotNull(viewControlModel.get('minAlpha'), -90);
        this.maxAlpha = retrieve.firstNotNull(viewControlModel.get('maxAlpha'), 90);
        this.minBeta = retrieve.firstNotNull(viewControlModel.get('minBeta'), -180);
        this.maxBeta = retrieve.firstNotNull(viewControlModel.get('maxBeta'), 180);

        this.setAlpha(viewControlModel.get('alpha') || 0);
        this.setBeta(viewControlModel.get('beta') || 0);
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
     * @param {number} [opts.easing='linear']
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
        // ).start(opts.easing || 'linear')
    },

    /**
     * Zoom to animation
     * @param {Object} opts
     * @param {number} opts.distance
     * @param {number} [opts.time=1000]
     * @param {number} [opts.easing='linear']
     */
    zoomTo: function (opts) {
        var zr = this.zr;
        var distance = opts.distance;
        var self = this;

        distance = Math.max(Math.min(this.maxDistance, distance), this.minDistance);
        return this._addAnimator(
            zr.animation.animate(this)
                .when(opts.time || 1000, {
                    _distance: distance
                })
                .during(function () {
                    self._needsUpdate = true;
                })
        ).start(opts.easing || 'linear');
    },

    /**
     * Stop all animation
     */
    stopAllAnimation: function () {
        for (var i = 0; i < this._animators.length; i++) {
            this._animators[i].stop();
        }
        this._animators.length = 0;
    },

    _isAnimating: function () {
        return this._animators.length > 0;
    },
    /**
     * Call update each frame
     * @param  {number} deltaTime Frame time
     */
    _update: function (deltaTime) {

        if (this._rotating) {
            this._phi -= deltaTime * 1e-4;
            this._needsUpdate = true;
        }
        else if (this._rotateVelocity.len() > 0) {
            this._needsUpdate = true;
        }
        if (Math.abs(this._zoomSpeed) > 0.1) {
            this._needsUpdate = true;
        }
        if (this._panVelocity.len() > 0) {
            this._needsUpdate = true;
        }

        if (!this._needsUpdate) {
            return;
        }

        // Fixed deltaTime
        this._updateDistance(Math.min(deltaTime, 30));
        this._updateRotate(Math.min(deltaTime, 30));
        this._updatePan(Math.min(deltaTime, 30));

        this._camera.update();

        this._updateTransform();

        this.zr.refresh();
        this.trigger('update');

        this._needsUpdate = false;
    },

    _updateRotate: function (deltaTime) {
        var velocity = this._rotateVelocity;
        this._phi = velocity.y * deltaTime / 20 + this._phi;
        this._theta = velocity.x * deltaTime / 20 + this._theta;

        this.setAlpha(this.getAlpha());
        this.setBeta(this.getBeta());

        this._vectorDamping(velocity, 0.9);
    },

    _updateDistance: function (deltaTime) {
        this._setDistance(this._distance + this._zoomSpeed * deltaTime / 20);
        this._zoomSpeed *= 0.8;
    },

    _setDistance: function (distance) {
        this._distance = Math.max(Math.min(distance, this.maxDistance), this.minDistance);
    },

    _updatePan: function (deltaTime) {

        var velocity = this._rotateVelocity;
        var len = this._distance;

        var target = this._camera;
        var yAxis = target.worldTransform.y;
        var xAxis = target.worldTransform.x;

        // PENDING
        this.origin
            .scaleAndAdd(xAxis, velocity.x * len / 400)
            .scaleAndAdd(yAxis, velocity.y * len / 400);

        this._vectorDamping(velocity, 0.8);
    },

    _updateTransform: function () {
        var camera = this._camera;

        var dir = new Vector3();
        var theta = this._theta + Math.PI / 2;
        var phi = this._phi + Math.PI / 2;
        var r = Math.sin(theta);

        dir.x = r * Math.cos(phi);
        dir.y = -Math.cos(theta);
        dir.z = r * Math.sin(phi);

        camera.position.copy(this.origin).scaleAndAdd(dir, this._distance);
        camera.rotation.identity()
            // First around y, then around x
            .rotateY(-this._phi)
            .rotateX(-this._theta);
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

    _decomposeTransform: function () {
    //     if (!this._camera) {
    //         return;
    //     }

    //     // TODO
    //     var euler = new Vector3();
    //     // Z Rotate at last so it can be zero
    //     euler.eulerFromQuat(
    //         this._camera.rotation.normalize(), 'ZXY'
    //     );

    //     this._theta = euler.x;
    //     this._phi = euler.y;

    //     this._theta = Math.max(Math.min(this._theta, Math.PI / 2), -Math.PI / 2);

    //     this._setDistance(this._camera.position.dist(this.origin));
    },

    _mouseDownHandler: function (e) {
        if (e.target) {
            // If mouseon some zrender element.
            return;
        }
        if (this._isAnimating()) {
            return;
        }

        var x = e.offsetX;
        // Flip Y.
        var y = this.zr.getHeight() - e.offsetY;
        if (this.viewGL && !this.viewGL.containPoint(x, y)) {
            return;
        }

        this.zr.on('mousemove', this._mouseMoveHandler);
        this.zr.on('mouseup', this._mouseUpHandler);

        e = e.event;

        if (this.mode === 'rotate') {
            // Reset rotate velocity
            this._rotateVelocity.set(0, 0);

            this._rotating = false;

            if (this.autoRotate) {
                this._startCountingStill();
            }
        }

        this._mouseX = e.offsetX;
        this._mouseY = e.offsetY;
    },

    _mouseMoveHandler: function (e) {
        if (this._isAnimating()) {
            return;
        }
        e = e.event;

        if (this.mode === 'rotate') {
            this._rotateVelocity.y = (e.offsetX - this._mouseX) / 500;
            this._rotateVelocity.x = (e.offsetY - this._mouseY) / 500;
        }
        else if (this.mode === 'pan') {
            this._panVelocity.x = e.offsetX - this._mouseX;
            this._panVelocity.y = -e.offsetY + this._mouseY;
        }

        this._mouseX = e.offsetX;
        this._mouseY = e.offsetY;
    },

    _mouseWheelHandler: function (e) {
        if (this._isAnimating()) {
            return;
        }
        e = e.event;
        var delta = e.wheelDelta // Webkit
                || -e.detail; // Firefox
        if (delta === 0) {
            return;
        }

        var distance = Math.max(Math.min(
            this._distance - this.minDistance,
            this.maxDistance - this._distance
        ));
        this._zoomSpeed = (delta > 0 ? 1 : -1) * Math.max(distance / 40, 0.5);

        this._rotating = false;

        if (this.autoRotate && this.mode === 'rotate') {
            this._startCountingStill();
        }
    },

    _mouseUpHandler: function () {
        this.zr.off('mousemove', this._mouseMoveHandler);
        this.zr.off('mouseup', this._mouseUpHandler);
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