
import matrix from 'zrender/lib/core/matrix';

function GLViewHelper(viewGL) {
    this.viewGL = viewGL;

    this._coordSysTransform = matrix.create();
}

GLViewHelper.prototype.reset = function (seriesModel, api) {
    this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());
    this._setCameraTransform(matrix.create());

    if (seriesModel.coordinateSystem.transform) {
        matrix.copy(this._coordSysTransform, seriesModel.coordinateSystem.transform);
    }
};

GLViewHelper.prototype.updateTransform = function (seriesModel, api) {
    var coordinateSystem = seriesModel.coordinateSystem;

    if (coordinateSystem.transform) {
        var diffTransform = matrix.create();
        matrix.invert(diffTransform, coordinateSystem.transform);
        matrix.mul(diffTransform, this._coordSysTransform, diffTransform);

        this._setCameraTransform(diffTransform);

        api.getZr().refresh();
    }
};

GLViewHelper.prototype._setCameraTransform = function (m) {
    var camera = this.viewGL.camera;
    camera.position.set(m[4], m[5], 0);
    camera.scale.set(
        Math.sqrt(m[0] * m[0] + m[1] * m[1]),
        Math.sqrt(m[2] * m[2] + m[3] * m[3]),
        1
    );
};

GLViewHelper.prototype._updateCamera = function (width, height, dpr) {
    // TODO, left, top, right, bottom
    this.viewGL.setViewport(0, 0, width, height, dpr);
    var camera = this.viewGL.camera;
    camera.left = camera.top = 0;
    camera.bottom = height;
    camera.right = width;
    camera.near = 0;
    camera.far = 100;
};

export default GLViewHelper;