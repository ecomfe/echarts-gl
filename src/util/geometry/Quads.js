/**
 * @module echarts-gl/util/geometry/QuadsGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

import Geometry from 'claygl/src/Geometry';
import echarts from 'echarts/lib/echarts';
import dynamicConvertMixin from './dynamicConvertMixin';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;

/**
 * @constructor
 * @alias module:echarts-gl/util/geometry/QuadsGeometry
 * @extends clay.Geometry
 */

var QuadsGeometry = Geometry.extend(function () {
    return {

        segmentScale: 1,

        /**
         * Need to use mesh to expand lines if lineWidth > MAX_LINE_WIDTH
         */
        useNativeLine: true,

        attributes: {
            position: new Geometry.Attribute('position', 'float', 3, 'POSITION'),
            normal: new Geometry.Attribute('normal', 'float', 3, 'NORMAL'),
            color: new Geometry.Attribute('color', 'float', 4, 'COLOR')
        }
    };
},
/** @lends module: echarts-gl/util/geometry/QuadsGeometry.prototype */
{

    /**
     * Reset offset
     */
    resetOffset: function () {
        this._vertexOffset = 0;
        this._faceOffset = 0;
    },

    /**
     * @param {number} nQuad
     */
    setQuadCount: function (nQuad) {
        var attributes = this.attributes;
        var vertexCount = this.getQuadVertexCount() * nQuad;
        var triangleCount = this.getQuadTriangleCount() * nQuad;
        if (this.vertexCount !== vertexCount) {
            attributes.position.init(vertexCount);
            attributes.normal.init(vertexCount);
            attributes.color.init(vertexCount);
        }
        if (this.triangleCount !== triangleCount) {
            this.indices = vertexCount > 0xffff ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
        }
    },

    getQuadVertexCount: function () {
        return 4;
    },

    getQuadTriangleCount: function () {
        return 2;
    },

    /**
     * Add a quad, which in following order:
     * 0-----1
     * 3-----2
     */
    addQuad: (function () {
        var a = vec3.create();
        var b = vec3.create();
        var normal = vec3.create();
        var indices = [0, 3, 1, 3, 2, 1];
        return function (coords,  color) {
            var positionAttr = this.attributes.position;
            var normalAttr = this.attributes.normal;
            var colorAttr = this.attributes.color;

            vec3.sub(a, coords[1], coords[0]);
            vec3.sub(b, coords[2], coords[1]);
            vec3.cross(normal, a, b);
            vec3.normalize(normal, normal);

            for (var i = 0; i < 4; i++) {
                positionAttr.set(this._vertexOffset + i, coords[i]);
                colorAttr.set(this._vertexOffset + i, color);
                normalAttr.set(this._vertexOffset + i, normal);
            }
            var idx = this._faceOffset * 3;
            for (var i = 0; i < 6; i++) {
                this.indices[idx + i] = indices[i] + this._vertexOffset;
            }
            this._vertexOffset += 4;
            this._faceOffset += 2;
        };
    })()
});

echarts.util.defaults(QuadsGeometry.prototype, dynamicConvertMixin);

export default QuadsGeometry;