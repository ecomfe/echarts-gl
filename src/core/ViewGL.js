/*
 * @module echarts-gl/core/ViewGL
 * @author Yi Shen(http://github.com/pissang)
 */

var Scene = require('qtek/lib/Scene');
var ShadowMapPass = require('qtek/lib/prePass/ShadowMap');
var PerspectiveCamera = require('qtek/lib/camera/Perspective');
var OrthographicCamera = require('qtek/lib/camera/Orthographic');
var Matrix4 = require('qtek/lib/math/Matrix4');
var Vector3 = require('qtek/lib/math/Vector3');

var EffectCompositor = require('../effect/EffectCompositor');
var TemporalSuperSampling = require('../effect/TemporalSuperSampling');

var requestAnimationFrame = require('zrender/lib/animation/requestAnimationFrame');

var accumulatingId = 1;
/**
 * @constructor
 * @alias module:echarts-gl/core/ViewGL
 * @param {string} [cameraType='perspective']
 */
function ViewGL(cameraType) {

    cameraType = cameraType || 'perspective';

    /**
     * @type {module:echarts-gl/core/LayerGL}
     */
    this.layer = null;
    /**
     * @type {qtek.Scene}
     */
    this.scene = new Scene();

    this.viewport = {
        x: 0, y: 0, width: 0, height: 0
    };

    this.setCameraType(cameraType);

    this._compositor = new EffectCompositor();

    this._temporalSS = new TemporalSuperSampling();

    this._shadowMapPass = new ShadowMapPass();

    /**
     * Current accumulating id.
     */
    this._accumulatingId = 0;

    this.scene.on('beforerender', function (renderer, scene, camera) {
        if (this._enableTemporalSS) {
            this._temporalSS.jitterProjection(renderer, camera);
        }
    }, this);
}

/**
 * Set camera type of group
 * @param {string} cameraType 'perspective' | 'orthographic'
 */
ViewGL.prototype.setCameraType = function (cameraType) {
    var oldCamera = this.camera;
    oldCamera && oldCamera.update();
    if (cameraType === 'perspective') {
        if (!(this.camera instanceof PerspectiveCamera)) {
            this.camera = new PerspectiveCamera();
            if (oldCamera) {
                this.camera.setLocalTransform(oldCamera.localTransform);
            }
        }
    }
    else {
        if (!(this.camera instanceof OrthographicCamera)) {
            this.camera = new OrthographicCamera();
            if (oldCamera) {
                this.camera.setLocalTransform(oldCamera.localTransform);
            }
        }
    }
};

/**
 * Set viewport of group
 * @param {number} x Viewport left bottom x
 * @param {number} y Viewport left bottom y
 * @param {number} width Viewport height
 * @param {number} height Viewport height
 * @param {number} [dpr=1]
 */
ViewGL.prototype.setViewport = function (x, y, width, height, dpr) {
    if (this.camera instanceof PerspectiveCamera) {
        this.camera.aspect = width / height;
    }
    dpr = dpr || 1;

    this.viewport.x = x;
    this.viewport.y = y;
    this.viewport.width = width;
    this.viewport.height = height;
    this.viewport.devicePixelRatio = dpr;

    // Source and output of compositor use high dpr texture.
    // But the intermediate texture of bloom, dof effects use fixed 1.0 dpr
    this._compositor.resize(width * dpr, height * dpr);
    this._temporalSS.resize(width * dpr, height * dpr);
};

/**
 * If contain screen point x, y
 */
ViewGL.prototype.containPoint = function (x, y) {
    var viewport = this.viewport;
    return x >= viewport.x && y >= viewport.y
        && x <= viewport.x + viewport.width && y <= viewport.y + viewport.height;
};

ViewGL.prototype.render = function (renderer) {
    this._stopAccumulating(renderer);

    this._doRender(renderer, 0);

    if (this._enableTemporalSS) {
        this._startAccumulating(renderer);
    }
};

ViewGL.prototype._stopAccumulating = function () {
    this._accumulatingId = 0;
    this._temporalSS.resetFrame();
    clearTimeout(this._accumulatingTimeout);
};

ViewGL.prototype._startAccumulating = function (renderer) {
    var self = this;

    clearTimeout(this._accumulatingTimeout);

    this._temporalSS.resetFrame();

    this._accumulatingId = accumulatingId++;

    function accumulate(id) {
        if (!self._accumulatingId || id !== self._accumulatingId) {
            return;
        }
        if (!self._temporalSS.isFinished()) {
            self._doRender(renderer, self._temporalSS.getFrame());
            requestAnimationFrame(function () {
                accumulate(id);
            });
        }
    }

    this._accumulatingTimeout = setTimeout(function () {
        accumulate(self._accumulatingId);
    }, 50);
};

ViewGL.prototype._doRender = function (renderer, accumFrame) {

    var scene = this.scene;
    var camera = this.camera;

    var v3 = new Vector3();
    var invWorldTransform = new Matrix4();
    accumFrame = accumFrame || 0;
    // Sort transparent object.
    for (var i = 0; i < scene.transparentQueue.length; i++) {
        var renderable = scene.transparentQueue[i];
        var geometry = renderable.geometry;
        Matrix4.invert(invWorldTransform, renderable.worldTransform);
        v3.transformMat4(camera.worldTransform);
        v3.transformMat4(invWorldTransform);
        if (geometry.needsSortFaces && geometry.needsSortFaces()) {
            geometry.doSortFaces(v3, accumFrame);
        }
    }

    this._shadowMapPass.render(renderer, scene, camera);
    // Shadowmap will set clearColor.
    renderer.gl.clearColor(0.0, 0.0, 0.0, 0.0);

    if (this._enablePostEffect) {
        var frameBuffer = this._compositor.getSourceFrameBuffer();
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        renderer.render(scene, camera);
        frameBuffer.unbind(renderer);
        if (this._enableSSAO) {
            this._compositor.updateSSAO(renderer, camera, this._temporalSS.getFrame());
            this._compositor.blendSSAO(renderer, this._compositor.getSourceTexture());
        }

        if (this._enableTemporalSS && this._accumulatingId > 0) {
            this._compositor.composite(renderer, this._temporalSS.getSourceFrameBuffer());
            renderer.setViewport(this.viewport);
            this._temporalSS.render(renderer);
        }
        else {
            renderer.setViewport(this.viewport);
            this._compositor.composite(renderer);
        }
    }
    else {
        if (this._enableTemporalSS && this._accumulatingId > 0) {
            var frameBuffer = this._temporalSS.getSourceFrameBuffer();
            frameBuffer.bind(renderer);
            renderer.saveClear();
            renderer.clearBit = renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT;
            renderer.render(scene, camera);
            renderer.restoreClear();
            frameBuffer.unbind(renderer);

            renderer.setViewport(this.viewport);
            this._temporalSS.render(renderer);
        }
        else {
            renderer.setViewport(this.viewport);
            renderer.render(scene, camera);
        }
    }

    // this._shadowMapPass.renderDebug(renderer);
}

ViewGL.prototype.dispose = function (renderer) {
    this._compositor.dispose(renderer.gl);
    this._temporalSS.dispose(renderer.gl);
    this._shadowMapPass.dispose(renderer);
};
/**
 * @param {module:echarts/Model} Post effect model
 */
ViewGL.prototype.setPostEffect = function (postEffectModel) {
    var compositor = this._compositor;
    this._enablePostEffect = postEffectModel.get('enable');
    var bloomModel = postEffectModel.getModel('bloom');
    var dofModel = postEffectModel.getModel('depthOfField');
    var ssaoModel = postEffectModel.getModel('SSAO');
    var fxaaModel = postEffectModel.getModel('FXAA');
    fxaaModel.get('enable') ? compositor.enableFXAA() : compositor.disableFXAA();
    bloomModel.get('enable') ? compositor.enableBloom() : compositor.disableBloom();
    dofModel.get('enable') ? compositor.enableDOF() : compositor.disableDOF();

    this._enableSSAO = ssaoModel.get('enable');
    this._enableSSAO ? compositor.enableSSAO() : compositor.disableSSAO();

    compositor.setBloomIntensity(bloomModel.get('intensity'));
    compositor.setSSAORadius(ssaoModel.get('radius'));
    compositor.setSSAOQuality(ssaoModel.get('quality'));
    compositor.setSSAOIntensity(ssaoModel.get('intensity'));
};

ViewGL.prototype.setTemporalSuperSampling = function (temporalSuperSamplingModel) {
    this._enableTemporalSS = temporalSuperSamplingModel.get('enable');
};

ViewGL.prototype.isLinearSpace = function () {
    return this._enablePostEffect;
};

// Proxies
ViewGL.prototype.add = function (node3D) {
    this.scene.add(node3D);
};
ViewGL.prototype.remove = function (node3D) {
    this.scene.remove(node3D);
};
ViewGL.prototype.removeAll = function (node3D) {
    this.scene.removeAll(node3D);
};

module.exports = ViewGL;