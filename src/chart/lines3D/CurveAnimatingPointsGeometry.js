/**
 * Geometry colleting cloud points data
 * Points will move on a cubic curve path
 *
 * @module echarts-gl/chart/lines3D/CurveAnimatingPointsGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

var StaticGeometry = require('qtek/lib/StaticGeometry');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

/**
 * @constructor
 * @alias module:echarts-gl/chart/lines3D/CurveAnimatingPointsGeometry
 * @extends qtek.StaticGeometry
 */
var CurveAnimatingPointsGeometry = StaticGeometry.derive(function () {
    return {
        attributes: {
            p0: new StaticGeometry.Attribute('p0', 'float', 3, ''),
            p1: new StaticGeometry.Attribute('p1', 'float', 3, ''),
            p2: new StaticGeometry.Attribute('p2', 'float', 3, ''),
            p3: new StaticGeometry.Attribute('p3', 'float', 3, ''),
            offset: new StaticGeometry.Attribute('offset', 'float', 1, ''),
            size: new StaticGeometry.Attribute('size', 'float', 1, ''),
            color: new StaticGeometry.Attribute('color', 'float', 4, 'COLOR')
        },
        mainAttribute: 'p0',

        scale: 1,

        _offset: 0
    };
},
/** @lends module:echarts-gl/chart/lines3D/CurveAnimatingPointsGeometry.prototype */
{

    reset: function () {
        this._offset = 0;
    },

    setVertexCount: function (vertexCount) {
        if (this.vertexCount !== vertexCount) {
            for (var name in this.attributes) {
                this.attributes[name].init(vertexCount);
            }
        }
    },

    /**
     * Get vertex count of cubic curve
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} p2
     * @param {Array.<number>} p3
     * @return number
     */
    getPointVertexCount: function (p0, p1, p2, p3) {
        var len = vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2);
        // TODO Consider time
        var count = Math.max(Math.min(Math.round((len + 1) / this.scale * 40), 15), 3);
        return count;
    },
    /**
     * Add a point
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} p2
     * @param {Array.<number>} p3
     * @param {number} size
     * @param {Array.<number>} color
     */
    addPoint: function (p0, p1, p2, p3, size, color) {
        var attributes = this.attributes;
        var offset = Math.random();
        var count = this.getPointVertexCount(p0, p1, p2, p3);
        for (var i = 0; i < count; i++) {
            attributes.p0.set(this._offset, p0);
            attributes.p1.set(this._offset, p1);
            attributes.p2.set(this._offset, p2);
            attributes.p3.set(this._offset, p3);
            attributes.offset.set(this._offset, offset);
            attributes.size.set(this._offset, size * i / count);
            attributes.color.set(this._offset++, color);
            // PENDING
            offset += 0.004;
        }
    }
});

module.exports = CurveAnimatingPointsGeometry;