/**
 * Geometry colleting cloud points data
 * Points will move on a cubic curve path
 *
 * @module echarts-gl/chart/lines3D/CurveTrailGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

import Geometry from 'claygl/src/Geometry';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;

/**
 * @constructor
 * @alias module:echarts-gl/chart/lines3D/CurveTrailGeometry
 * @extends clay.Geometry
 */
var CurveTrailGeometry = Geometry.derive(function () {
    return {
        attributes: {
            uv: new Geometry.Attribute('offset', 'float', 2),
            currT: new Geometry.Attribute('offset', 'float', 1),
            start: new Geometry.Attribute('offset', 'float', 1),
            prevT: new Geometry.Attribute('offset', 'float', 1),
            nextT: new Geometry.Attribute('offset', 'float', 1),
            offset: new Geometry.Attribute('offset', 'float', 1),
            color: new Geometry.Attribute('color', 'float', 4, 'COLOR')
        },
        mainAttribute: 'uv',

        scale: 1,

        trailLength: 0.3,

        _vertexOffset: 0,
        _triangleOffset: 0
    };
},
/** @lends module:echarts-gl/chart/lines3D/CurveTrailGeometry.prototype */
{

    reset: function () {
        this._vertexOffset = 0;
        this._triangleOffset = 0;
    },

    setVertexCount: function (vertexCount) {
        if (this.vertexCount !== vertexCount) {
            for (var name in this.attributes) {
                this.attributes[name].init(vertexCount);
            }

            if (vertexCount > 0xffff) {
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

    setTriangleCount: function (triangleCount) {
        if (this.triangleCount !== triangleCount) {
            if (triangleCount === 0) {
                this.indices = null;
            }
            else {
                this.indices = this.vertexCount > 0xffff
                    ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
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
    getCurveVertexCount: function (p0, p1, p2, p3) {
        var len = (vec3.dist(p0, p1) + vec3.dist(p2, p1) + vec3.dist(p3, p2)) * this.trailLength;
        // TODO Remove magic number.
        var count = Math.max(Math.min(Math.round((len + 1) / this.scale * 500), 50), 5);
        return count * 2;
    },

    getCurveTriangleCount: function (p0, p1, p2, p3) {
        var segCount = this.getCurveVertexCount(p0, p1, p2, p3) / 2 - 1;
        return segCount * 2;
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
    addCurveTrail: function (p0, p1, p2, p3, uv, size, color) {
        var attributes = this.attributes;
        var start = Math.random();
        var t = 0;
        var prevT = 0;
        var nextT;
        var count = this.getCurveVertexCount(p0, p1, p2, p3) / 2;
        var offset = this._vertexOffset;
        var alpha = color[3];
        for (var i = 0; i < count; i++) {
            nextT = t - 1 / count * this.trailLength;
            // PENDING
            var fadeOutFactor = 1 - Math.pow(i / count, 2);
            color[3] = Math.max(alpha * fadeOutFactor, 0.0);

            for (var k = 0; k < 2; k++) {
                attributes.currT.set(offset, t);
                attributes.prevT.set(offset, prevT);
                attributes.offset.set(offset, (k * 2 - 1) * size / 2 * fadeOutFactor);
                attributes.color.set(offset, color);
                attributes.uv.set(offset, uv);
                attributes.start.set(offset, start);

                if (i < count - 1) {
                    attributes.nextT.set(offset, nextT);
                }
                else {
                    attributes.nextT.set(offset, t);
                }
                offset++;
            }

            prevT = t;
            t = nextT;

            if (i > 0) {
                var idx3 = this._triangleOffset * 3;
                var indices = this.indices;
                // 0-----2
                // 1-----3
                // 0->1->2, 1->3->2
                indices[idx3] = offset - 4;
                indices[idx3 + 1] = offset - 3;
                indices[idx3 + 2] = offset - 2;

                indices[idx3 + 3] = offset - 3;
                indices[idx3 + 4] = offset - 1;
                indices[idx3 + 5] = offset - 2;

                this._triangleOffset += 2;
            }
        }

        this._vertexOffset = offset;
    }
});

export default CurveTrailGeometry;