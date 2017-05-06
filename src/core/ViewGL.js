/*
 * @module echarts-gl/core/ViewGL
 * @author Yi Shen(http://github.com/pissang)
 */

var echarts = require('echarts/lib/echarts');

var Scene = require('qtek/lib/Scene');
var ShadowMapPass = require('qtek/lib/prePass/ShadowMap');
var PerspectiveCamera = require('qtek/lib/camera/Perspective');
var OrthographicCamera = require('qtek/lib/camera/Orthographic');
var Matrix4 = require('qtek/lib/math/Matrix4');
var Vector3 = require('qtek/lib/math/Vector3');
var Vector2 = require('qtek/lib/math/Vector2');

var notifier = require('qtek/lib/core/mixin/notifier');

var EffectCompositor = require('../effect/EffectCompositor');
var TemporalSuperSampling = require('../effect/TemporalSuperSampling');
var halton = require('../effect/halton');

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

    var pcfKernels = [];
    var off = 0;
    for (var i = 0; i < 30; i++) {
        var pcfKernel = [];
        for (var k = 0; k < 6; k++) {
            pcfKernel.push(halton(off, 2) * 4.0 - 2.0);
            pcfKernel.push(halton(off, 3) * 4.0 - 2.0);
            off++;
        }
        pcfKernels.push(pcfKernel);
    }
    this._pcfKernels = pcfKernels;

    this.scene.on('beforerender', function (renderer, scene, camera) {
        if (this.needsTemporalSS()) {
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
 * @param {number} x offsetX
 * @param {number} y offsetY
 * @return {boolean}
 */
ViewGL.prototype.containPoint = function (x, y) {
    var viewport = this.viewport;
    var height = this.layer.renderer.getHeight();
    // Flip y;
    y = height - y;
    return x >= viewport.x && y >= viewport.y
        && x <= viewport.x + viewport.width && y <= viewport.y + viewport.height;
};

/**
 * Cast a ray
 * @param {number} x offsetX
 * @param {number} y offsetY
 * @param {qtek.math.Ray} out
 * @return {qtek.math.Ray}
 */
var ndc = new Vector2();
ViewGL.prototype.castRay = function (x, y, out) {
    var renderer = this.layer.renderer;

    var oldViewport = renderer.viewport;
    renderer.viewport = this.viewport;
    renderer.screenToNDC(x, y, ndc);
    this.camera.castRay(ndc, out);
    renderer.viewport = oldViewport;

    return out;
};

/**
 * Prepare and update scene before render
 */
ViewGL.prototype.prepareRender = function () {
    this.scene.update();
    this.camera.update();

    this._needsSortProgressively = false;
    // If has any transparent mesh needs sort triangles progressively.
    for (var i = 0; i < this.scene.transparentQueue.length; i++) {
        var renderable = this.scene.transparentQueue[i];
        var geometry = renderable.geometry;
        if (geometry.needsSortVerticesProgressively && geometry.needsSortVerticesProgressively()) {
            this._needsSortProgressively = true;
        }
        if (geometry.needsSortTrianglesProgressively && geometry.needsSortTrianglesProgressively()) {
            this._needsSortProgressively = true;
        }
    }

    this._frame = 0;
    this._temporalSS.resetFrame();
};

ViewGL.prototype.render = function (renderer, accumulating) {
    this._doRender(renderer, accumulating, this._frame);
    this._frame++;
};

ViewGL.prototype.needsAccumulate = function () {
    return this.needsTemporalSS() || this._needsSortProgressively;
};

ViewGL.prototype.needsTemporalSS = function () {
    var enableTemporalSS = this._enableTemporalSS;
    if (enableTemporalSS == 'auto') {
        enableTemporalSS = this._enablePostEffect;
    }
    return enableTemporalSS;
};

ViewGL.prototype.hasDOF = function () {
    return this._enableDOF;
};

ViewGL.prototype.isAccumulateFinished = function () {
    return this.needsTemporalSS() ? this._temporalSS.isFinished()
        : (this._frame > 30);
};

ViewGL.prototype._doRender = function (renderer, accumulating, accumFrame) {

    var scene = this.scene;
    var camera = this.camera;

    var v3 = new Vector3();
    var invWorldTransform = new Matrix4();
    var cameraWorldPosition = camera.getWorldPosition();
    accumFrame = accumFrame || 0;
    // Sort transparent object.
    for (var i = 0; i < scene.transparentQueue.length; i++) {
        var renderable = scene.transparentQueue[i];
        var geometry = renderable.geometry;
        Matrix4.invert(invWorldTransform, renderable.worldTransform);
        Vector3.transformMat4(v3, cameraWorldPosition, invWorldTransform);
        if (geometry.needsSortTriangles && geometry.needsSortTriangles()) {
            geometry.doSortTriangles(v3, accumFrame);
        }
        if (geometry.needsSortVertices && geometry.needsSortVertices()) {
            geometry.doSortVertices(v3, accumFrame);
        }
    }

    if (!accumulating) {
        this._shadowMapPass.kernelPCF = this._pcfKernels[0];
        // Not render shadowmap pass in accumulating frame.
        this._shadowMapPass.render(renderer, scene, camera, true);

        if (this._enablePostEffect
            && this._enableSSAO
        ) {
            this._compositor.updateNormal(renderer, scene, camera, this._temporalSS.getFrame());
        }
    }

    this._updateShadowPCFKernel(accumFrame);

    // Shadowmap will set clearColor.
    renderer.gl.clearColor(0.0, 0.0, 0.0, 0.0);

    if (this._enablePostEffect) {
        if (this._enableSSAO) {
            this._compositor.updateSSAO(renderer, scene, camera, this._temporalSS.getFrame());
        }

        var frameBuffer = this._compositor.getSourceFrameBuffer();
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        renderer.render(scene, camera, true);
        frameBuffer.unbind(renderer);
        if (this._enableSSAO) {
            this._compositor.blendSSAO(renderer, this._compositor.getSourceTexture());
        }

        if (this.needsTemporalSS() && accumulating) {
            this._compositor.composite(renderer, camera, this._temporalSS.getSourceFrameBuffer(), this._temporalSS.getFrame());
            renderer.setViewport(this.viewport);
            this._temporalSS.render(renderer);
        }
        else {
            renderer.setViewport(this.viewport);
            this._compositor.composite(renderer, camera, null, 0);
        }
    }
    else {
        if (this.needsTemporalSS() && accumulating) {
            var frameBuffer = this._temporalSS.getSourceFrameBuffer();
            frameBuffer.bind(renderer);
            renderer.saveClear();
            renderer.clearBit = renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT;
            renderer.render(scene, camera, true);
            renderer.restoreClear();
            frameBuffer.unbind(renderer);

            renderer.setViewport(this.viewport);
            this._temporalSS.render(renderer);
        }
        else {
            renderer.setViewport(this.viewport);
            renderer.render(scene, camera, true);
        }
    }

    // this._shadowMapPass.renderDebug(renderer);
};

ViewGL.prototype._updateShadowPCFKernel = function (frame) {
    var pcfKernel = this._pcfKernels[frame % this._pcfKernels.length];
    var opaqueQueue = this.scene.opaqueQueue;
    for (var i = 0; i < opaqueQueue.length; i++) {
        if (opaqueQueue[i].receiveShadow) {
            opaqueQueue[i].material.set('pcfKernel', pcfKernel);
            opaqueQueue[i].material.shader.define('fragment', 'PCF_KERNEL_SIZE', pcfKernel.length / 2);
        }
    }
};

ViewGL.prototype.dispose = function (renderer) {
    this._compositor.dispose(renderer.gl);
    this._temporalSS.dispose(renderer.gl);
    this._shadowMapPass.dispose(renderer);
};
/**
 * @param {module:echarts/Model} Post effect model
 */
ViewGL.prototype.setPostEffect = function (postEffectModel, api) {
    var compositor = this._compositor;
    this._enablePostEffect = postEffectModel.get('enable');
    var bloomModel = postEffectModel.getModel('bloom');
    var dofModel = postEffectModel.getModel('depthOfField');
    var ssaoModel = postEffectModel.getModel('SSAO');
    var fxaaModel = postEffectModel.getModel('FXAA');
    var colorCorrModel = postEffectModel.getModel('colorCorrection');
    fxaaModel.get('enable') ? compositor.enableFXAA() : compositor.disableFXAA();
    bloomModel.get('enable') ? compositor.enableBloom() : compositor.disableBloom();
    dofModel.get('enable') ? compositor.enableDOF() : compositor.disableDOF();
    colorCorrModel.get('enable') ? compositor.enableColorCorrection() : compositor.disableColorCorrection();

    this._enableDOF = dofModel.get('enable');
    this._enableSSAO = ssaoModel.get('enable');
    this._enableSSAO ? compositor.enableSSAO() : compositor.disableSSAO();

    compositor.setBloomIntensity(bloomModel.get('intensity'));
    compositor.setSSAORadius(ssaoModel.get('radius'));
    compositor.setSSAOQuality(ssaoModel.get('quality'));
    compositor.setSSAOIntensity(ssaoModel.get('intensity'));

    compositor.setDOFBlurQuality(dofModel.get('quality'));
    compositor.setDOFFocalDistance(dofModel.get('focalDistance'));
    compositor.setDOFFocalRange(dofModel.get('focalRange'));
    compositor.setDOFBlurSize(dofModel.get('blurRadius'));
    compositor.setDOFFStop(dofModel.get('fstop'));

    compositor.setColorLookupTexture(colorCorrModel.get('lookupTexture'), api);
    compositor.setExposure(colorCorrModel.get('exposure'));
    ['brightness', 'contrast', 'saturation'].forEach(function (name) {
        compositor.setColorCorrection(name, colorCorrModel.get(name));
    });
};

ViewGL.prototype.setDOFFocusOnPoint = function (depth) {
    if (this._enablePostEffect) {

        if (depth > this.camera.far || depth < this.camera.near) {
            return;
        }

        this._compositor.setDOFFocalDistance(depth);
        return true;
    }
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

echarts.util.extend(ViewGL.prototype, notifier);

module.exports = ViewGL;