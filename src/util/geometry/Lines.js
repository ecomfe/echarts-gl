/**
 * Geometry collecting straight line, cubic curve data
 * @module echarts-x/util/geometry/Lines
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {
    
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var Vector3 = require('qtek/math/Vector3');
    var vec3 = require('qtek/dep/glmatrix').vec3;

    // var CURVE_RECURSION_LIMIT = 8;
    // var CURVE_COLLINEAR_EPSILON = 40;

    /**
     * @constructor
     * @alias module:echarts-x/util/geometry/Lines
     * @extends qtek.DynamicGeometry
     */
    
    var LinesGeometry = DynamicGeometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true)
            }
        };
    },
    /** @lends module: echarts-x/util/geometry/Lines.prototype */
    {
        /**
         * Clear all lines
         */
        clearLines: function () {
            this.attributes.position.value.length = 0;
            this.attributes.color.value.length = 0;
        },
        /**
         * Add a straight line
         * @param {qtek.math.Vector3} p0
         * @param {qtek.math.Vector3} p1
         * @param {Array.<number>} color
         */
        addLine: function (p0, p1, color) {
            this.attributes.position.value.push(p0._array, p1._array);
            this.attributes.color.value.push(color, color);
        },

        /**
         * Add a cubic curve
         * @param {qtek.math.Vector3} p0
         * @param {qtek.math.Vector3} p1
         * @param {qtek.math.Vector3} p2
         * @param {qtek.math.Vector3} p3
         * @param {Array.<number>} color
         */
        addCubicCurve: function (p0, p1, p2, p3, color) {
            // incremental interpolation
            // http://antigrain.com/research/bezier_interpolation/index.html#PAGE_BEZIER_INTERPOLATION
            p0 = p0._array; p1 = p1._array; p2 = p2._array; p3 = p3._array;
            var x0 = p0[0], y0 = p0[1], z0 = p0[2];
            var x1 = p1[0], y1 = p1[1], z1 = p1[2];
            var x2 = p2[0], y2 = p2[1], z2 = p2[2];
            var x3 = p3[0], y3 = p3[1], z3 = p3[2];

            var len = (vec3.dist(p0, p1) + vec3.len(p2, p1) + vec3.len(p3, p2));
            var step = 1 / (len + 1) * 15;

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

            var positionArr = this.attributes.position.value;
            var colorArr = this.attributes.color.value;
            var offset = positionArr.length;
            var len = 0;
            var t = 0;
            while (t < 1 + step) {
                if (len > 1) {
                    positionArr.push(positionArr[offset + len - 1]);
                    colorArr.push(colorArr[offset + len - 1]);
                    len++;
                }
                positionArr.push(vec3.fromValues(fx, fy, fz));
                colorArr.push(color);
                len++;

                fx += dfx; fy += dfy; fz += dfz;
                dfx += ddfx; dfy += ddfy; dfz += ddfz;
                ddfx += dddfx; ddfy += dddfy; ddfz += dddfz;
                t += step;
            }
        }

        // http://antigrain.com/research/adaptive_bezier/#toc0002
        // addCubicCurve: function (p0, p1, p2, p3, color) {
        //     p0 = p0._array; p1 = p1._array; p2 = p2._array; p3 = p3._array;
        //     this._recurviseSubdivideAndAddCubic(
        //         p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], color, 0
        //     );
        // },

        // _recurviseSubdivideAndAddCubic: function (x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, color, level) {
        //     var d = (x3 - x0) * (x1 - x0) + (y3 - y0) * (y1 - y0) + (z3 - z0) * (z1 - z0);
        //     var d2 = (x0 - x3) * (x2 - x3) + (y0 - y3) * (y2 - y3) + (z0 - z3) * (z2 - z3);
        //     if (
        //         // Curve is collinear
        //         d < CURVE_COLLINEAR_EPSILON && d >= 0 && d2 < CURVE_COLLINEAR_EPSILON && d2 > 0
        //         // Stop recursion
        //         || (level >= CURVE_RECURSION_LIMIT)
        //     ) {
        //         var positionArr = this.attributes.position.value;
        //         var colorArr = this.attributes.color.value;
        //         positionArr.push(vec3.fromValues(x0, y0, z0));
        //         positionArr.push(vec3.fromValues(x3, y3, z3));
        //         colorArr.push(color);
        //         colorArr.push(color);
        //     } else {
        //         var x01 = (x0 + x1) * 0.5;
        //         var y01 = (y0 + y1) * 0.5;
        //         var z01 = (z0 + z1) * 0.5;

        //         var x12 = (x1 + x2) * 0.5;
        //         var y12 = (y1 + y2) * 0.5;
        //         var z12 = (z1 + z2) * 0.5;

        //         var x23 = (x2 + x3) * 0.5;
        //         var y23 = (y2 + y3) * 0.5;
        //         var z23 = (z2 + z3) * 0.5;

        //         var x012 = (x01 + x12) * 0.5;
        //         var y012 = (y01 + y12) * 0.5;
        //         var z012 = (z01 + z12) * 0.5;

        //         var x123 = (x12 + x23) * 0.5;
        //         var y123 = (y12 + y23) * 0.5;
        //         var z123 = (z12 + z23) * 0.5;

        //         var x0123 = (x012 + x123) * 0.5;
        //         var y0123 = (y012 + y123) * 0.5;
        //         var z0123 = (z012 + z123) * 0.5;

        //         this._recurviseSubdivideAndAddCubic(
        //             x0, y0, z0, x01, y01, z01, x012, y012, z012, x0123, y0123, z0123,
        //             color, level + 1
        //         );
        //         this._recurviseSubdivideAndAddCubic(
        //             x0123, y0123, z0123, x123, y123, z123, x23, y23, z23, x3, y3, z3,
        //             color, level + 1
        //         );
        //     }
        // }
    })

    return LinesGeometry;
});