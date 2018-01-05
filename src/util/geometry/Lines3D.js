/**
 * Lines geometry
 * Use screen space projected lines lineWidth > MAX_LINE_WIDTH
 * https://mattdesl.svbtle.com/drawing-lines-is-hard
 * @module echarts-gl/util/geometry/LinesGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

import Geometry from 'claygl/src/Geometry';
import echarts from 'echarts/lib/echarts';
import dynamicConvertMixin from './dynamicConvertMixin';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;

// var CURVE_RECURSION_LIMIT = 8;
// var CURVE_COLLINEAR_EPSILON = 40;

var sampleLinePoints = [[0, 0], [1, 1]];
/**
 * @constructor
 * @alias module:echarts-gl/util/geometry/LinesGeometry
 * @extends clay.Geometry
 */

var LinesGeometry = Geometry.extend(function () {
    return {

        segmentScale: 1,

        dynamic: true,
        /**
         * Need to use mesh to expand lines if lineWidth > MAX_LINE_WIDTH
         */
        useNativeLine: true,

        attributes: {
            position: new Geometry.Attribute('position', 'float', 3, 'POSITION'),
            positionPrev: new Geometry.Attribute('positionPrev', 'float', 3),
            positionNext: new Geometry.Attribute('positionNext', 'float', 3),
            prevPositionPrev: new Geometry.Attribute('prevPositionPrev', 'float', 3),
            prevPosition: new Geometry.Attribute('prevPosition', 'float', 3),
            prevPositionNext: new Geometry.Attribute('prevPositionNext', 'float', 3),
            offset: new Geometry.Attribute('offset', 'float', 1),
            color: new Geometry.Attribute('color', 'float', 4, 'COLOR')
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
        this._triangleOffset = 0;

        this._itemVertexOffsets = [];
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
                if (this.indices instanceof Uint16Array) {
                    this.indices = new Uint32Array(this.indices);
                }
            }
            else {
                if (this.indices instanceof Uint32Array) {
                    this.indices = new Uint16Array(this.indices);
                }
            }
        }
    },

    /**
     * @param {number} nTriangle
     */
    setTriangleCount: function (nTriangle) {
        if (this.triangleCount !== nTriangle) {
            if (nTriangle === 0) {
                this.indices = null;
            }
            else {
                this.indices = this.vertexCount > 0xffff ? new Uint32Array(nTriangle * 3) : new Uint16Array(nTriangle * 3);
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
    getCubicCurveTriangleCount: function (p0, p1, p2, p3) {
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
        return this.getPolylineVertexCount(sampleLinePoints);
    },

    /**
     * Get face count of line
     * @return {number}
     */
    getLineTriangleCount: function () {
        return this.getPolylineTriangleCount(sampleLinePoints);
    },

    /**
     * Get how many vertices will polyline take.
     * @type {number|Array} points Can be a 1d/2d list of points, or a number of points amount.
     * @return {number}
     */
    getPolylineVertexCount: function (points) {
        var pointsLen;
        if (typeof points === 'number') {
            pointsLen = points;
        }
        else {
            var is2DArray = typeof points[0] !== 'number';
            pointsLen = is2DArray ? points.length : (points.length / 3);
        }
        return !this.useNativeLine ? ((pointsLen - 1) * 2 + 2) : (pointsLen - 1) * 2;
    },

    /**
     * Get how many triangles will polyline take.
     * @type {number|Array} points Can be a 1d/2d list of points, or a number of points amount.
     * @return {number}
     */
    getPolylineTriangleCount: function (points) {
        var pointsLen;
        if (typeof points === 'number') {
            pointsLen = points;
        }
        else {
            var is2DArray = typeof points[0] !== 'number';
            pointsLen = is2DArray ? points.length : (points.length / 3);
        }
        return !this.useNativeLine ? Math.max(pointsLen - 1, 0) * 2 : 0;
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

            if (t > 1) {
                fx = dfx > 0 ? Math.min(fx, x3) : Math.max(fx, x3);
                fy = dfy > 0 ? Math.min(fy, y3) : Math.max(fy, y3);
                fz = dfz > 0 ? Math.min(fz, z3) : Math.max(fz, z3);
            }
        }

        return this.addPolyline(points, color, lineWidth);
    },

    /**
     * Add a straight line
     * @param {Array.<number>} p0
     * @param {Array.<number>} p1
     * @param {Array.<number>} color
     * @param {number} [lineWidth=1]
     */
    addLine: function (p0, p1, color, lineWidth) {
        return this.addPolyline([p0, p1], color, lineWidth);
    },

    /**
     * Add a straight line
     * @param {Array.<Array> | Array.<number>} points
     * @param {Array.<number> | Array.<Array>} color
     * @param {number} [lineWidth=1]
     * @param {number} [startOffset=0]
     * @param {number} [pointsCount] Default to be amount of points in the first argument
     */
    addPolyline: function (points, color, lineWidth, startOffset, pointsCount) {
        if (!points.length) {
            return;
        }
        var is2DArray = typeof points[0] !== 'number';
        if (pointsCount == null) {
            pointsCount = is2DArray ? points.length : points.length / 3;
        }
        if (pointsCount < 2) {
            return;
        }
        if (startOffset == null) {
            startOffset = 0;
        }
        if (lineWidth == null) {
            lineWidth = 1;
        }

        this._itemVertexOffsets.push(this._vertexOffset);

        var is2DArray = typeof points[0] !== 'number';
        var notSharingColor = is2DArray
            ? typeof color[0] !== 'number'
            : color.length / 4 === pointsCount;

        var positionAttr = this.attributes.position;
        var positionPrevAttr = this.attributes.positionPrev;
        var positionNextAttr = this.attributes.positionNext;
        var colorAttr = this.attributes.color;
        var offsetAttr = this.attributes.offset;
        var indices = this.indices;

        var vertexOffset = this._vertexOffset;
        var point;
        var pointColor;

        lineWidth = Math.max(lineWidth, 0.01);

        for (var k = startOffset; k < pointsCount; k++) {
            if (is2DArray) {
                point = points[k];
                if (notSharingColor) {
                    pointColor = color[k];
                }
                else {
                    pointColor = color;
                }
            }
            else {
                var k3 = k * 3;
                point = point || [];
                point[0] = points[k3];
                point[1] = points[k3 + 1];
                point[2] = points[k3 + 2];

                if (notSharingColor) {
                    var k4 = k * 4;
                    pointColor = pointColor || [];
                    pointColor[0] = color[k4];
                    pointColor[1] = color[k4 + 1];
                    pointColor[2] = color[k4 + 2];
                    pointColor[3] = color[k4 + 3];
                }
                else {
                    pointColor = color;
                }
            }
            if (!this.useNativeLine) {
                if (k < pointsCount - 1) {
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

                colorAttr.set(vertexOffset, pointColor);
                colorAttr.set(vertexOffset + 1, pointColor);

                offsetAttr.set(vertexOffset, lineWidth / 2);
                offsetAttr.set(vertexOffset + 1, -lineWidth / 2);

                vertexOffset += 2;
            }
            else {
                if (k > 1) {
                    positionAttr.copy(vertexOffset, vertexOffset - 1);
                    colorAttr.copy(vertexOffset, vertexOffset - 1);
                    vertexOffset++;
                }
            }

            if (!this.useNativeLine) {
                if (k > 0) {
                    var idx3 = this._triangleOffset * 3;
                    var indices = this.indices;
                    // 0-----2
                    // 1-----3
                    // 0->1->2, 1->3->2
                    indices[idx3] = vertexOffset - 4;
                    indices[idx3 + 1] = vertexOffset - 3;
                    indices[idx3 + 2] = vertexOffset - 2;

                    indices[idx3 + 3] = vertexOffset - 3;
                    indices[idx3 + 4] = vertexOffset - 1;
                    indices[idx3 + 5] = vertexOffset - 2;

                    this._triangleOffset += 2;
                }
            }
            else {
                colorAttr.set(vertexOffset, pointColor);
                positionAttr.set(vertexOffset, point);
                vertexOffset++;
            }
        }
        if (!this.useNativeLine) {
            var start = this._vertexOffset;
            var end = this._vertexOffset + pointsCount * 2;
            positionPrevAttr.copy(start, start + 2);
            positionPrevAttr.copy(start + 1, start + 3);
            positionNextAttr.copy(end - 1, end - 3);
            positionNextAttr.copy(end - 2, end - 4);
        }

        this._vertexOffset = vertexOffset;

        return this._vertexOffset;
    },

    /**
     * Set color of single line.
     */
    setItemColor: function (idx, color) {
        var startOffset = this._itemVertexOffsets[idx];
        var endOffset = idx < this._itemVertexOffsets.length - 1 ? this._itemVertexOffsets[idx + 1] : this._vertexOffset;

        for (var i = startOffset; i < endOffset; i++) {
            this.attributes.color.set(i, color);
        }
        this.dirty('color');
    },

    /**
     * @return {number}
     */
    currentTriangleOffset: function () {
        return this._triangleOffset;
    },

    /**
     * @return {number}
     */
    currentVertexOffset: function () {
        return this._vertexOffset;
    }
});

echarts.util.defaults(LinesGeometry.prototype, dynamicConvertMixin);

export default LinesGeometry;