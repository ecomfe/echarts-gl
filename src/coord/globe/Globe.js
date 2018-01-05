import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;


function Globe(radius) {

    this.radius = radius;

    this.viewGL = null;

    this.altitudeAxis;

    // Displacement data provided by texture.
    this.displacementData = null;
    this.displacementWidth;
    this.displacementHeight;
}

Globe.prototype = {

    constructor: Globe,

    dimensions: ['lng', 'lat', 'alt'],

    type: 'globe',

    containPoint: function () {},

    setDisplacementData: function (data, width, height) {
        this.displacementData = data;
        this.displacementWidth = width;
        this.displacementHeight = height;
    },

    _getDisplacementScale: function (lng, lat) {
        var i = (lng + 180) / 360 * (this.displacementWidth - 1);
        var j = (90 - lat) / 180 * (this.displacementHeight - 1);
        // NEAREST SAMPLING
        // TODO Better bilinear sampling
        var idx = Math.round(i) + Math.round(j) * this.displacementWidth;
        return this.displacementData[idx];
    },

    dataToPoint: function (data, out) {
        var lng = data[0];
        var lat = data[1];
        // Default have 0 altitude
        var altVal = data[2] || 0;

        var r = this.radius;
        if (this.displacementData) {
            r *= 1 + this._getDisplacementScale(lng, lat);
        }
        if (this.altitudeAxis) {
            r += this.altitudeAxis.dataToCoord(altVal);
        }

        lng = lng * Math.PI / 180;
        lat = lat * Math.PI / 180;

        var r0 = Math.cos(lat) * r;

        out = out || [];
        // PENDING
        out[0] = -r0 * Math.cos(lng + Math.PI);
        out[1] = Math.sin(lat) * r;
        out[2] = r0 * Math.sin(lng + Math.PI);

        return out;
    },

    pointToData: function (point, out) {
        var x = point[0];
        var y = point[1];
        var z = point[2];
        var len = vec3.len(point);
        x /= len;
        y /= len;
        z /= len;

        var theta = Math.asin(y);
        var phi = Math.atan2(z, -x);
        if (phi < 0) {
            phi = Math.PI * 2  + phi;
        }

        var lat = theta * 180 / Math.PI;
        var lng = phi * 180 / Math.PI - 180;

        out = out || [];
        out[0] = lng;
        out[1] = lat;
        out[2] = len - this.radius;
        if (this.altitudeAxis) {
            out[2] = this.altitudeAxis.coordToData(out[2]);
        }

        return out;
    }
};

export default Globe;