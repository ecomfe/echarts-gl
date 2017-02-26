var echarts = require('echarts/lib/echarts');
var glmatrix = require('qtek/lib/dep/glmatrix');
var mat4 = glmatrix.mat4;

function Geo3D(name, map, geoJson, specialAreas, nameMap) {

    this.name = name;

    this.map = map;

    this.regions = [];

    this._nameCoordMap = {};

    this.loadGeoJson(geoJson, specialAreas, nameMap);

    this.transform = mat4.create();

}

Geo3D.prototype = {

    constructor: Geo3D,

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
    },

    dataToPoint: function (data) {
    },

    pointToData: function (point) {
    }
};

module.exports = Geo3D;