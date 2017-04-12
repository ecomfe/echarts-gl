var Compositor = require('qtek/lib/compositor/Compositor');
var Shader = require('qtek/lib/Shader');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var FrameBuffer = require('qtek/lib/FrameBuffer');
var FXLoader = require('qtek/lib/loader/FX');
var SSAOPass = require('./SSAOPass');
var poissonKernel = require('./poissonKernel');

var effectJson = JSON.parse(require('text!./composite.json'));

Shader['import'](require('qtek/lib/shader/source/compositor/blur.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/lut.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/output.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/bright.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/downsample.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/upsample.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/hdr.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/dof.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/lensflare.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/blend.essl'));
Shader['import'](require('qtek/lib/shader/source/compositor/fxaa.essl'));
Shader['import'](require('text!./DOF.glsl'));

function EffectCompositor() {
    this._sourceTexture = new Texture2D({
        type: Texture.HALF_FLOAT
    });
    this._depthTexture = new Texture2D({
        format: Texture.DEPTH_COMPONENT,
        type: Texture.UNSIGNED_INT
    });

    this._framebuffer = new FrameBuffer();
    this._framebuffer.attach(this._sourceTexture);
    this._framebuffer.attach(this._depthTexture, FrameBuffer.DEPTH_ATTACHMENT)

    var loader = new FXLoader();
    this._compositor = loader.parse(effectJson);

    var sourceNode = this._compositor.getNodeByName('source');
    sourceNode.texture = this._sourceTexture;
    var cocNode = this._compositor.getNodeByName('coc');
    cocNode.setParameter('depth', this._depthTexture);

    this._sourceNode = sourceNode;
    this._cocNode = cocNode;
    this._compositeNode = this._compositor.getNodeByName('composite');
    this._fxaaNode = this._compositor.getNodeByName('FXAA');

    this._ssaoPass = new SSAOPass({
        depthTexture: this._depthTexture
    });

    this._dofBlurNodes = ['dof_far_blur', 'dof_near_blur', 'dof_coc_blur'].map(function (name) {
        return this._compositor.getNodeByName(name);
    }, this);

    this._dofBlurKernel = 0;
    this._dofBlurKernelSize = new Float32Array(0);
}


EffectCompositor.prototype.resize = function (width, height, dpr) {
    dpr = dpr || 1;
    var width = width * dpr;
    var height = height * dpr;
    var sourceTexture = this._sourceTexture;
    var depthTexture = this._depthTexture;
    if (sourceTexture.width !== width || sourceTexture.height !== height) {
        sourceTexture.width = width;
        sourceTexture.height = height;
        sourceTexture.dirty();
        depthTexture.width = width;
        depthTexture.height = height;
        depthTexture.dirty();
    }
};

/**
 * Render SSAO after render the scene, before compositing
 */
EffectCompositor.prototype.updateSSAO = function (renderer, camera, frame) {
    this._ssaoPass.update(renderer, camera, frame);
};

/**
 * Render SSAO after render the scene, before compositing
 */
EffectCompositor.prototype.blendSSAO = function (renderer, camera) {
    this._ssaoPass.blend(renderer, camera);
};

/**
 * @return {qtek.FrameBuffer}
 */
EffectCompositor.prototype.getSourceFrameBuffer = function () {
    return this._framebuffer;
};

/**
 * @return {qtek.Texture2D}
 */
EffectCompositor.prototype.getSourceTexture = function () {
    return this._sourceTexture;
};

/**
 * Disable ssao effect
 */
EffectCompositor.prototype.disableSSAO = function () {
    this._sourceNode.texture = this._sourceTexture;
};

/**
 * Enable ssao effect
 */
EffectCompositor.prototype.enableSSAO = function () {
    this._sourceNode.texture = this._ssaoPass.getTargetTexture();
};

/**
 * Disable fxaa effect
 */
EffectCompositor.prototype.disableFXAA = function () {
    this._compositor.removeNode(this._fxaaNode);
    if (this._compositeNode.outputs) {
        this._compositeNode.__outputs = this._compositeNode.outputs;
    }
    this._compositeNode.outputs = null;
};

/**
 * Enable fxaa effect
 */
EffectCompositor.prototype.enableFXAA = function () {
    this._compositor.addNode(this._fxaaNode);
    if (this._compositeNode.__outputs) {
        this._compositeNode.outputs = this._compositeNode.__outputs;
    }
};
/**
 * Enable bloom effect
 */
EffectCompositor.prototype.enableBloom = function () {
    this._compositeNode.inputs.bloom = 'bloom_composite';
};

/**
 * Disable bloom effect
 */
EffectCompositor.prototype.disableBloom = function () {
    this._compositeNode.inputs.bloom = null;
};

/**
 * Enable depth of field effect
 */
EffectCompositor.prototype.enableDOF = function () {
    this._compositeNode.inputs.texture = 'dof_composite';
};
/**
 * Disable depth of field effect
 */
EffectCompositor.prototype.disableDOF = function () {
    this._compositeNode.inputs.texture = 'source';
};

EffectCompositor.prototype.setBloomIntensity = function (value) {
    this._compositeNode.setParameter('bloomIntensity', value);
};

EffectCompositor.prototype.setSSAORadius = function (value) {
    this._ssaoPass.setParameter('radius', value);
};
EffectCompositor.prototype.setSSAOIntensity = function (value) {
    this._ssaoPass.setParameter('ssaoIntensity', value);
};

EffectCompositor.prototype.setSSAOQuality = function (value) {
    var kernelSize = ({
        low: 8,
        medium: 16,
        high: 64,
        ultra: 128
    })[value] || 16;
    this._ssaoPass.setParameter('kernelSize', kernelSize);
};

EffectCompositor.prototype.setDOFFocalDistance = function (focalDist) {
    this._cocNode.setParameter('focalDist', focalDist);
};

EffectCompositor.prototype.setDOFFocalRange = function (focalRange) {
    this._cocNode.setParameter('focalRange', focalRange);
};
EffectCompositor.prototype.setDOFFStop = function (fstop) {
    this._cocNode.setParameter('fstop', fstop);
};

EffectCompositor.prototype.setDOFBlurSize = function (blurSize) {
    for (var i = 0; i < this._dofBlurNodes.length; i++) {
        this._dofBlurNodes[i].setParameter('blurSize', blurSize);
    }
};

EffectCompositor.prototype.setDOFBlurQuality = function (quality) {
    var kernelSize = ({
        low: 4, medium: 8, high: 16, ultra: 32
    })[quality] || 8;

    this._dofBlurKernelSize = kernelSize;

    for (var i = 0; i < this._dofBlurNodes.length; i++) {
        this._dofBlurNodes[i].shaderDefine('POISSON_KERNEL_SIZE', kernelSize);
    }

    this._dofBlurKernel = new Float32Array(kernelSize * 2);
};

EffectCompositor.prototype.composite = function (renderer, camera, framebuffer, frame) {

    var blurKernel = this._dofBlurKernel;
    var blurKernelSize = this._dofBlurKernelSize;
    var frameAll = Math.floor(poissonKernel.length / 2 / blurKernelSize);
    var kernelOffset = frame % frameAll;

    for (var i = 0; i < blurKernelSize * 2; i++) {
        blurKernel[i] = poissonKernel[i + kernelOffset * blurKernelSize * 2];
    }

    for (var i = 0; i < this._dofBlurNodes.length; i++) {
        this._dofBlurNodes[i].setParameter('percent', frame / 30.0);
        this._dofBlurNodes[i].setParameter('poissonKernel', blurKernel);
    }

    this._cocNode.setParameter('zNear', camera.near);
    this._cocNode.setParameter('zFar', camera.far);
    this._compositor.render(renderer, framebuffer);
};

EffectCompositor.prototype.dispose = function (gl) {
    this._sourceTexture.dispose(gl);
    this._depthTexture.dispose(gl);
    this._framebuffer.dispose(gl);
    this._compositor.dispose(gl);
};

module.exports = EffectCompositor;