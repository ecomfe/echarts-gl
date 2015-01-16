/**
 * Geometry collecting bars data
 * 
 * @module echarts-x/util/geometry/Bars
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {

    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var CubeGeometry = require('qtek/geometry/Cube');
    var Matrix4 = require('qtek/math/Matrix4');
    var Vector3 = require('qtek/math/Vector3');

    var glMatrix = require('qtek/dep/glmatrix');
    var vec3 = glMatrix.vec3;

    var cubePositions = [
        [-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0],
        [-1, -1, -2], [1, -1, -2], [1, 1, -2], [-1, 1, -2]
    ];
    var cubeFaces = [
        // PX
        [1, 5, 6], [1, 6, 2],
        // NX
        [0, 3, 7], [0, 7, 4],
        // PY
        [3, 2, 7], [2, 6, 7],
        // NY
        [1, 4, 5], [1, 0, 4],
        // NZ
        [4, 6, 5], [4, 7, 6]
    ];

    /**
     * @constructor
     * @alias module:echarts-x/util/geometry/Bars
     * @extends qtek.DynamicGeometry
     */
    var BarsGeometry = DynamicGeometry.derive(function () {
        return {
            _barMat: new Matrix4(),
            _barScaleVec: new Vector3()
        }
    },
    /** @lends module:echarts-x/util/geometry/Bars.prototype */
    {
        /**
         * Clear all bars
         */
        clearBars: function () {
            this.attributes.position.value.length = 0;
            this.attributes.color.value.length = 0;
            this.faces.length = 0;
        },

        /**
         * Add a bar
         * @param {qtek.math.Vector3} start 
         * @param {qtek.math.Vector3} end
         * @param {number} size
         * @param {Array.<number>} color
         */
        addBar: function (start, end, size, color) {
            var cubeGeo = this._cubeGeometry;
            var barMat = this._barMat;
            var scaleVec = this._barScaleVec;
            var height = Vector3.dist(start, end);
            if (height <= 0) {
                return;
            }
            Vector3.set(scaleVec, size * 0.5, size * 0.5, height * 0.5);
            Matrix4.identity(barMat);
            Matrix4.lookAt(barMat, start, end, Vector3.UP);
            Matrix4.invert(barMat, barMat);
            Matrix4.scale(barMat, barMat, scaleVec);

            var nVertexBase = this.getVertexNumber();
            for (var i = 0; i < cubeFaces.length; i++) {
                var face = vec3.clone(cubeFaces[i]);
                face[0] += nVertexBase;
                face[1] += nVertexBase;
                face[2] += nVertexBase;
                this.faces.push(face);
            }
            for (var i = 0; i < cubePositions.length; i++) {
                var pos = vec3.clone(cubePositions[i]);
                vec3.transformMat4(pos, pos, barMat._array);
                this.attributes.position.value.push(pos);
                this.attributes.color.value.push(color);
            }
        }
    });
    
    return BarsGeometry;
});