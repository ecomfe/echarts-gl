var Compositor = require('qtek/lib/compositor/Compositor');
var Shader = require('qtek/lib/Shader');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var FrameBuffer = require('qtek/lib/FrameBuffer');
var FXLoader = require('qtek/lib/loader/FX');

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
        type: Texture.FLOAT
    });

    this._framebuffer = new FrameBuffer();
    this._framebuffer.attach(this._sourceTexture);

    var loader = new FXLoader();
    this._compositor = loader.parse(effectJson);

    var sourceNode = this._compositor.getNodeByName('source');
    sourceNode.texture = this._sourceTexture;

    this._compositeNode = this._compositor.getNodeByName('composite');
    this._fxaaNode = this._compositor.getNodeByName('FXAA');
}

EffectCompositor.prototype.resize = function (width, height, dpr) {
    dpr = dpr || 1;
    var width = width * dpr;
    var height = height * dpr;
    if (this._sourceTexture.width !== width || this._sourceTexture.height !== height) {
        this._sourceTexture.width = width;
        this._sourceTexture.height = height;
        this._sourceTexture.dirty();
    }
};

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

EffectCompositor.prototype.setBloomIntensity = function (value) {
    this._compositeNode.setParameter('bloom', value);
};

EffectCompositor.prototype.composite = function (renderer, framebuffer) {
    this._compositor.render(renderer, framebuffer);
};

EffectCompositor.prototype.dispose = function (gl) {
    this._sourceTexture.dispose(gl);
    this._framebuffer.dispose(gl);
    this._compositor.dispose(gl);
};

module.exports = EffectCompositor;