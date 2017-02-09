/**
 * Geometry collecting straight line, cubic curve data
 * @module echarts-gl/chart/lines3D/LinesGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

var StaticGeometry = require('qtek/lib/StaticGeometry');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

// var CURVE_RECURSION_LIMIT = 8;
// var CURVE_COLLINEAR_EPSILON = 40;

/**
 * @constructor
 * @alias module:echarts-gl/chart/lines3D/LinesGeometry
 * @extends qtek.StaticGeometry
 */

var LinesGeometry = StaticGeometry.extend(function () {
    return {

        segmentScale: 1,

        attributes: {
            position: new StaticGeometry.Attribute('position', 'float', 3, 'POSITION'),
            color: new StaticGeometry.Attribute('color', 'float', 4, 'COLOR')
        }
    };
},
/** @lends module: echarts-gl/chart/lines3D/LinesGeometry.prototype */
{

    /**
     * Reset offset
     */
    resetOffset: function () {
        this._offset = 0;
    },

    /**
     * @param {number} nVertex
     */
    setVertexCount: function (nVertex) {
        if (this.vertexCount !== nVertex) {
            this.attributes.position.init(nVertex);
            this.attributes.color.init(nVertex);

            this._offset = 0;
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
    getCubicCurveVertexCount: function (p0, p1, p2, p3) {
        var len = vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2);
        var step = 1 / (len + 1) * this.segmentScale;
        return Math.ceil(1 / step) * 2 + 1;
    },
    /**
     * Add a cubic curve
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} p2
     * @param {Array.<number>} p3
     * @param {Array.<number>} color
     */
    addCubicCurve: function (p0, p1, p2, p3, color) {
        // incremental interpolation
        // http://antigrain.com/research/bezier_interpolation/index.html#PAGE_BEZIER_INTERPOLATION
        var x0 = p0[0], y0 = p0[1], z0 = p0[2];
        var x1 = p1[0], y1 = p1[1], z1 = p1[2];
        var x2 = p2[0], y2 = p2[1], z2 = p2[2];
        var x3 = p3[0], y3 = p3[1], z3 = p3[2];

        var len = vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2);
        var step = 1 / (len + 1) * this.segmentScale;

        var step2 = step * step;
        var step3 = step2 * step;

        var pre1 = 3.0 * step;
        var pre2 = 3.0 * step2;
        var pre4 = 6.0 * step2;
        var pre5 = 6.0 * step3;

        var tmp1x = x0 - x1 * 2.0 + x2;
        var tmp1y = y0 - y1 * 2.0 + y2;
        var tmp1z = z0 - z1 * 2.0 + z2;

        var tmp2x = (x1 - x2) * 3.0 - x0 + x3;
        var tmp2y = (y1 - y2) * 3.0 - y0 + y3;
        var tmp2z = (z1 - z2) * 3.0 - z0 + z3;

        var fx = x0;
        var fy = y0;
        var fz = z0;

        var dfx = (x1 - x0) * pre1 + tmp1x * pre2 + tmp2x * step3;
        var dfy = (y1 - y0) * pre1 + tmp1y * pre2 + tmp2y * step3;
        var dfz = (z1 - z0) * pre1 + tmp1z * pre2 + tmp2z * step3;

        var ddfx = tmp1x * pre4 + tmp2x * pre5;
        var ddfy = tmp1y * pre4 + tmp2y * pre5;
        var ddfz = tmp1z * pre4 + tmp2z * pre5;

        var dddfx = tmp2x * pre5;
        var dddfy = tmp2y * pre5;
        var dddfz = tmp2z * pre5;

        var positionAttr = this.attributes.position;
        var colorAttr = this.attributes.color;
        var firstSeg = true;
        var t = 0;
        var posTmp = [];
        while (t < 1 + step) {
            if (!firstSeg) {
                positionAttr.copy(this._offset, this._offset - 1);
                colorAttr.copy(this._offset, this._offset - 1);
                this._offset ++;
            }

            firstSeg = false;

            colorAttr.set(this._offset, color);
            posTmp[0] = fx; posTmp[1] = fy; posTmp[2] = fz;
            positionAttr.set(this._offset, posTmp);
            this._offset++;

            fx += dfx; fy += dfy; fz += dfz;
            dfx += ddfx; dfy += ddfy; dfz += ddfz;
            ddfx += dddfx; ddfy += dddfy; ddfz += dddfz;
            t += step;
        }
    }
});

module.exports = LinesGeometry;