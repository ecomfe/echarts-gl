var Compositor = require('qtek/src/compositor/Compositor');
var Shader = require('qtek/src/Shader');
var Texture2D = require('qtek/src/Texture2D');
var Texture = require('qtek/src/Texture');
var FrameBuffer = require('qtek/src/FrameBuffer');
var FXLoader = require('qtek/src/loader/FX');
var SSAOPass = require('./SSAOPass');
var SSRPass = require('./SSRPass');
var poissonKernel = require('./poissonKernel');
var graphicGL = require('../util/graphicGL');
var NormalPass = require('./NormalPass');
var EdgePass = require('./EdgePass');
var Matrix4 = require('qtek/src/math/Matrix4');

var effectJson = require('./composite.js');

Shader['import'](require('qtek/src/shader/source/compositor/blur.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/lut.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/output.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/bright.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/downsample.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/upsample.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/hdr.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/blend.glsl.js'));
Shader['import'](require('qtek/src/shader/source/compositor/fxaa.glsl.js'));
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

var FINAL_NODES_CHAIN = ['composite', 'FXAA'];

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

    this._dofBlurNodes = ['dof_far_blur', 'dof_near_blur', 'dof_coc_blur'].map(function (name) {
        return this._compositor.getNodeByName(name);
    }, this);

    this._dofBlurKernel = 0;
    this._dofBlurKernelSize = new Float32Array(0);

    this._finalNodesChain = FINAL_NODES_CHAIN.map(function (name) {
        return this._compositor.getNodeByName(name);
    }, this);

    var gBufferObj = {
        normalTexture: this._normalPass.getNormalTexture(),
        depthTexture: this._normalPass.getDepthTexture()
    };
    this._ssaoPass = new SSAOPass(gBufferObj);
    this._ssrPass = new SSRPass(gBufferObj)
    this._edgePass = new EdgePass(gBufferObj);
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
    return this._enableSSAO || this._enableEdge || this._enableSSR;
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
 * Enable SSR effect
 */
EffectCompositor.prototype.enableSSR = function () {
    this._enableSSR = true;
};
/**
 * Disable SSR effect
 */
EffectCompositor.prototype.disableSSR = function () {
    this._enableSSR = false;
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
    this._compositor.dirty();
};

/**
 * Disable bloom effect
 */
EffectCompositor.prototype.disableBloom = function () {
    this._compositeNode.inputs.bloom = null;
    this._compositor.dirty();
};

/**
 * Enable depth of field effect
 */
EffectCompositor.prototype.enableDOF = function () {
    this._compositeNode.inputs.texture = 'dof_composite';
    this._compositor.dirty();
};
/**
 * Disable depth of field effect
 */
EffectCompositor.prototype.disableDOF = function () {
    this._compositeNode.inputs.texture = 'source';
    this._compositor.dirty();
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
};

/**
 * Disable edge detection
 */
EffectCompositor.prototype.disableEdge = function () {
    this._enableEdge = false;
};

/**
 * Set bloom intensity
 * @param {number} value
 */
EffectCompositor.prototype.setBloomIntensity = function (value) {
    this._compositeNode.setParameter('bloomIntensity', value);
};

EffectCompositor.prototype.setSSAOParameter = function (name, value) {
    switch (name) {
        case 'quality':
            // PENDING
            var kernelSize = ({
                low: 6,
                medium: 12,
                high: 32,
                ultra: 62
            })[value] || 12;
            this._ssaoPass.setParameter('kernelSize', kernelSize);
            break;
        case 'radius':
            this._ssaoPass.setParameter(name, value);
            this._ssaoPass.setParameter('bias', value / 200);
            break;
        case 'intensity':
            this._ssaoPass.setParameter(name, value);
            break;
        default:
            if (__DEV__) {
                console.warn('Unkown SSAO parameter ' + name);
            }
    }
};

EffectCompositor.prototype.setDOFParameter = function (name, value) {
    switch (name) {
        case 'focalDistance':
        case 'focalRange':
        case 'fstop':
            this._cocNode.setParameter(name, value);
            break;
        case 'blurRadius':
            for (var i = 0; i < this._dofBlurNodes.length; i++) {
                this._dofBlurNodes[i].setParameter('blurRadius', value);
            }
            break;
        case 'quality':
            var kernelSize = ({
                low: 4, medium: 8, high: 16, ultra: 32
            })[value] || 8;
            this._dofBlurKernelSize = kernelSize;
            for (var i = 0; i < this._dofBlurNodes.length; i++) {
                this._dofBlurNodes[i].shaderDefine('POISSON_KERNEL_SIZE', kernelSize);
            }
            this._dofBlurKernel = new Float32Array(kernelSize * 2);
            break;
        default:
            if (__DEV__) {
                console.warn('Unkown DOF parameter ' + name);
            }
    }
};

EffectCompositor.prototype.setSSRParameter = function (name, value) {
    switch (name) {
        case 'quality':
            // PENDING
            var maxIteration = ({
                low: 10,
                medium: 20,
                high: 40,
                ultra: 80
            })[value] || 20;
            var pixelStride = ({
                low: 32,
                medium: 16,
                high: 8,
                ultra: 4
            })[value] || 16;
            this._ssrPass.setParameter('maxIteration', maxIteration);
            this._ssrPass.setParameter('pixelStride', pixelStride);
            break;
        case 'maxRoughness':
            this._ssrPass.setParameter('minGlossiness', Math.max(Math.min(1.0 - value, 1.0), 0.0));
            break;
        default:
            if (__DEV__) {
                console.warn('Unkown SSR parameter ' + name);
            }
    }
}
;
/**
 * Set color of edge
 */
EffectCompositor.prototype.setEdgeColor = function (value) {
    var color = graphicGL.parseColor(value);
    this._edgePass.setParameter('edgeColor', color);
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

    var sourceTexture = this._sourceTexture;
    var targetTexture = sourceTexture;
    if (this._enableEdge) {
        this._edgePass.update(renderer, camera, sourceTexture, frame);
        sourceTexture = targetTexture = this._edgePass.getTargetTexture();
    }
    if (this._enableSSR) {
        this._ssrPass.update(renderer, camera, sourceTexture, frame);
        targetTexture = this._ssrPass.getTargetTexture();
    }
    this._sourceNode.texture = targetTexture;

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