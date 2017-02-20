/**
 * Geometry collecting bars data
 *
 * @module echarts-gl/chart/bars/BarsGeometry
 * @author Yi Shen(http://github.com/pissang)
 */

var StaticGeometry = require('qtek/lib/StaticGeometry');

var glMatrix = require('qtek/lib/dep/glmatrix');
var vec3 = glMatrix.vec3;

/**
 * @constructor
 * @alias module:echarts-gl/chart/bars/BarsGeometry
 * @extends qtek.StaticGeometry
 */
var BarsGeometry = StaticGeometry.extend(function () {
    return {

        attributes: {
            position: new StaticGeometry.Attribute('position', 'float', 3, 'POSITION'),
            normal: new StaticGeometry.Attribute('normal', 'float', 3, 'NORMAL'),
            color: new StaticGeometry.Attribute('color', 'float', 4, 'COLOR')
        },
        _vertexOffset: 0,
        _faceOffset: 0
    };
},
/** @lends module:echarts-gl/chart/bars/BarsGeometry.prototype */
{

    resetOffset: function () {
        this._vertexOffset = 0;
        this._faceOffset = 0;
    },

    setBarCount: function (barCount, enableNormal) {
        var vertexCount = this.getBarVertexCount(enableNormal) * barCount;
        var faceCount = this.getBarFaceCount(enableNormal) * barCount;

        if (this.vertexCount !== vertexCount) {
            this.attributes.position.init(vertexCount);
            if (enableNormal) {
                this.attributes.normal.init(vertexCount);
            }
            else {
                this.attributes.normal.value = null;
            }
            this.attributes.color.init(vertexCount);
        }

        if (this.faceCount !== faceCount) {
            this.faces = vertexCount > 0xffff ? new Uint32Array(faceCount * 3) : new Uint16Array(faceCount * 3);
        }

        this._enableNormal = enableNormal;
    },

    getBarVertexCount: function (enableNormal) {
        return enableNormal ? 24 : 8;
    },

    getBarFaceCount: function () {
        return 12;
    },

    /**
     * Add a bar
     * @param {Array.<number>} start
     * @param {Array.<number>} end
     * @param {Array.<number>} orient  right direction
     * @param {Array.<number>} size size on x and z
     * @param {Array.<number>} color
     */
    addBar: (function () {
        var v3Create = vec3.create;
        var v3ScaleAndAdd = vec3.scaleAndAdd;

        var px = v3Create();
        var py = v3Create();
        var pz = v3Create();
        var nx = v3Create();
        var ny = v3Create();
        var nz = v3Create();

        var pts = [];
        var normals = [];
        for (var i = 0; i < 8; i++) {
            pts[i] = v3Create();
        }

        var cubeFaces4 = [
            // PX
            [0, 1, 5, 4],
            // NX
            [2, 3, 7, 6],
            // PY
            [4, 5, 6, 7],
            // NY
            [3, 2, 1, 0],
            // PZ
            [0, 4, 7, 3],
            // NZ
            [1, 2, 6, 5]
        ];
        var face4To3 = [
            0, 1, 2, 0, 2, 3
        ];
        var cubeFaces3 = [];
        for (var i = 0; i < cubeFaces4.length; i++) {
            var face4 = cubeFaces4[i];
            for (var j = 0; j < 2; j++) {
                var face = [];
                for (var k = 0; k < 3; k++) {
                    face.push(face4[face4To3[j * 3 + k]]);
                }
                cubeFaces3.push(face);
            }
        }
        return function (start, end, orient, size, color) {
            vec3.sub(py, end, start);
            vec3.normalize(py, py);
            // x * y => z
            vec3.cross(pz, orient, py);
            vec3.normalize(pz, pz);
            // y * z => x
            vec3.cross(px, py, pz);
            vec3.normalize(pz, pz);

            vec3.negate(nx, px);
            vec3.negate(ny, py);
            vec3.negate(nz, pz);

            v3ScaleAndAdd(pts[0], start, px, size[0] / 2);
            v3ScaleAndAdd(pts[0], pts[0], pz, size[1] / 2);
            v3ScaleAndAdd(pts[1], start, px, size[0] / 2);
            v3ScaleAndAdd(pts[1], pts[1], nz, size[1] / 2);
            v3ScaleAndAdd(pts[2], start, nx, size[0] / 2);
            v3ScaleAndAdd(pts[2], pts[2], nz, size[1] / 2);
            v3ScaleAndAdd(pts[3], start, nx, size[0] / 2);
            v3ScaleAndAdd(pts[3], pts[3], pz, size[1] / 2);

            v3ScaleAndAdd(pts[4], end, px, size[0] / 2);
            v3ScaleAndAdd(pts[4], pts[4], pz, size[1] / 2);
            v3ScaleAndAdd(pts[5], end, px, size[0] / 2);
            v3ScaleAndAdd(pts[5], pts[5], nz, size[1] / 2);
            v3ScaleAndAdd(pts[6], end, nx, size[0] / 2);
            v3ScaleAndAdd(pts[6], pts[6], nz, size[1] / 2);
            v3ScaleAndAdd(pts[7], end, nx, size[0] / 2);
            v3ScaleAndAdd(pts[7], pts[7], pz, size[1] / 2);

            var attributes = this.attributes;
            if (this._enableNormal) {
                normals[0] = px;
                normals[1] = nx;
                normals[2] = py;
                normals[3] = ny;
                normals[4] = pz;
                normals[5] = nz;

                var vertexOffset = this._vertexOffset;
                for (var i = 0; i < cubeFaces4.length; i++) {
                    var idx3 = this._faceOffset * 3;
                    for (var k = 0; k < 6; k++) {
                        this.faces[idx3++] = vertexOffset + face4To3[k];
                    }
                    vertexOffset += 4;
                    this._faceOffset += 2;
                }

                for (var i = 0; i < cubeFaces4.length; i++) {
                    var normal = normals[i];
                    for (var k = 0; k < 4; k++) {
                        var idx = cubeFaces4[i][k];
                        attributes.position.set(this._vertexOffset, pts[idx]);
                        attributes.normal.set(this._vertexOffset, normal);
                        attributes.color.set(this._vertexOffset++, color);
                    }
                }
            }
            else {
                for (var i = 0; i < cubeFaces3.length; i++) {
                    var idx3 = this._faceOffset * 3;
                    for (var k = 0; k < 3; k++) {
                        this.faces[idx3 + k] = cubeFaces3[i][k] + this._vertexOffset;
                    }
                    this._faceOffset++;
                }

                for (var i = 0; i < pts.length; i++) {
                    attributes.position.set(this._vertexOffset, pts[i]);
                    attributes.color.set(this._vertexOffset++, color);
                }
            }
        };
    })()
});

module.exports = BarsGeometry;