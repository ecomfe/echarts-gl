var Matrix4 = require('qtek/lib/math/Matrix4');
var Vector3 = require('qtek/lib/math/Vector3');
var Texture2D = require('qtek/lib/Texture2D');
var Texture = require('qtek/lib/Texture');
var Pass = require('qtek/lib/compositor/Pass');
var Shader = require('qtek/lib/Shader');
var FrameBuffer = require('qtek/lib/FrameBuffer');

function EdgePass(opt) {
    opt = opt || {};

    this._edgePass = new Pass({
        fragment: Shader.source('ecgl.edge')
    });

    this._edgePass.setUniform('normalTexture', opt.normalTexture);
    this._edgePass.setUniform('depthTexture', opt.depthTexture);

    this._targetTexture = new Texture2D({
        type: Texture.HALF_FLOAT
    });

    this._frameBuffer = new FrameBuffer();
    this._frameBuffer.attach(this._targetTexture);
}

EdgePass.prototype.update = function (renderer, camera, sourceTexture, frame) {
    var width = renderer.getWidth();
    var height = renderer.getHeight();
    var texture = this._targetTexture;
    texture.width = width;
    texture.height = height;
    var frameBuffer = this._frameBuffer;

    frameBuffer.bind(renderer);
    this._edgePass.setUniform('projectionInv', camera.invProjectionMatrix._array);
    this._edgePass.setUniform('textureSize', [width, height]);
    this._edgePass.setUniform('texture', sourceTexture);
    this._edgePass.render(renderer);

    frameBuffer.unbind(renderer);
};

EdgePass.prototype.getTargetTexture = function () {
    return this._targetTexture;
};

EdgePass.prototype.setParameter = function (name, val) {
    this._edgePass.setUniform(name, val);
};

EdgePass.prototype.dispose = function (gl) {
    this._targetTexture.dispose(gl);
    this._frameBuffer.dispose(gl);
};

module.exports = EdgePass;