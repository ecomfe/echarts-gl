var echarts = require('echarts/lib/echarts');

function Geo3D(name, map, geoJson, specialAreas, nameMap) {

    this.name = name;

    this.map = map;

    this.regions = [];

    this.loadGeoJson(geoJson, specialAreas, nameMap);
}

Geo3D.prototype = {

    constructor: Geo3D,

    loadGeoJson: function (geoJson, specialAreas, nameMap) {
        try {
            this.regions = geoJson ? echarts.parseGeoJson(geoJson) : [];
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

        this._rect = null;
    },

    getGeoBoundingRect: function () {
        if (this._rect) {
            return this._rect;
        }
        var rect;

        var regions = this.regions;
        for (var i = 0; i < regions.length; i++) {
            var regionRect = regions[i].getBoundingRect();
            rect = rect || regionRect.clone();
            rect.union(regionRect);
        }
        // FIXME Always return new ?
        return (this._rect = rect || new echarts.graphic.BoundingRect(0, 0, 0, 0));
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

    dataToPoint: function (data) {
    },

    pointToData: function (point) {
    }
};

module.exports = Geo3D;