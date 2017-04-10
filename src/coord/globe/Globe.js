var glmatrix = require('qtek/lib/dep/glmatrix');
var vec3 = glmatrix.vec3;


function Globe(radius) {

    this.radius = radius || 100;

    this.viewGL = null;
}

Globe.prototype = {

    constructor: Globe,

    dimensions: ['lng', 'lat', 'alt'],

    type: 'globe',

    containPoint: function () {},

    dataToPoint: function (data, out) {
        var lng = data[0];
        var lat = data[1];
        // Default have 0 altitude
        var alt = data[2] || 0;

        lng = lng * Math.PI / 180;
        lat = lat * Math.PI / 180;
        var r = alt + this.radius;
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

        return out;
    }
};

module.exports = Globe;