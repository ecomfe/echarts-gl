/*
 * @module echarts-gl/core/ViewGL
 * @author Yi Shen(http://github.com/pissang)
 */

import echarts from 'echarts/lib/echarts';

import Scene from 'claygl/src/Scene';
import ShadowMapPass from 'claygl/src/prePass/ShadowMap';
import PerspectiveCamera from 'claygl/src/camera/Perspective';
import OrthographicCamera from 'claygl/src/camera/Orthographic';
import Matrix4 from 'claygl/src/math/Matrix4';
import Vector3 from 'claygl/src/math/Vector3';
import Vector2 from 'claygl/src/math/Vector2';

import notifier from 'claygl/src/core/mixin/notifier';

import EffectCompositor from '../effect/EffectCompositor';
import TemporalSuperSampling from '../effect/TemporalSuperSampling';
import halton from '../effect/halton';

/**
 * @constructor
 * @alias module:echarts-gl/core/ViewGL
 * @param {string} [projection='perspective']
 */
function ViewGL(projection) {

    projection = projection || 'perspective';

    /**
     * @type {module:echarts-gl/core/LayerGL}
     */
    this.layer = null;
    /**
     * @type {clay.Scene}
     */
    this.scene = new Scene();

    /**
     * @type {clay.Node}
     */
    this.rootNode = this.scene;

    this.viewport = {
        x: 0, y: 0, width: 0, height: 0
    };

    this.setProjection(projection);

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
ViewGL.prototype.setProjection = function (projection) {
    var oldCamera = this.camera;
    oldCamera && oldCamera.update();
    if (projection === 'perspective') {
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
    // PENDING
    this.camera.near = 0.1;
    this.camera.far = 2000;
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
 * @param {clay.math.Ray} out
 * @return {clay.math.Ray}
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
    this.scene.updateLights();
    var renderList = this.scene.updateRenderList(this.camera);

    this._needsSortProgressively = false;
    // If has any transparent mesh needs sort triangles progressively.
    for (var i = 0; i < renderList.transparent.length; i++) {
        var renderable = renderList.transparent[i];
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

    // var lights = this.scene.getLights();
    // for (var i = 0; i < lights.length; i++) {
    //     if (lights[i].cubemap) {
    //         if (this._compositor && this._compositor.isSSREnabled()) {
    //             lights[i].invisible = true;
    //         }
    //         else {
    //             lights[i].invisible = false;
    //         }
    //     }
    // }
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
    if (enableTemporalSS === 'auto') {
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

    accumFrame = accumFrame || 0;

    this._updateTransparent(renderer, scene, camera, accumFrame);

    if (!accumulating) {
        this._shadowMapPass.kernelPCF = this._pcfKernels[0];
        // Not render shadowmap pass in accumulating frame.
        this._shadowMapPass.render(renderer, scene, camera, true);
    }

    this._updateShadowPCFKernel(accumFrame);

    // Shadowmap will set clear color.
    var bgColor = renderer.clearColor;
    renderer.gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);

    if (this._enablePostEffect) {
        // normal render also needs to be jittered when have edge pass.
        if (this.needsTemporalSS()) {
            this._temporalSS.jitterProjection(renderer, camera);
        }
        this._compositor.updateNormal(renderer, scene, camera, this._temporalSS.getFrame());
    }

    // Always update SSAO to make sure have correct ssaoMap status
    this._updateSSAO(renderer, scene, camera, this._temporalSS.getFrame());

    if (this._enablePostEffect) {

        var frameBuffer = this._compositor.getSourceFrameBuffer();
        frameBuffer.bind(renderer);
        renderer.gl.clear(renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT);
        renderer.render(scene, camera, true, true);
        frameBuffer.unbind(renderer);

        if (this.needsTemporalSS() && accumulating) {
            this._compositor.composite(renderer, scene, camera, this._temporalSS.getSourceFrameBuffer(), this._temporalSS.getFrame());
            renderer.setViewport(this.viewport);
            this._temporalSS.render(renderer);
        }
        else {
            renderer.setViewport(this.viewport);
            this._compositor.composite(renderer, scene, camera, null, 0);
        }
    }
    else {
        if (this.needsTemporalSS() && accumulating) {
            var frameBuffer = this._temporalSS.getSourceFrameBuffer();
            frameBuffer.bind(renderer);
            renderer.saveClear();
            renderer.clearBit = renderer.gl.DEPTH_BUFFER_BIT | renderer.gl.COLOR_BUFFER_BIT;
            renderer.render(scene, camera, true, true);
            renderer.restoreClear();
            frameBuffer.unbind(renderer);

            renderer.setViewport(this.viewport);
            this._temporalSS.render(renderer);
        }
        else {
            renderer.setViewport(this.viewport);
            renderer.render(scene, camera, true, true);
        }
    }

    // this._shadowMapPass.renderDebug(renderer);
    // this._compositor._normalPass.renderDebug(renderer);
};

ViewGL.prototype._updateTransparent = function (renderer, scene, camera, frame) {

    var v3 = new Vector3();
    var invWorldTransform = new Matrix4();
    var cameraWorldPosition = camera.getWorldPosition();
    var transparentList = scene.getRenderList(camera).transparent;

    // Sort transparent object.
    for (var i = 0; i < transparentList.length; i++) {
        var renderable = transparentList[i];
        var geometry = renderable.geometry;
        Matrix4.invert(invWorldTransform, renderable.worldTransform);
        Vector3.transformMat4(v3, cameraWorldPosition, invWorldTransform);
        if (geometry.needsSortTriangles && geometry.needsSortTriangles()) {
            geometry.doSortTriangles(v3, frame);
        }
        if (geometry.needsSortVertices && geometry.needsSortVertices()) {
            geometry.doSortVertices(v3, frame);
        }
    }
};

ViewGL.prototype._updateSSAO = function (renderer, scene, camera) {
    var ifEnableSSAO = this._enableSSAO && this._enablePostEffect;
    if (ifEnableSSAO) {
        this._compositor.updateSSAO(renderer, scene, camera, this._temporalSS.getFrame());
    }
    var renderList = scene.getRenderList(camera);

    for (var i = 0; i < renderList.opaque.length; i++) {
        var renderable = renderList.opaque[i];
        // PENDING
        if (renderable.renderNormal) {
            renderable.material[ifEnableSSAO ? 'enableTexture' : 'disableTexture']('ssaoMap');
        }
        if (ifEnableSSAO) {
            renderable.material.set('ssaoMap', this._compositor.getSSAOTexture());
        }
    }
};

ViewGL.prototype._updateShadowPCFKernel = function (frame) {
    var pcfKernel = this._pcfKernels[frame % this._pcfKernels.length];
    var renderList = this.scene.getRenderList(this.camera);
    var opaqueList = renderList.opaque;
    for (var i = 0; i < opaqueList.length; i++) {
        if (opaqueList[i].receiveShadow) {
            opaqueList[i].material.set('pcfKernel', pcfKernel);
            opaqueList[i].material.define('fragment', 'PCF_KERNEL_SIZE', pcfKernel.length / 2);
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
    var edgeModel = postEffectModel.getModel('edge');
    var dofModel = postEffectModel.getModel('DOF', postEffectModel.getModel('depthOfField'));
    var ssaoModel = postEffectModel.getModel('SSAO', postEffectModel.getModel('screenSpaceAmbientOcclusion'));
    var ssrModel = postEffectModel.getModel('SSR', postEffectModel.getModel('screenSpaceReflection'));
    var fxaaModel = postEffectModel.getModel('FXAA');
    var colorCorrModel = postEffectModel.getModel('colorCorrection');
    bloomModel.get('enable') ? compositor.enableBloom() : compositor.disableBloom();
    dofModel.get('enable') ? compositor.enableDOF() : compositor.disableDOF();
    ssrModel.get('enable') ? compositor.enableSSR() : compositor.disableSSR();
    colorCorrModel.get('enable') ? compositor.enableColorCorrection() : compositor.disableColorCorrection();
    edgeModel.get('enable') ? compositor.enableEdge() : compositor.disableEdge();
    fxaaModel.get('enable') ? compositor.enableFXAA() : compositor.disableFXAA();

    this._enableDOF = dofModel.get('enable');
    this._enableSSAO = ssaoModel.get('enable');

    this._enableSSAO ? compositor.enableSSAO() : compositor.disableSSAO();

    compositor.setBloomIntensity(bloomModel.get('intensity'));
    compositor.setEdgeColor(edgeModel.get('color'));
    compositor.setColorLookupTexture(colorCorrModel.get('lookupTexture'), api);
    compositor.setExposure(colorCorrModel.get('exposure'));

    ['radius', 'quality', 'intensity'].forEach(function (name) {
        compositor.setSSAOParameter(name, ssaoModel.get(name));
    });
    ['quality', 'maxRoughness', 'physical'].forEach(function (name) {
        compositor.setSSRParameter(name, ssrModel.get(name));
    });
    ['quality', 'focalDistance', 'focalRange', 'blurRadius', 'fstop'].forEach(function (name) {
        compositor.setDOFParameter(name, dofModel.get(name));
    });
    ['brightness', 'contrast', 'saturation'].forEach(function (name) {
        compositor.setColorCorrection(name, colorCorrModel.get(name));
    });

};

ViewGL.prototype.setDOFFocusOnPoint = function (depth) {
    if (this._enablePostEffect) {

        if (depth > this.camera.far || depth < this.camera.near) {
            return;
        }

        this._compositor.setDOFParameter('focalDistance', depth);
        return true;
    }
};

ViewGL.prototype.setTemporalSuperSampling = function (temporalSuperSamplingModel) {
    this._enableTemporalSS = temporalSuperSamplingModel.get('enable');
};

ViewGL.prototype.isLinearSpace = function () {
    return this._enablePostEffect;
};

ViewGL.prototype.setRootNode = function (rootNode) {
    if (this.rootNode === rootNode) {
        return;
    }
    var children = this.rootNode.children();
    for (var i = 0; i < children.length; i++) {
        rootNode.add(children[i]);
    }
    if (rootNode !== this.scene) {
        this.scene.add(rootNode);
    }

    this.rootNode = rootNode;
};
// Proxies
ViewGL.prototype.add = function (node3D) {
    this.rootNode.add(node3D);
};
ViewGL.prototype.remove = function (node3D) {
    this.rootNode.remove(node3D);
};
ViewGL.prototype.removeAll = function (node3D) {
    this.rootNode.removeAll(node3D);
};

echarts.util.extend(ViewGL.prototype, notifier);

export default ViewGL;