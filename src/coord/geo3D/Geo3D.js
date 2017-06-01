var echarts = require('echarts/lib/echarts');
var glmatrix = require('qtek/lib/dep/glmatrix');
var vec3 = glmatrix.vec3;
var mat4 = glmatrix.mat4;

// Geo fix functions
var geoFixFuncs = [
    require('echarts/lib/coord/geo/fix/textCoord'),
    require('echarts/lib/coord/geo/fix/geoCoord')
];

function Geo3D(name, map, geoJson, specialAreas, nameMap) {

    this.name = name;

    this.map = map;

    this.regions = [];

    this._nameCoordMap = {};

    this.loadGeoJson(geoJson, specialAreas, nameMap);

    this.transform = new Float64Array(16);

    this.invTransform = new Float64Array(16);
}

Geo3D.prototype = {

    constructor: Geo3D,

    type: 'geo3D',

    dimensions: ['lng', 'lat', 'alt'],

    containPoint: function () {},

    loadGeoJson: function (geoJson, specialAreas, nameMap) {
        try {
            this.regions = geoJson ? echarts.parseGeoJSON(geoJson) : [];
        }
        catch (e) {
            throw 'Invalid geoJson format\n' + e;
        }
        specialAreas = specialAreas || {};
        nameMap = nameMap || {};
        var regions = this.regions;
        var regionsMap = {};
        for (var i = 0; i < regions.length; i++) {
            var regionName = regions[i].name;
            // Try use the alias in nameMap
            regionName = nameMap[regionName] || regionName;
            regions[i].name = regionName;

            regionsMap[regionName] = regions[i];
            // Add geoJson
            this.addGeoCoord(regionName, regions[i].center);

            // Some area like Alaska in USA map needs to be tansformed
            // to look better
            var specialArea = specialAreas[regionName];
            if (specialArea) {
                regions[i].transformTo(
                    specialArea.left, specialArea.top, specialArea.width, specialArea.height
                );
            }
        }

        this._regionsMap = regionsMap;

        this._geoRect = null;

        geoFixFuncs.forEach(function (fixFunc) {
            fixFunc(this);
        }, this);
    },

    getGeoBoundingRect: function () {
        if (this._geoRect) {
            return this._geoRect;
        }
        var rect;

        var regions = this.regions;
        for (var i = 0; i < regions.length; i++) {
            var regionRect = regions[i].getBoundingRect();
            rect = rect || regionRect.clone();
            rect.union(regionRect);
        }
        // FIXME Always return new ?
        return (this._geoRect = rect || new echarts.graphic.BoundingRect(0, 0, 0, 0));
    },

    /**
     * Add geoCoord for indexing by name
     * @param {string} name
     * @param {Array.<number>} geoCoord
     */
    addGeoCoord: function (name, geoCoord) {
        this._nameCoordMap[name] = geoCoord;
    },

    /**
     * @param {string} name
     * @return {module:echarts/coord/geo/Region}
     */
    getRegion: function (name) {
        return this._regionsMap[name];
    },

    getRegionByCoord: function (coord) {
        var regions = this.regions;
        for (var i = 0; i < regions.length; i++) {
            if (regions[i].contain(coord)) {
                return regions[i];
            }
        }
    },

    setSize: function (width, height, depth) {
        this.size = [width, height, depth];

        var rect = this.getGeoBoundingRect();

        var scaleX = width / rect.width;
        var scaleZ = -depth / rect.height;
        var translateX = -width / 2 - rect.x * scaleX;
        var translateZ = depth / 2 - rect.y * scaleZ;

        var position = [translateX, 0, translateZ];
        var scale = [scaleX, 1, scaleZ];

        var m = this.transform;
        mat4.identity(m);
        mat4.translate(m, m, position);
        mat4.scale(m, m, scale);

        mat4.invert(this.invTransform, m);
    },

    dataToPoint: function (data, out) {
        out = out || [];
        // lng
        out[0] = data[0];
        // lat
        out[2] = data[1];

        // alt
        out[1] = data[2];

        if (isNaN(out[1])) {
            out[1] = 0;
        }
        // PENDING.
        out[1] += this.size[1];

        vec3.transformMat4(out, out, this.transform);

        return out;
    },

    pointToData: function (point, out) {
        out = out || [];
        // lng
        out[0] = point[0];
        // lat
        out[1] = point[1];
        // alt
        out[2] = point[2];

        vec3.transformMat4(out, out, this.invTransform);

        return out;
    }
};

module.exports = Geo3D;