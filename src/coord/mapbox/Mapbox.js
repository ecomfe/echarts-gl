var echarts = require('echarts/lib/echarts');
var glmatrix = require('qtek/lib/dep/glmatrix');
var Vector3 = require('qtek/lib/math/Vector3');
var Matrix4 = require('qtek/lib/math/Matrix4');
var vec3 = glmatrix.vec3;
var mat4 = glmatrix.mat4;

var TILE_SIZE = 512;
var FOV = 0.6435011087932844;
var PI = Math.PI;

function Mapbox() {
    /**
     * Width of mapbox viewport
     */
    this.width = 0;
    /**
     * Height of mapbox viewport
     */
    this.height = 0;

    this.altitudeScale = 1;
    

    this.bearing = 0;
    this.pitch = 0;
    this.center = [0, 0];
    this.zoom = 0;
}

Mapbox.prototype = {

    constructor: Mapbox,

    type: 'mapbox',

    dimensions: ['lng', 'lat', 'alt'],

    containPoint: function () {},

    setCameraOption: function (option) {
        this.bearing = option.bearing;
        this.pitch = option.pitch;

        this.center = option.center;
        this.zoom = option.zoom;

        this.updateCamera();
    },

    // https://github.com/mapbox/mapbox-gl-js/blob/master/src/geo/transform.js#L479
    updateCamera: function () {
        if (!this.height) { return; }

        var cameraToCenterDistance = 0.5 / Math.tan(FOV / 2) * this.height;
        // Convert to radian.
        var pitch = Math.max(Math.min(this.pitch, 60), 0) / 180 * Math.PI;

        // Find the distance from the center point [width/2, height/2] to the
        // center top point [width/2, 0] in Z units, using the law of sines.
        // 1 Z unit is equivalent to 1 horizontal px at the center of the map
        // (the distance between[width/2, height/2] and [width/2 + 1, height/2])
        var halfFov = FOV / 2;
        var groundAngle = Math.PI / 2 + pitch;
        var topHalfSurfaceDistance = Math.sin(halfFov) * cameraToCenterDistance / Math.sin(Math.PI - groundAngle - halfFov);

        // Calculate z distance of the farthest fragment that should be rendered.
        var furthestDistance = Math.cos(Math.PI / 2 - pitch) * topHalfSurfaceDistance + cameraToCenterDistance;
        // Add a bit extra to avoid precision problems when a fragment's distance is exactly `furthestDistance`
        var farZ = furthestDistance * 1.01;

        // matrix for conversion from location to GL coordinates (-1 .. 1)
        var m = new Float64Array(16);
        mat4.perspective(m, FOV, this.width / this.height, 0.1, farZ);
        this.viewGL.camera.projectionMatrix.setArray(m);
        this.viewGL.camera.decomposeProjectionMatrix();

        var m = mat4.identity(new Float64Array(16));
        var pt = this.projectOnTile(this.center);
        // Inverse
        mat4.scale(m, m, [1, -1, 1]);
        // Translate to altitude
        mat4.translate(m, m, [0, 0, -cameraToCenterDistance]);
        mat4.rotateX(m, m, pitch);
        mat4.rotateZ(m, m, -this.bearing / 180 * Math.PI);
        // Translate to center.
        mat4.translate(m, m, [-pt[0], -pt[1], 0]);

        this.viewGL.camera.viewMatrix._array = m;
        var invertM = new Float64Array(16);
        mat4.invert(invertM, m);
        this.viewGL.camera.worldTransform._array = invertM;
        // Don't update this camera.
        // FIXME decomposeWorldTransform will be wrong. Precision issue?
        // this.viewGL.camera.decomposeWorldTransform();
        this.viewGL.camera.update = function () {
            this.updateProjectionMatrix();
            Matrix4.invert(this.invProjectionMatrix, this.projectionMatrix);
            this.frustum.setFromProjection(this.projectionMatrix);
        }

        // scale vertically to meters per pixel (inverse of ground resolution):
        // worldSize / (circumferenceOfEarth * cos(lat * π / 180))
        var worldSize = TILE_SIZE * this._getScale();
        var verticalScale = worldSize / (2 * Math.PI * 6378000 * Math.abs(Math.cos(this.center[1] * (Math.PI / 180))));
        // Include scale to avoid zoom needs relayout
        // FIXME Camera scale may have problem in shadow
        this.viewGL.scene.scale.set(
            this._getScale(), this._getScale(), verticalScale * this.altitudeScale
        );

    },

    _getScale: function () {
        return Math.pow(2, this.zoom);
    },

    projectOnTile: function (data, out) {
        return this.projectOnTileWithScale(data, this._getScale() * TILE_SIZE, out);
    },

    projectOnTileWithScale: function (data, scale, out) {
        var lng = data[0];
        var lat = data[1];
        var lambda2 = lng * PI / 180;
        var phi2 = lat * PI / 180;
        var x = scale * (lambda2 + PI) / (2 * PI);
        var y = scale * (PI - Math.log(Math.tan(PI / 4 + phi2 * 0.5))) / (2 * PI);
        out = out || [];
        out[0] = x;
        out[1] = y;
        return out;
    },

    unprojectFromTile: function (point, out) {
        return this.unprojectOnTileWithScale(point, this._getScale() * TILE_SIZE, out);
    },

    unprojectOnTileWithScale: function (point, scale, out) {
        var x = point[0];
        var y = point[1];
        var lambda2 = (x / scale) * (2 * PI) - PI;
        var phi2 = 2 * (Math.atan(Math.exp(PI - (y / scale) * (2 * PI))) - PI / 4);
        out = out || [];
        out[0] = lambda2 * 180 / PI;
        out[1] = phi2 * 180 / PI;
        return out;
    },

    dataToPoint: function (data, out) {
        out = this.projectOnTileWithScale(data, TILE_SIZE, out);
        out[2] = data[2] != null ? data[2] : 0;
        return out;
    }
};

module.exports = Mapbox;