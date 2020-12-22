import Shader from 'claygl/src/Shader';
import Texture2D from 'claygl/src/Texture2D';
import Texture from 'claygl/src/Texture';
import FrameBuffer from 'claygl/src/FrameBuffer';
import createCompositor from 'claygl/src/compositor/createCompositor';
import SSAOPass from './SSAOPass';
import SSRPass from './SSRPass';
import poissonKernel from './poissonKernel';
import graphicGL from '../util/graphicGL';
import NormalPass from './NormalPass';
import EdgePass from './EdgePass';

import effectJson from './composite.js';

import blurCode from 'claygl/src/shader/source/compositor/blur.glsl.js';
import lutCode from 'claygl/src/shader/source/compositor/lut.glsl.js';
import outputCode from 'claygl/src/shader/source/compositor/output.glsl.js';
import brightCode from 'claygl/src/shader/source/compositor/bright.glsl.js';
import downsampleCode from 'claygl/src/shader/source/compositor/downsample.glsl.js';
import upsampleCode from 'claygl/src/shader/source/compositor/upsample.glsl.js';
import hdrCode from 'claygl/src/shader/source/compositor/hdr.glsl.js';
import blendCode from 'claygl/src/shader/source/compositor/blend.glsl.js';
import fxaaCode from 'claygl/src/shader/source/compositor/fxaa.glsl.js';
import DOFCode from './DOF.glsl.js';
import edgeCode from './edge.glsl.js';

Shader['import'](blurCode);
Shader['import'](lutCode);
Shader['import'](outputCode);
Shader['import'](brightCode);
Shader['import'](downsampleCode);
Shader['import'](upsampleCode);
Shader['import'](hdrCode);
Shader['import'](blendCode);
Shader['import'](fxaaCode);
Shader['import'](DOFCode);
Shader['import'](edgeCode);


function makeCommonOutputs(getWidth, getHeight) {
    return {
        color: {
            parameters: {
                width: getWidth,
                height: getHeight
            }
        }
    };
}

var FINAL_NODES_CHAIN = ['composite', 'FXAA'];

function EffectCompositor() {
    this._width;
    this._height;
    this._dpr;


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

    this._compositor = createCompositor(effectJson);

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
    this._ssrPass = new SSRPass(gBufferObj);
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

    var rendererMock = {
        getWidth: function () {
            return width;
        },
        getHeight: function () {
            return height;
        },
        getDevicePixelRatio: function () {
            return dpr;
        }
    };
    function wrapCallback(obj, key) {
        if (typeof obj[key] === 'function') {
            var oldFunc = obj[key].__original || obj[key];
            // Use viewport width/height instead of renderer width/height
            obj[key] = function (renderer) {
                return oldFunc.call(this, rendererMock);
            };
            obj[key].__original = oldFunc;
        }
    }
    this._compositor.nodes.forEach(function (node) {
        for (var outKey in node.outputs) {
            var parameters = node.outputs[outKey].parameters;
            if (parameters) {
                wrapCallback(parameters, 'width');
                wrapCallback(parameters, 'height');
            }
        }
        for (var paramKey in node.parameters) {
            wrapCallback(node.parameters, paramKey);
        }
    });

    this._width = width;
    this._height = height;
    this._dpr = dpr;
};

EffectCompositor.prototype.getWidth = function () {
    return this._width;
};
EffectCompositor.prototype.getHeight = function () {
    return this._height;
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

    node.inputs.texture = prevNode.name;
    if (nextNode) {
        node.outputs = makeCommonOutputs(this.getWidth.bind(this), this.getHeight.bind(this));
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
        prevNode.outputs = makeCommonOutputs(this.getWidth.bind(this), this.getHeight.bind(this));
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
    // this._normalPass.enableTargetTexture3 = true;
};
/**
 * Disable SSR effect
 */
EffectCompositor.prototype.disableSSR = function () {
    this._enableSSR = false;
    // this._normalPass.enableTargetTexture3 = false;
};

/**
 * Render SSAO after render the scene, before compositing
 */
EffectCompositor.prototype.getSSAOTexture = function () {
    return this._ssaoPass.getTargetTexture();
};

/**
 * @return {clay.FrameBuffer}
 */
EffectCompositor.prototype.getSourceFrameBuffer = function () {
    return this._framebuffer;
};

/**
 * @return {clay.Texture2D}
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
    this._compositeNode.define('COLOR_CORRECTION');
    this._enableColorCorrection = true;
};
/**
 * Disable color correction
 */
EffectCompositor.prototype.disableColorCorrection = function () {
    this._compositeNode.undefine('COLOR_CORRECTION');
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
            if (process.env.NODE_ENV !== 'production') {
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
                this._dofBlurNodes[i].pass.material.define('POISSON_KERNEL_SIZE', kernelSize);
            }
            this._dofBlurKernel = new Float32Array(kernelSize * 2);
            break;
        default:
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Unkown DOF parameter ' + name);
            }
    }
};

EffectCompositor.prototype.setSSRParameter = function (name, value) {
    if (value == null) {
        return;
    }
    switch (name) {
        case 'quality':
            // PENDING
            var maxIteration = ({
                low: 10,
                medium: 15,
                high: 30,
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
        case 'physical':
            this.setPhysicallyCorrectSSR(value);
            break;
        default:
            console.warn('Unkown SSR parameter ' + name);
    }
};

EffectCompositor.prototype.setPhysicallyCorrectSSR = function (physical) {
    this._ssrPass.setPhysicallyCorrect(physical);
};

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

EffectCompositor.prototype.isSSREnabled = function () {
    return this._enableSSR;
};

EffectCompositor.prototype.composite = function (renderer, scene, camera, framebuffer, frame) {

    var sourceTexture = this._sourceTexture;
    var targetTexture = sourceTexture;
    if (this._enableEdge) {
        this._edgePass.update(renderer, camera, sourceTexture, frame);
        sourceTexture = targetTexture = this._edgePass.getTargetTexture();
    }
    if (this._enableSSR) {
        this._ssrPass.update(renderer, camera, sourceTexture, frame);
        targetTexture = this._ssrPass.getTargetTexture();

        this._ssrPass.setSSAOTexture(
            this._enableSSAO ? this._ssaoPass.getTargetTexture() : null
        );
        // var lights = scene.getLights();
        // for (var i = 0; i < lights.length; i++) {
        //     if (lights[i].cubemap) {
        //         this._ssrPass.setAmbientCubemap(lights[i].cubemap, lights[i].intensity);
        //     }
        // }
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

EffectCompositor.prototype.dispose = function (renderer) {
    this._sourceTexture.dispose(renderer);
    this._depthTexture.dispose(renderer);
    this._framebuffer.dispose(renderer);
    this._compositor.dispose(renderer);

    this._normalPass.dispose(renderer);
    this._ssaoPass.dispose(renderer);
};

export default EffectCompositor;