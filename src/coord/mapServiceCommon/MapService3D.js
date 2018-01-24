import glmatrix from 'claygl/src/dep/glmatrix';
var mat4 = glmatrix.mat4;

var TILE_SIZE = 512;
var FOV = 0.6435011087932844;
var PI = Math.PI;

var WORLD_SCALE = 1 / 10;

function MapServiceCoordSys3D() {
    /**
     * Width of mapbox viewport
     */
    this.width = 0;
    /**
     * Height of mapbox viewport
     */
    this.height = 0;

    this.altitudeScale = 1;

    // TODO Change boxHeight won't have animation.
    this.boxHeight = 'auto';

    // Set by mapbox creator
    this.altitudeExtent;

    this.bearing = 0;
    this.pitch = 0;
    this.center = [0, 0];

    this._origin;

    this.zoom = 0;
    this._initialZoom;

    // Some parameters for different map services.
    this.maxPitch = 60;
    this.zoomOffset = 0;
}

MapServiceCoordSys3D.prototype = {

    constructor: MapServiceCoordSys3D,

    dimensions: ['lng', 'lat', 'alt'],

    containPoint: function () {},

    setCameraOption: function (option) {
        this.bearing = option.bearing;
        this.pitch = option.pitch;

        this.center = option.center;
        this.zoom = option.zoom;

        if (!this._origin) {
            this._origin = this.projectOnTileWithScale(this.center, TILE_SIZE);
        }
        if (this._initialZoom == null) {
            this._initialZoom = this.zoom;
        }

        this.updateTransform();
    },

    // https://github.com/mapbox/mapbox-gl-js/blob/master/src/geo/transform.js#L479
    updateTransform: function () {
        if (!this.height) { return; }

        var cameraToCenterDistance = 0.5 / Math.tan(FOV / 2) * this.height * WORLD_SCALE;
        // Convert to radian.
        var pitch = Math.max(Math.min(this.pitch, this.maxPitch), 0) / 180 * Math.PI;

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
        var farZ = furthestDistance * 1.1;
        // Forced to be 1000
        if (this.pitch > 50) {
            farZ = 1000;
        }

        // matrix for conversion from location to GL coordinates (-1 .. 1)
        var m = [];
        mat4.perspective(m, FOV, this.width / this.height, 1, farZ);
        this.viewGL.camera.projectionMatrix.setArray(m);
        this.viewGL.camera.decomposeProjectionMatrix();

        var m = mat4.identity([]);
        var pt = this.dataToPoint(this.center);
        // Inverse
        mat4.scale(m, m, [1, -1, 1]);
        // Translate to altitude
        mat4.translate(m, m, [0, 0, -cameraToCenterDistance]);
        mat4.rotateX(m, m, pitch);
        mat4.rotateZ(m, m, -this.bearing / 180 * Math.PI);
        // Translate to center.
        mat4.translate(m, m, [-pt[0] * this.getScale() * WORLD_SCALE, -pt[1] * this.getScale() * WORLD_SCALE, 0]);

        this.viewGL.camera.viewMatrix.array = m;
        var invertM = [];
        mat4.invert(invertM, m);
        this.viewGL.camera.worldTransform.array = invertM;
        this.viewGL.camera.decomposeWorldTransform();

        // scale vertically to meters per pixel (inverse of ground resolution):
        // worldSize / (circumferenceOfEarth * cos(lat * π / 180))
        var worldSize = TILE_SIZE * this.getScale();
        var verticalScale;

        if (this.altitudeExtent && !isNaN(this.boxHeight)) {
            var range = this.altitudeExtent[1] - this.altitudeExtent[0];
            verticalScale = this.boxHeight / range * this.getScale() / Math.pow(2, this._initialZoom - this.zoomOffset);
        }
        else {
            verticalScale = worldSize / (2 * Math.PI * 6378000 * Math.abs(Math.cos(this.center[1] * (Math.PI / 180))))
                * this.altitudeScale * WORLD_SCALE;
        }
        // Include scale to avoid relayout when zooming
        // FIXME Camera scale may have problem in shadow
        this.viewGL.rootNode.scale.set(
            this.getScale() * WORLD_SCALE, this.getScale() * WORLD_SCALE, verticalScale
        );
    },

    getScale: function () {
        return Math.pow(2, this.zoom - this.zoomOffset);
    },

    projectOnTile: function (data, out) {
        return this.projectOnTileWithScale(data, this.getScale() * TILE_SIZE, out);
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
        return this.unprojectOnTileWithScale(point, this.getScale() * TILE_SIZE, out);
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
        // Add a origin to avoid precision issue in WebGL.
        out[0] -= this._origin[0];
        out[1] -= this._origin[1];
        // PENDING
        out[2] = !isNaN(data[2]) ? data[2] : 0;
        if (!isNaN(data[2])) {
            out[2] = data[2];
            if (this.altitudeExtent) {
                out[2] -= this.altitudeExtent[0];
            }
        }
        return out;
    }
};

export default MapServiceCoordSys3D;