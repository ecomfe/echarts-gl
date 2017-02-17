/**
 * Lines geometry
 * Use screen space projected lines lineWidth > MAX_LINE_WIDTH
 * https://mattdesl.svbtle.com/drawing-lines-is-hard
 * @module echarts-gl/util/geometry/LinesGeometry
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
 * @alias module:echarts-gl/util/geometry/LinesGeometry
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
/** @lends module: echarts-gl/util/geometry/LinesGeometry.prototype */
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
        return this.getPolylineVertexCount(2);
    },

    /**
     * Get face count of line
     * @return {number}
     */
    getLineFaceCount: function () {
        return this.getPolylineFaceCount(2);
    },

    getPolylineVertexCount: function (points) {
        return !this.useNativeLine ? ((points.length - 1) * 2 + 2) : (points.length - 1) * 2;
    },

    getPolylineFaceCount: function (points) {
        return !this.useNativeLine ? (points.length - 1) * 2 : 0;
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

        var t = 0;

        var k = 0;
        var segCount = Math.ceil(1 / step);

        var points = new Float32Array((segCount + 1) * 3);
        var points = [];
        var offset = 0;
        for (var k = 0; k < segCount + 1; k++) {
            points[offset++] = fx;
            points[offset++] = fy;
            points[offset++] = fz;

            fx += dfx; fy += dfy; fz += dfz;
            dfx += ddfx; dfy += ddfy; dfz += ddfz;
            ddfx += dddfx; ddfy += dddfy; ddfz += dddfz;
            t += step;
        }

        this.addPolyline(points, color, lineWidth);
    },

    /**
     * Add a straight line
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} color
     * @param {number} [lineWidth=1]
     */
    addLine: function (p0, p1, color, lineWidth) {
        this.addPolyline([p0, p1], color, lineWidth);
    },

    /**
     * Add a straight line
     * @param {Array.<Array> | Array.<number>} points
     * @param {Array.<number>} color
     * @param {number} [lineWidth=1]
     */
    addPolyline: function (points, color, lineWidth) {
        if (!points.length) {
            return;
        }

        var is2DArray = typeof points[0] !== 'number';
        var positionAttr = this.attributes.position;
        var positionPrevAttr = this.attributes.positionPrev;
        var positionNextAttr = this.attributes.positionNext;
        var colorAttr = this.attributes.color;
        var offsetAttr = this.attributes.offset;
        var faces = this.faces;

        if (lineWidth == null) {
            lineWidth = 1;
        }

        var vertexOffset = this._vertexOffset;
        var pointCount = is2DArray ? points.length : points.length / 3;
        var iterCount = !this.useNativeLine ? pointCount : (pointCount - 1);
        var point;
        for (var k = 0; k < iterCount; k++) {
            if (is2DArray) {
                point = points[k];
            }
            else {
                point = point || [];
                point[0] = points[k * 3];
                point[1] = points[k * 3 + 1];
                point[2] = points[k * 3 + 2];
            }
            if (!this.useNativeLine) {
                if (k < iterCount - 1) {
                    // Set to next two points
                    positionPrevAttr.set(vertexOffset + 2, point);
                    positionPrevAttr.set(vertexOffset + 3, point);
                }
                if (k > 0) {
                    // Set to previous two points
                    positionNextAttr.set(vertexOffset - 2, point);
                    positionNextAttr.set(vertexOffset - 1, point);
                }

                positionAttr.set(vertexOffset, point);
                positionAttr.set(vertexOffset + 1, point);

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
                    positionAttr.set(vertexOffset, point);
                }
                vertexOffset++;
            }

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
                positionAttr.set(vertexOffset, point);
                vertexOffset++;
            }
        }
        if (!this.useNativeLine) {
            var start = this._vertexOffset;
            var end = this._vertexOffset + points.length * 2;
            positionPrevAttr.copy(start, start + 2);
            positionPrevAttr.copy(start + 1, start + 3);
            positionNextAttr.copy(end - 1, end - 3);
            positionNextAttr.copy(end - 2, end - 4);
        }

        this._vertexOffset = vertexOffset;
    }
});

echarts.util.defaults(LinesGeometry.prototype, dynamicConvertMixin);

module.exports = LinesGeometry;