import * as echarts from 'echarts/lib/echarts';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;
var mat4 = glmatrix.mat4;

import textCoord from 'echarts/lib/coord/geo/fix/textCoord';
import geoCoord from 'echarts/lib/coord/geo/fix/geoCoord';
// Geo fix functions
var geoFixFuncs = [textCoord, geoCoord];

function Geo3D(name, map, geoJson, specialAreas, nameMap) {

    this.name = name;

    this.map = map;

    this.regionHeight = 0;

    this.regions = [];

    this._nameCoordMap = {};

    this.loadGeoJson(geoJson, specialAreas, nameMap);

    this.transform = mat4.identity(new Float64Array(16));

    this.invTransform = mat4.identity(new Float64Array(16));

    // Which dimension to extrude. Y or Z
    this.extrudeY = true;

    this.altitudeAxis;
}

Geo3D.prototype = {

    constructor: Geo3D,

    type: 'geo3D',

    dimensions: ['lng', 'lat', 'alt'],

    containPoint: function () {},

    loadGeoJson: function (geoJson, specialAreas, nameMap) {
        var parseGeoJSON = echarts.parseGeoJSON || echarts.parseGeoJson;
        try {
            this.regions = geoJson ? parseGeoJSON(geoJson) : [];
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
            this.addGeoCoord(regionName, regions[i].getCenter());

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

        var position = this.extrudeY ? [translateX, 0, translateZ] : [translateX, translateZ, 0];
        var scale = this.extrudeY ? [scaleX, 1, scaleZ] : [scaleX, scaleZ, 1];

        var m = this.transform;
        mat4.identity(m);
        mat4.translate(m, m, position);
        mat4.scale(m, m, scale);

        mat4.invert(this.invTransform, m);
    },

    dataToPoint: function (data, out) {
        out = out || [];

        var extrudeCoordIndex = this.extrudeY ? 1 : 2;
        var sideCoordIndex = this.extrudeY ? 2 : 1;

        var altitudeVal = data[2];
        // PENDING.
        if (isNaN(altitudeVal)) {
            altitudeVal = 0;
        }
        // lng
        out[0] = data[0];
        // lat
        out[sideCoordIndex] = data[1];

        if (this.altitudeAxis) {
            out[extrudeCoordIndex] = this.altitudeAxis.dataToCoord(altitudeVal);
        }
        else {
            out[extrudeCoordIndex] = 0;
        }
        // PENDING different region height.
        out[extrudeCoordIndex] += this.regionHeight;

        vec3.transformMat4(out, out, this.transform);

        return out;
    },

    pointToData: function (point, out) {
        // TODO
    }
};

export default Geo3D;