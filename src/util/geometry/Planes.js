/**
 * Lines geometry
 * Use screen space projected lines lineWidth > MAX_LINE_WIDTH
 * https://mattdesl.svbtle.com/drawing-lines-is-hard
 * @module echarts-gl/util/geometry/PlanesGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

var StaticGeometry = require('qtek/lib/StaticGeometry');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;
var echarts = require('echarts/lib/echarts');
var dynamicConvertMixin = require('./dynamicConvertMixin');

// var CURVE_RECURSION_LIMIT = 8;
// var CURVE_COLLINEAR_EPSILON = 40;

/**
 * @constructor
 * @alias module:echarts-gl/util/geometry/PlanesGeometry
 * @extends qtek.StaticGeometry
 */

var PlanesGeometry = StaticGeometry.extend(function () {
    return {

        segmentScale: 1,

        /**
         * Need to use mesh to expand lines if lineWidth > MAX_LINE_WIDTH
         */
        useNativeLine: true,

        attributes: {
            position: new StaticGeometry.Attribute('position', 'float', 3, 'POSITION'),
            normal: new StaticGeometry.Attribute('normal', 'float', 3, 'NORMAL'),
            color: new StaticGeometry.Attribute('color', 'float', 4, 'COLOR')
        }
    };
},
/** @lends module: echarts-gl/util/geometry/PlanesGeometry.prototype */
{

    /**
     * Reset offset
     */
    resetOffset: function () {
        this._vertexOffset = 0;
        this._faceOffset = 0;
    },

    /**
     * @param {number} nPlane
     */
    setPlaneCount: function (nPlane) {
        var attributes = this.attributes;
        var vertexCount = this.getPlaneVertexCount() * nPlane;
        var faceCount = this.getPlaneFaceCount() * nPlane;
        if (this.vertexCount !== vertexCount) {
            attributes.position.init(vertexCount);
            attributes.normal.init(vertexCount);
            attributes.color.init(vertexCount);
        }
        if (this.faceCount !== faceCount) {
            this.faces = vertexCount > 0xffff ? new Uint32Array(faceCount * 3) : new Uint16Array(faceCount * 3);
        }
    },

    getPlaneVertexCount: function () {
        return 4;
    },

    getPlaneFaceCount: function () {
        return 2;
    },

    addPlane: function () {

    }
});

echarts.util.defaults(PlanesGeometry, dynamicConvertMixin);

module.exports = PlanesGeometry;