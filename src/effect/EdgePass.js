import Matrix4 from 'qtek/src/math/Matrix4';
import Vector3 from 'qtek/src/math/Vector3';
import Texture2D from 'qtek/src/Texture2D';
import Texture from 'qtek/src/Texture';
import Pass from 'qtek/src/compositor/Pass';
import Shader from 'qtek/src/Shader';
import FrameBuffer from 'qtek/src/FrameBuffer';

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

EdgePass.prototype.dispose = function (renderer) {
    this._targetTexture.dispose(renderer);
    this._frameBuffer.dispose(renderer);
};

export default EdgePass;