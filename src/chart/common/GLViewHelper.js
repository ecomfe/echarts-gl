
import matrix from 'zrender/lib/core/matrix';
import vector from 'zrender/lib/core/vector';

function GLViewHelper(viewGL) {
    this.viewGL = viewGL;
}

GLViewHelper.prototype.reset = function (seriesModel, api) {
    this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());
    this._viewTransform = matrix.create();
    this.updateTransform(seriesModel, api);
};

GLViewHelper.prototype.updateTransform = function (seriesModel, api) {
    var coordinateSystem = seriesModel.coordinateSystem;

    if (coordinateSystem.getRoamTransform) {

        matrix.invert(this._viewTransform, coordinateSystem.getRoamTransform());

        this._setCameraTransform(this._viewTransform);

        api.getZr().refresh();
    }
};

// Reimplement the dataToPoint of coordinate system.
// Remove the effect of pan/zoom transform
GLViewHelper.prototype.dataToPoint = function (coordSys, data, pt) {
    pt = coordSys.dataToPoint(data, null, pt);
    var viewTransform = this._viewTransform;
    if (viewTransform) {
        vector.applyTransform(pt, pt, viewTransform);
    }
};

/**
 * Remove transform info in point.
 */
GLViewHelper.prototype.removeTransformInPoint = function (pt) {
    if (this._viewTransform) {
        vector.applyTransform(pt, pt, this._viewTransform);
    }
    return pt;
};

/**
 * Return number
 */
GLViewHelper.prototype.getZoom = function () {
    if (this._viewTransform) {
        var m = this._viewTransform;
        return 1 / Math.max(
            Math.sqrt(m[0] * m[0] + m[1] * m[1]),
            Math.sqrt(m[2] * m[2] + m[3] * m[3])
        );
    }
    return 1;
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