var Compositor = require('qtek/lib/compositor/Compositor');
var Shader = require('qtek/lib/Shader');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var FrameBuffer = require('qtek/lib/FrameBuffer');
var FXLoader = require('qtek/lib/loader/FX');
var SSAOPass = require('./SSAOPass');
var poissonKernel = require('./poissonKernel');
var graphicGL = require('../util/graphicGL');
var NormalPass = require('./NormalPass');
var Matrix4 = require('qtek/lib/math/Matrix4');

var effectJson = require('./composite.js');

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
Shader['import'](require('./DOF.glsl.js'));
Shader['import'](require('./edge.glsl.js'));


var commonOutputs = {
    color : {
        parameters : {
            width : function (renderer) {
                return renderer.getWidth();
            },
            height : function (renderer) {
                return renderer.getHeight();
            }
        }
    }
}

var FINAL_NODES_CHAIN = ['composite', 'edge', 'FXAA'];

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
    this._framebuffer.attach(this._depthTexture, FrameBuffer.DEPTH_ATTACHMENT);

    this._normalPass = new NormalPass();

    var loader = new FXLoader();
    this._compositor = loader.parse(effectJson);

    var sourceNode = this._compositor.getNodeByName('source');
    sourceNode.texture = this._sourceTexture;
    var cocNode = this._compositor.getNodeByName('coc');

    this._sourceNode = sourceNode;
    this._cocNode = cocNode;
    this._compositeNode = this._compositor.getNodeByName('composite');
    this._fxaaNode = this._compositor.getNodeByName('FXAA');

    this._edgeNode = this._compositor.getNodeByName('edge');
    this._edgeNode.setParameter('normalTexture', this._normalPass.getNormalTexture());
    // FIXME depthTexture in normalPass have glitches
    this._edgeNode.setParameter('depthTexture', this._depthTexture);

    this._ssaoPass = new SSAOPass({
        normalTexture: this._normalPass.getNormalTexture(),
        depthTexture: this._depthTexture
    });

    this._dofBlurNodes = ['dof_far_blur', 'dof_near_blur', 'dof_coc_blur'].map(function (name) {
        return this._compositor.getNodeByName(name);
    }, this);

    this._dofBlurKernel = 0;
    this._dofBlurKernelSize = new Float32Array(0);

    this._finalNodesChain = FINAL_NODES_CHAIN.map(function (name) {
        return this._compositor.getNodeByName(name);
    }, this);
}

EffectCompositor.prototype.resize = function (width, height, dpr) {
    dpr = dpr || 1;
    var width = width * dpr;
    var height = height * dpr;
    var sourceTexture = this._sourceTexture;
    var depthTexture = this._depthTexture;

    sourceTexture.width = width;
    sourceTexture.height = height;
    depthTexture.width = width;
    depthTexture.height = height;
};

EffectCompositor.prototype._ifRenderNormalPass = function () {
    return this._enableSSAO || this._enableEdge;
};

EffectCompositor.prototype._getPrevNode = function (node) {
    var idx = FINAL_NODES_CHAIN.indexOf(node.name) - 1;
    var prevNode = this._finalNodesChain[idx];
    while (prevNode && !this._compositor.getNodeByName(prevNode.name)) {
        idx -= 1;
        prevNode = this._finalNodesChain[idx];
    }
    return prevNode;
};
EffectCompositor.prototype._getNextNode = function (node) {
    var idx = FINAL_NODES_CHAIN.indexOf(node.name) + 1;
    var nextNode = this._finalNodesChain[idx];
    while (nextNode && !this._compositor.getNodeByName(nextNode.name)) {
        idx += 1;
        nextNode = this._finalNodesChain[idx];
    }
    return nextNode;
};
EffectCompositor.prototype._addChainNode = function (node) {
    var prevNode = this._getPrevNode(node);
    var nextNode = this._getNextNode(node);
    if (!prevNode) {
        return;
    }

    prevNode.outputs = commonOutputs;
    node.inputs.texture = prevNode.name;
    if (nextNode) {
        node.outputs = commonOutputs;
        nextNode.inputs.texture = node.name;
    }
    else {
        node.outputs = null;
    }
    this._compositor.addNode(node);
};
EffectCompositor.prototype._removeChainNode = function (node) {
    var prevNode = this._getPrevNode(node);
    var nextNode = this._getNextNode(node);
    if (!prevNode) {
        return;
    }

    if (nextNode) {
        prevNode.outputs = commonOutputs;
        nextNode.inputs.texture = prevNode.name;
    }
    else {
        prevNode.outputs = null;
    }
    this._compositor.removeNode(node);
};
/**
 * Update normal
 */
EffectCompositor.prototype.updateNormal = function (renderer, scene, camera, frame) {
    if (this._ifRenderNormalPass()) {
        this._normalPass.update(renderer, scene, camera);
    }
};

/**
 * Render SSAO after render the scene, before compositing
 */
EffectCompositor.prototype.updateSSAO = function (renderer, scene, camera, frame) {
    this._ssaoPass.update(renderer, camera, frame);
};

/**
 * Enable SSAO effect
 */
EffectCompositor.prototype.enableSSAO = function () {
    this._enableSSAO = true;
};

/**
 * Disable SSAO effect
 */
EffectCompositor.prototype.disableSSAO = function () {
    this._enableSSAO = false;
};

/**
 * Render SSAO after render the scene, before compositing
 */
EffectCompositor.prototype.getSSAOTexture = function (renderer, scene, camera, frame) {
    return this._ssaoPass.getTargetTexture();
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
 * Disable fxaa effect
 */
EffectCompositor.prototype.disableFXAA = function () {
    this._removeChainNode(this._fxaaNode);
};

/**
 * Enable fxaa effect
 */
EffectCompositor.prototype.enableFXAA = function () {
    this._addChainNode(this._fxaaNode);
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

/**
 * Enable color correction
 */
EffectCompositor.prototype.enableColorCorrection = function () {
    this._compositeNode.shaderDefine('COLOR_CORRECTION');
    this._enableColorCorrection = true;
};
/**
 * Disable color correction
 */
EffectCompositor.prototype.disableColorCorrection = function () {
    this._compositeNode.shaderUndefine('COLOR_CORRECTION');
    this._enableColorCorrection = false;
};

/**
 * Enable edge detection
 */
EffectCompositor.prototype.enableEdge = function () {
    this._enableEdge = true;
    this._addChainNode(this._edgeNode);
};

/**
 * Disable edge detection
 */
EffectCompositor.prototype.disableEdge = function () {
    this._enableEdge = false;
    this._removeChainNode(this._edgeNode);
};

/**
 * Set bloom intensity
 * @param {number} value
 */
EffectCompositor.prototype.setBloomIntensity = function (value) {
    this._compositeNode.setParameter('bloomIntensity', value);
};

/**
 * Set SSAO sample radius
 * @param {number} value
 */
EffectCompositor.prototype.setSSAORadius = function (value) {
    this._ssaoPass.setParameter('radius', value);
};
/**
 * Set SSAO intensity
 * @param {number} value
 */
EffectCompositor.prototype.setSSAOIntensity = function (value) {
    this._ssaoPass.setParameter('intensity', value);
};

/**
 * Set SSAO quality
 * @param {string} value
 */
EffectCompositor.prototype.setSSAOQuality = function (value) {
    // PENDING
    var kernelSize = ({
        low: 6,
        medium: 12,
        high: 32,
        ultra: 62
    })[value] || 16;
    this._ssaoPass.setParameter('kernelSize', kernelSize);
};

/**
 * Set depth of field focal distance
 * @param {number} focalDist
 */
EffectCompositor.prototype.setDOFFocalDistance = function (focalDist) {
    this._cocNode.setParameter('focalDist', focalDist);
};

/**
 * Set depth of field focal range
 * @param {number} focalRange
 */
EffectCompositor.prototype.setDOFFocalRange = function (focalRange) {
    this._cocNode.setParameter('focalRange', focalRange);
};
/**
 * Set depth of field fstop
 * @param {number} focalRange
 */
EffectCompositor.prototype.setDOFFStop = function (fstop) {
    this._cocNode.setParameter('fstop', fstop);
};

/**
 * Set depth of field max blur size
 * @param {number} focalRange
 */
EffectCompositor.prototype.setDOFBlurSize = function (blurSize) {
    for (var i = 0; i < this._dofBlurNodes.length; i++) {
        this._dofBlurNodes[i].setParameter('blurSize', blurSize);
    }
};

/**
 * Set depth of field blur quality
 * @param {string} quality
 */
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

EffectCompositor.prototype.setExposure = function (value) {
    this._compositeNode.setParameter('exposure', Math.pow(2, value));
};

EffectCompositor.prototype.setColorLookupTexture = function (image, api) {
    this._compositeNode.pass.material.setTextureImage('lut', this._enableColorCorrection ? image : 'none', api, {
        minFilter: graphicGL.Texture.NEAREST,
        magFilter: graphicGL.Texture.NEAREST,
        flipY: false
    });
};
EffectCompositor.prototype.setColorCorrection = function (type, value) {
    this._compositeNode.setParameter(type, value);
};

EffectCompositor.prototype.composite = function (renderer, camera, framebuffer, frame) {

    this._cocNode.setParameter('depth', this._depthTexture);

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

    this._edgeNode.setParameter('projectionInv', camera.invProjectionMatrix._array);

    this._compositor.render(renderer, framebuffer);
};

EffectCompositor.prototype.dispose = function (gl) {
    this._sourceTexture.dispose(gl);
    this._depthTexture.dispose(gl);
    this._framebuffer.dispose(gl);
    this._compositor.dispose(gl);

    this._normalPass.dispose(gl);
    this._ssaoPass.dispose(gl);
};

module.exports = EffectCompositor;