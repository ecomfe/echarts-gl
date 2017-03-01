var Compositor = require('qtek/lib/compositor/Compositor');
var Shader = require('qtek/lib/Shader');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var FrameBuffer = require('qtek/lib/FrameBuffer');
var FXLoader = require('qtek/lib/loader/FX');
var SSAOPass = require('./SSAOPass');

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

    this._cocNode = cocNode;
    this._compositeNode = this._compositor.getNodeByName('composite');
    this._fxaaNode = this._compositor.getNodeByName('FXAA');

    this._ssaoPass = new SSAOPass({
        depthTexture: this._depthTexture
    });
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
EffectCompositor.prototype.renderSSAO = function (renderer, camera) {
    this._ssaoPass.render(renderer, camera);
};

/**
 * @return {qtek.FrameBuffer}
 */
EffectCompositor.prototype.getSourceFrameBuffer = function () {
    return this._framebuffer;
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
    this._compositeNode.setParameter('bloom', value);
};

EffectCompositor.prototype.composite = function (renderer, framebuffer) {
    this._compositor.render(renderer, framebuffer);
};

EffectCompositor.prototype.dispose = function (gl) {
    this._sourceTexture.dispose(gl);
    this._depthTexture.dispose(gl);
    this._framebuffer.dispose(gl);
    this._compositor.dispose(gl);
};

module.exports = EffectCompositor;