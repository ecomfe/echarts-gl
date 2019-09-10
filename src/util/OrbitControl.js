/**
 * Provide orbit control for 3D objects
 *
 * @module echarts-gl/util/OrbitControl
 * @author Yi Shen(http://github.com/pissang)
 */

// TODO Remove magic numbers on sensitivity
import Base from 'claygl/src/core/Base';
import Vector2 from 'claygl/src/math/Vector2';
import Vector3 from 'claygl/src/math/Vector3';
import Quaternion from 'claygl/src/math/Quaternion';
import retrieve from './retrieve';
var firstNotNull = retrieve.firstNotNull;


var MOUSE_BUTTON_KEY_MAP = {
    left: 0,
    middle: 1,
    right: 2
};

function convertToArray(val) {
    if (!(val instanceof Array)) {
        val = [val, val];
    }
    return val;
}

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
         * @type {clay.math.Vector3}
         */
        _center: new Vector3(),

        /**
         * Minimum distance to the center
         * Only available when camera is perspective.
         * @type {number}
         * @default 0.5
         */
        minDistance: 0.5,

        /**
         * Maximum distance to the center
         * Only available when camera is perspective.
         * @type {number}
         * @default 2
         */
        maxDistance: 1.5,

        /**
         * Only available when camera is orthographic
         */
        maxOrthographicSize: 300,

        /**
         * Only available when camera is orthographic
         */
        minOrthographicSize: 30,

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
        minBeta: -Infinity,
        /**
         * Maximum beta rotation
         */
        maxBeta: Infinity,

        /**
         * Start auto rotating after still for the given time
         */
        autoRotateAfterStill: 0,

        /**
         * Direction of autoRotate. cw or ccw when looking top down.
         */
        autoRotateDirection: 'cw',

        /**
         * Degree per second
         */
        autoRotateSpeed: 60,

        /**
         * @param {number}
         */
        damping: 0.8,

        /**
         * @param {number}
         */
        rotateSensitivity: 1,

        /**
         * @param {number}
         */
        zoomSensitivity: 1,

        /**
         * @param {number}
         */
        panSensitivity: 1,

        panMouseButton: 'middle',
        rotateMouseButton: 'left',

        /**
         * Pan or rotate
         * @private
         * @type {String}
         */
        _mode: 'rotate',

        /**
         * @private
         * @type {clay.Camera}
         */
        _camera: null,

        _needsUpdate: false,

        _rotating: false,

        // Rotation around yAxis in radian
        _phi: 0,
        // Rotation around xAxis in radian
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
    ['_mouseDownHandler', '_mouseWheelHandler', '_mouseMoveHandler', '_mouseUpHandler',
    '_pinchHandler', '_contextMenuHandler', '_update'].forEach(function (hdlName) {
        this[hdlName] = this[hdlName].bind(this);
    }, this);
}, {
    /**
     * Initialize.
     * Mouse event binding
     */
    init: function () {
        var zr = this.zr;

        if (zr) {
            zr.on('mousedown', this._mouseDownHandler);
            zr.on('globalout', this._mouseUpHandler);
            zr.on('mousewheel', this._mouseWheelHandler);
            zr.on('pinch', this._pinchHandler);

            zr.animation.on('frame', this._update);

            zr.dom.addEventListener('contextmenu', this._contextMenuHandler);
        }
    },

    /**
     * Dispose.
     * Mouse event unbinding
     */
    dispose: function () {
        var zr = this.zr;

        if (zr) {
            zr.off('mousedown', this._mouseDownHandler);
            zr.off('mousemove', this._mouseMoveHandler);
            zr.off('mouseup', this._mouseUpHandler);
            zr.off('mousewheel', this._mouseWheelHandler);
            zr.off('pinch', this._pinchHandler);
            zr.off('globalout', this._mouseUpHandler);
            zr.dom.removeEventListener('contextmenu', this._contextMenuHandler);

            zr.animation.off('frame', this._update);
        }
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
     * Get size of orthographic viewing volume
     * @return {number}
     */
    getOrthographicSize: function () {
        return this._orthoSize;
    },

    /**
     * Set size of orthographic viewing volume
     * @param {number} size
     */
    setOrthographicSize: function (size) {
        this._orthoSize = size;
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
     * Get control center
     * @return {Array.<number>}
     */
    getCenter: function () {
        return this._center.toArray();
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

    /**
     * Set control center
     * @param {Array.<number>} center
     */
    setCenter: function (centerArr) {
        this._center.setArray(centerArr);
    },

    /**
     * @param {module:echarts-gl/core/ViewGL} viewGL
     */
    setViewGL: function (viewGL) {
        this.viewGL = viewGL;
    },

    /**
     * @return {clay.Camera}
     */
    getCamera: function () {
        return this.viewGL.camera;
    },

    setFromViewControlModel: function (viewControlModel, extraOpts) {
        extraOpts = extraOpts || {};
        var baseDistance = extraOpts.baseDistance || 0;
        var baseOrthoSize = extraOpts.baseOrthoSize || 1;

        var projection = viewControlModel.get('projection');
        if (projection !== 'perspective' && projection !== 'orthographic' && projection !== 'isometric') {
            if (__DEV__) {
                console.error('Unkown projection type %s, use perspective projection instead.', projection);
            }
            projection = 'perspective';
        }
        this._projection = projection;
        this.viewGL.setProjection(projection);

        var targetDistance = viewControlModel.get('distance') + baseDistance;
        var targetOrthographicSize = viewControlModel.get('orthographicSize') + baseOrthoSize;

        [
            ['damping', 0.8],
            ['autoRotate', false],
            ['autoRotateAfterStill', 3],
            ['autoRotateDirection', 'cw'],
            ['autoRotateSpeed', 10],
            ['minDistance', 30],
            ['maxDistance', 400],
            ['minOrthographicSize', 30],
            ['maxOrthographicSize', 300],
            ['minAlpha', -90],
            ['maxAlpha', 90],
            ['minBeta', -Infinity],
            ['maxBeta', Infinity],
            ['rotateSensitivity', 1],
            ['zoomSensitivity', 1],
            ['panSensitivity', 1],
            ['panMouseButton', 'left'],
            ['rotateMouseButton', 'middle'],
        ].forEach(function (prop) {
            this[prop[0]] = firstNotNull(viewControlModel.get(prop[0]), prop[1]);
        }, this);

        this.minDistance += baseDistance;
        this.maxDistance += baseDistance;
        this.minOrthographicSize += baseOrthoSize,
        this.maxOrthographicSize += baseOrthoSize;

        var ecModel = viewControlModel.ecModel;

        var animationOpts = {};
        ['animation', 'animationDurationUpdate', 'animationEasingUpdate'].forEach(function (key) {
            animationOpts[key] = firstNotNull(
                viewControlModel.get(key), ecModel && ecModel.get(key)
            );
        });

        var alpha = firstNotNull(extraOpts.alpha, viewControlModel.get('alpha')) || 0;
        var beta = firstNotNull(extraOpts.beta, viewControlModel.get('beta')) || 0;
        var center = firstNotNull(extraOpts.center, viewControlModel.get('center')) || [0, 0, 0];
        if (animationOpts.animation && animationOpts.animationDurationUpdate > 0 && this._notFirst) {
            this.animateTo({
                alpha: alpha,
                beta: beta,
                center: center,
                distance: targetDistance,
                orthographicSize: targetOrthographicSize,
                easing: animationOpts.animationEasingUpdate,
                duration: animationOpts.animationDurationUpdate
            });
        }
        else {
            this.setDistance(targetDistance);
            this.setAlpha(alpha);
            this.setBeta(beta);
            this.setCenter(center);
            this.setOrthographicSize(targetOrthographicSize);
        }

        this._notFirst = true;

        this._validateProperties();
    },

    _validateProperties: function () {
        if (__DEV__) {
            if (MOUSE_BUTTON_KEY_MAP[this.panMouseButton] == null) {
                console.error('Unkown panMouseButton %s. It should be left|middle|right', this.panMouseButton);
            }
            if (MOUSE_BUTTON_KEY_MAP[this.rotateMouseButton] == null) {
                console.error('Unkown rotateMouseButton %s. It should be left|middle|right', this.rotateMouseButton);
            }
            if (this.autoRotateDirection !== 'cw' && this.autoRotateDirection !== 'ccw') {
                console.error('Unkown autoRotateDirection %s. It should be cw|ccw', this.autoRotateDirection);
            }
        }
    },

    /**
     * @param {Object} opts
     * @param {number} opts.distance
     * @param {number} opts.alpha
     * @param {number} opts.beta
     * @param {number} opts.orthographicSize
     * @param {number} [opts.duration=1000]
     * @param {number} [opts.easing='linear']
     */
    animateTo: function (opts) {
        var zr = this.zr;
        var self = this;

        var obj = {};
        var target = {};

        if (opts.distance != null) {
            obj.distance = this.getDistance();
            target.distance = opts.distance;
        }
        if (opts.orthographicSize != null) {
            obj.orthographicSize = this.getOrthographicSize();
            target.orthographicSize = opts.orthographicSize;
        }
        if (opts.alpha != null) {
            obj.alpha = this.getAlpha();
            target.alpha = opts.alpha;
        }
        if (opts.beta != null) {
            obj.beta = this.getBeta();
            target.beta = opts.beta;
        }
        if (opts.center != null) {
            obj.center = this.getCenter();
            target.center = opts.center;
        }

        return this._addAnimator(
            zr.animation.animate(obj)
                .when(opts.duration || 1000, target)
                .during(function () {
                    if (obj.alpha != null) {
                        self.setAlpha(obj.alpha);
                    }
                    if (obj.beta != null) {
                        self.setBeta(obj.beta);
                    }
                    if (obj.distance != null) {
                        self.setDistance(obj.distance);
                    }
                    if (obj.center != null) {
                        self.setCenter(obj.center);
                    }
                    if (obj.orthographicSize != null) {
                        self.setOrthographicSize(obj.orthographicSize);
                    }
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

    update: function () {
        this._needsUpdate = true;
        this._update(20);
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
            var radian = (this.autoRotateDirection === 'cw' ? 1 : -1)
                 * this.autoRotateSpeed / 180 * Math.PI;
            this._phi -= radian * deltaTime / 1000;
            this._needsUpdate = true;
        }
        else if (this._rotateVelocity.len() > 0) {
            this._needsUpdate = true;
        }

        if (Math.abs(this._zoomSpeed) > 0.1 || this._panVelocity.len() > 0) {
            this._needsUpdate = true;
        }

        if (!this._needsUpdate) {
            return;
        }

        deltaTime = Math.min(deltaTime, 50);

        this._updateDistanceOrSize(deltaTime);

        this._updatePan(deltaTime);

        this._updateRotate(deltaTime);

        this._updateTransform();

        this.getCamera().update();

        this.zr && this.zr.refresh();

        this.trigger('update');

        this._needsUpdate = false;
    },

    _updateRotate: function (deltaTime) {
        var velocity = this._rotateVelocity;
        this._phi = velocity.y * deltaTime / 20 + this._phi;
        this._theta = velocity.x * deltaTime / 20 + this._theta;

        this.setAlpha(this.getAlpha());
        this.setBeta(this.getBeta());

        this._vectorDamping(velocity, Math.pow(this.damping, deltaTime / 16));
    },

    _updateDistanceOrSize: function (deltaTime) {
        if (this._projection === 'perspective') {
            this._setDistance(this._distance + this._zoomSpeed * deltaTime / 20);
        }
        else {
            this._setOrthoSize(this._orthoSize + this._zoomSpeed * deltaTime / 20);
        }

        this._zoomSpeed *= Math.pow(this.damping, deltaTime / 16);
    },


    _setDistance: function (distance) {
        this._distance = Math.max(Math.min(distance, this.maxDistance), this.minDistance);
    },

    _setOrthoSize: function (size) {
        this._orthoSize = Math.max(Math.min(size, this.maxOrthographicSize), this.minOrthographicSize);
        var camera = this.getCamera();
        var cameraHeight = this._orthoSize;
        var cameraWidth = cameraHeight / this.viewGL.viewport.height * this.viewGL.viewport.width;
        camera.left = -cameraWidth / 2;
        camera.right = cameraWidth / 2;
        camera.top = cameraHeight / 2;
        camera.bottom = -cameraHeight / 2;
    },

    _updatePan: function (deltaTime) {

        var velocity = this._panVelocity;
        var len = this._distance;

        var target = this.getCamera();
        var yAxis = target.worldTransform.y;
        var xAxis = target.worldTransform.x;

        // PENDING
        this._center
            .scaleAndAdd(xAxis, -velocity.x * len / 200)
            .scaleAndAdd(yAxis, -velocity.y * len / 200);

        this._vectorDamping(velocity, 0);
    },

    _updateTransform: function () {
        var camera = this.getCamera();

        var dir = new Vector3();
        var theta = this._theta + Math.PI / 2;
        var phi = this._phi + Math.PI / 2;
        var r = Math.sin(theta);

        dir.x = r * Math.cos(phi);
        dir.y = -Math.cos(theta);
        dir.z = r * Math.sin(phi);

        camera.position.copy(this._center).scaleAndAdd(dir, this._distance);
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
        if (!this.getCamera()) {
            return;
        }

        this.getCamera().updateWorldTransform();

        var forward = this.getCamera().worldTransform.z;
        var alpha = Math.asin(forward.y);
        var beta = Math.atan2(forward.x, forward.z);

        this._theta = alpha;
        this._phi = -beta;

        this.setBeta(this.getBeta());
        this.setAlpha(this.getAlpha());

        // Is perspective
        if (this.getCamera().aspect) {
            this._setDistance(this.getCamera().position.dist(this._center));
        }
        else {
            this._setOrthoSize(this.getCamera().top - this.getCamera().bottom);
        }
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
        var y = e.offsetY;
        if (this.viewGL && !this.viewGL.containPoint(x, y)) {
            return;
        }

        this.zr.on('mousemove', this._mouseMoveHandler);
        this.zr.on('mouseup', this._mouseUpHandler);

        if (e.event.targetTouches) {
            if (e.event.targetTouches.length === 1) {
                this._mode = 'rotate';
            }
        }
        else {
            if (e.event.button === MOUSE_BUTTON_KEY_MAP[this.rotateMouseButton]) {
                this._mode = 'rotate';
            }
            else if (e.event.button === MOUSE_BUTTON_KEY_MAP[this.panMouseButton]) {
                this._mode = 'pan';
            }
            else {
                this._mode = '';
            }
        }

        // Reset rotate velocity
        this._rotateVelocity.set(0, 0);
        this._rotating = false;
        if (this.autoRotate) {
            this._startCountingStill();
        }

        this._mouseX = e.offsetX;
        this._mouseY = e.offsetY;
    },

    _mouseMoveHandler: function (e) {
        if (e.target && e.target.__isGLToZRProxy) {
            return;
        }

        if (this._isAnimating()) {
            return;
        }

        var panSensitivity = convertToArray(this.panSensitivity);
        var rotateSensitivity = convertToArray(this.rotateSensitivity);

        if (this._mode === 'rotate') {
            this._rotateVelocity.y = (e.offsetX - this._mouseX) / this.zr.getHeight() * 2 * rotateSensitivity[0];
            this._rotateVelocity.x = (e.offsetY - this._mouseY) / this.zr.getWidth() * 2 * rotateSensitivity[1];
        }
        else if (this._mode === 'pan') {
            this._panVelocity.x = (e.offsetX - this._mouseX) / this.zr.getWidth() * panSensitivity[0] * 400;
            this._panVelocity.y = (-e.offsetY + this._mouseY) / this.zr.getHeight() * panSensitivity[1] * 400;
        }


        this._mouseX = e.offsetX;
        this._mouseY = e.offsetY;

        e.event.preventDefault();
    },

    _mouseWheelHandler: function (e) {
        if (this._isAnimating()) {
            return;
        }
        var delta = e.event.wheelDelta // Webkit
                || -e.event.detail; // Firefox
        this._zoomHandler(e, delta);
    },

    _pinchHandler: function (e) {
        if (this._isAnimating()) {
            return;
        }
        this._zoomHandler(e, e.pinchScale > 1 ? 1 : -1);
        // Not rotate when pinch
        this._mode = '';
    },

    _zoomHandler: function (e, delta) {
        if (delta === 0) {
            return;
        }

        var x = e.offsetX;
        var y = e.offsetY;
        if (this.viewGL && !this.viewGL.containPoint(x, y)) {
            return;
        }

        var speed;
        if (this._projection === 'perspective') {
            speed = Math.max(Math.max(Math.min(
                this._distance - this.minDistance,
                this.maxDistance - this._distance
            )) / 20, 0.5);
        }
        else {
            speed = Math.max(Math.max(Math.min(
                this._orthoSize - this.minOrthographicSize,
                this.maxOrthographicSize - this._orthoSize
            )) / 20, 0.5);
        }
        this._zoomSpeed = (delta > 0 ? -1 : 1) * speed * this.zoomSensitivity;

        this._rotating = false;

        if (this.autoRotate && this._mode === 'rotate') {
            this._startCountingStill();
        }

        e.event.preventDefault();
    },

    _mouseUpHandler: function () {
        this.zr.off('mousemove', this._mouseMoveHandler);
        this.zr.off('mouseup', this._mouseUpHandler);
    },

    _isRightMouseButtonUsed: function () {
        return this.rotateMouseButton === 'right'
            || this.panMouseButton === 'right';
    },

    _contextMenuHandler: function (e) {
        if (this._isRightMouseButtonUsed()) {
            e.preventDefault();
        }
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


export default OrbitControl;