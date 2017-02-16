/**
 * Lines geometry
 * Use screen space projected lines lineWidth > MAX_LINE_WIDTH
 * https://mattdesl.svbtle.com/drawing-lines-is-hard
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

        /**
         * Need to use mesh to expand lines if lineWidth > MAX_LINE_WIDTH
         */
        useNativeLine: true,

        attributes: {
            position: new StaticGeometry.Attribute('position', 'float', 3, 'POSITION'),
            positionPrev: new StaticGeometry.Attribute('normal', 'float', 3),
            positionNext: new StaticGeometry.Attribute('normal', 'float', 3),
            offset: new StaticGeometry.Attribute('normal', 'float', 1),
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
        this._vertexOffset = 0;
        this._faceOffset = 0;
    },

    /**
     * @param {number} nVertex
     */
    setVertexCount: function (nVertex) {
        var attributes = this.attributes;
        if (this.vertexCount !== nVertex) {
            attributes.position.init(nVertex);
            attributes.color.init(nVertex);

            if (!this.useNativeLine) {
                attributes.positionPrev.init(nVertex);
                attributes.positionNext.init(nVertex);
                attributes.offset.init(nVertex);
            }

            this._vertexOffset = 0;

            if (nVertex > 0xffff) {
                if (this.faces instanceof Uint16Array) {
                    this.faces = new Uint32Array(this.faces);
                }
            }
            else {
                if (this.faces instanceof Uint32Array) {
                    this.faces = new Uint16Array(this.faces);
                }
            }
        }
    },

    /**
     * @param {number} nFace
     */
    setFaceCount: function (nFace) {
        if (this.faceCount !== nFace) {
            if (nFace === 0) {
                this.faces = null;
            }
            else {
                this.faces = this.vertexCount > 0xffff ? new Uint32Array(nFace * 3) : new Uint16Array(nFace * 3);
            }
        }
    },

    _getCubicCurveApproxStep: function (p0, p1, p2, p3) {
        var len = vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2);
        var step = 1 / (len + 1) * this.segmentScale;
        return step;
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
        var step = this._getCubicCurveApproxStep(p0, p1, p2, p3);
        var segCount = Math.ceil(1 / step);
        if (!this.useNativeLine) {
            return segCount * 2 + 2;
        }
        else {
            return segCount * 2;
        }
    },

    /**
     * Get face count of cubic curve
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} p2
     * @param {Array.<number>} p3
     * @return number
     */
    getCubicCurveFaceCount: function (p0, p1, p2, p3) {
        var step = this._getCubicCurveApproxStep(p0, p1, p2, p3);
        var segCount = Math.ceil(1 / step);
        if (!this.useNativeLine) {
            return segCount * 2;
        }
        else {
            return 0;
        }
    },

    /**
     * Get vertex count of line
     * @return {number}
     */
    getLineVertexCount: function () {
        return !this.useNativeLine ? 4 : 2;
    },

    /**
     * Get face count of line
     * @return {number}
     */
    getLineFaceCount: function () {
        return !this.useNativeLine ? 2 : 0;
    },
    /**
     * Add a cubic curve
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} p2
     * @param {Array.<number>} p3
     * @param {Array.<number>} color
     * @param {number} [lineWidth=1]
     */
    addCubicCurve: function (p0, p1, p2, p3, color, lineWidth) {
        if (lineWidth == null) {
            lineWidth = 1;
        }
        // incremental interpolation
        // http://antigrain.com/research/bezier_interpolation/index.html#PAGE_BEZIER_INTERPOLATION
        var x0 = p0[0], y0 = p0[1], z0 = p0[2];
        var x1 = p1[0], y1 = p1[1], z1 = p1[2];
        var x2 = p2[0], y2 = p2[1], z2 = p2[2];
        var x3 = p3[0], y3 = p3[1], z3 = p3[2];

        var step = this._getCubicCurveApproxStep(p0, p1, p2, p3);

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
        var positionPrevAttr = this.attributes.positionPrev;
        var positionNextAttr = this.attributes.positionNext;
        var colorAttr = this.attributes.color;
        var offsetAttr = this.attributes.offset;
        var t = 0;
        var posTmp = [];

        var k = 0;
        var segCount = Math.ceil(1 / step);

        var iterCount = !this.useNativeLine ? (segCount + 1) : segCount;
        var vertexOffset = this._vertexOffset;
        for (var k = 0; k < iterCount; k++) {
            posTmp[0] = fx; posTmp[1] = fy; posTmp[2] = fz;
            if (!this.useNativeLine) {
                if (k < iterCount - 1) {
                    positionPrevAttr.set(vertexOffset + 2, posTmp);
                    positionPrevAttr.set(vertexOffset + 3, posTmp);
                }
                if (k > 0) {
                    positionNextAttr.set(vertexOffset - 2, posTmp);
                    positionNextAttr.set(vertexOffset - 1, posTmp);
                }

                positionAttr.set(vertexOffset, posTmp);
                positionAttr.set(vertexOffset + 1, posTmp);

                colorAttr.set(vertexOffset, color);
                colorAttr.set(vertexOffset + 1, color);

                offsetAttr.set(vertexOffset, lineWidth / 2);
                offsetAttr.set(vertexOffset + 1, -lineWidth / 2);

                vertexOffset += 2;
            }
            else {
                if (k > 0) {
                    positionAttr.copy(vertexOffset, vertexOffset - 1);
                    colorAttr.copy(vertexOffset, vertexOffset - 1);
                }
                else {
                    colorAttr.set(vertexOffset, color);
                    positionAttr.set(vertexOffset, posTmp);
                }
                vertexOffset++;
            }

            fx += dfx; fy += dfy; fz += dfz;
            dfx += ddfx; dfy += ddfy; dfz += ddfz;
            ddfx += dddfx; ddfy += dddfy; ddfz += dddfz;
            t += step;

            posTmp[0] = fx; posTmp[1] = fy; posTmp[2] = fz;

            if (!this.useNativeLine) {
                if (k > 0) {
                    var idx3 = this._faceOffset * 3;
                    var faces = this.faces;
                    // 0-----2
                    // 1-----3
                    // 0->1->2, 1->3->2
                    faces[idx3] = vertexOffset - 4;
                    faces[idx3 + 1] = vertexOffset - 3;
                    faces[idx3 + 2] = vertexOffset - 2;

                    faces[idx3 + 3] = vertexOffset - 3;
                    faces[idx3 + 4] = vertexOffset - 1;
                    faces[idx3 + 5] = vertexOffset - 2;

                    this._faceOffset += 2;
                }
            }
            else {
                colorAttr.set(vertexOffset, color);
                positionAttr.set(vertexOffset, posTmp);
                vertexOffset++;
            }
        }
        if (!this.useNativeLine) {

            var start = this._vertexOffset;
            // PENDING
            var end = this._vertexOffset + segCount * 2;
            positionPrevAttr.copy(start, start + 2);
            positionPrevAttr.copy(start + 1, start + 3);
            positionNextAttr.copy(end - 1, end - 3);
            positionNextAttr.copy(end - 2, end - 4);
        }

        this._vertexOffset = vertexOffset;
    },

    /**
     * Add a straight line
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} color
     */
    addLine: function (p0, p1, color) {

        var positionAttr = this.attributes.position;
        var positionPrevAttr = this.attributes.positionPrev;
        var positionNextAttr = this.attributes.positionNext;
        var colorAttr = this.attributes.color;
        var offsetAttr = this.attributes.offset;

        if (!this.useNativeLine) {
            for (var i = 0; i < 4; i++) {
                positionAttr.set(this._vertexOffset + i, i < 2 ? p0 : p1);
                colorAttr.set(this._vertexOffset + i, color);
            }
        }
        else {

            positionAttr.set(this._vertexOffset, p0);
            positionAttr.set(this._vertexOffset + 1, p1);

            colorAttr.set(this._vertexOffset, color);
            colorAttr.set(this._vertexOffset + 1, color);

            this._vertexOffset += 2;
        }

    },

    addPolyline: function (points) {}
});

module.exports = LinesGeometry;