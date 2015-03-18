/**
 * Geometry collecting sprites
 * 
 * @module echarts-x/util/geometry/Sprites
 * @author Yi Shen(https://github.com/pissang)
 */
define(function (require) {

    var DynamicGeometry = require('qtek/DynamicGeometry');
    var vec3 = require('qtek/dep/glmatrix').vec3;
    var vec2 = require('qtek/dep/glmatrix').vec2;
    var fromValues = vec3.fromValues;

    function getSquarePositions(w, h) {
        return [
            fromValues(-w, -h, 0), 
            fromValues(w, -h, 0), 
            fromValues(w, h, 0),
            fromValues(-w, h, 0)
        ];
    }

    var squareFaces = [
        [0, 1, 2], [0, 2, 3]
    ];

    var SpritesGeometry = DynamicGeometry.derive({
    }, {
        clearSprites: function () {
            var attributes = this.attributes;
            attributes.position.value.length = 0;
            attributes.texcoord0.value.length = 0;
        },

        /**
         * Add sprite
         * @param {qtek.math.Matrix4} Sprite transform matrix
         * @param {Array} up Sprite left up and right bottom texture coords
         */
        addSprite: function (matrix, coords) {
            var nVertexBase = this.getVertexNumber();
            for (var i = 0; i < squareFaces.length; i++) {
                var face = Array.prototype.slice.call(squareFaces[i]);
                face[0] += nVertexBase;
                face[1] += nVertexBase;
                face[2] += nVertexBase;
                this.faces.push(face);
            }

            // Scale width to avoid stretch artifacts
            // FIXME If height > width
            var scaling = (coords[1][0] - coords[0][0]) / (coords[1][1] - coords[0][1]);

            var squarePositions = getSquarePositions(scaling, 1);

            for (var i = 0; i < squarePositions.length; i++) {
                var pos = squarePositions[i];
                vec3.transformMat4(pos, pos, matrix._array);
                this.attributes.position.value.push(pos);
            }

            var texcoord0 = this.attributes.texcoord0.value;
            var create = vec2.fromValues;
            // Left bottom
            texcoord0.push(create(coords[0][0], coords[1][1]));
            // Right bottom
            texcoord0.push(create(coords[1][0], coords[1][1]));
            // Right top
            texcoord0.push(create(coords[1][0], coords[0][1]));
            // Left top
            texcoord0.push(create(coords[0][0], coords[0][1]));
        }
    });

    return SpritesGeometry;
});