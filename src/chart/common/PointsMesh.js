var graphicGL = require('../../util/graphicGL');
var verticesSortMixin = require('../../util/geometry/verticesSortMixin');
var echarts = require('echarts/lib/echarts');
var glmatrix = require('qtek/lib/dep/glmatrix');
var vec4 = glmatrix.vec4;

graphicGL.Shader.import(require('text!./sdfSprite.glsl'));

var PointsMesh = graphicGL.Mesh.extend(function () {
    var geometry = new graphicGL.Geometry({
        dynamic: true
    });
    echarts.util.extend(geometry, verticesSortMixin);
    geometry.createAttribute('color', 'float', 4, 'COLOR');
    geometry.createAttribute('strokeColor', 'float', 4);
    geometry.createAttribute('size', 'float', 1);

    var material = new graphicGL.Material({
        shader: graphicGL.createShader('ecgl.sdfSprite'),
        transparent: true,
        depthMask: false
    });
    material.shader.enableTexture('sprite');
    material.shader.define('both', 'VERTEX_COLOR');

    var sdfTexture = new graphicGL.Texture2D({
        image: document.createElement('canvas'),
        flipY: false
    });
    material.set('sprite', sdfTexture);

    // Custom pick methods.
    geometry.pick = this._pick.bind(this);

    return {
        geometry: geometry,
        material: material,
        mode: graphicGL.Mesh.POINTS,

        sizeScale: 1
    };
}, {

    _pick: function (x, y, renderable, out) {
        var positionScreen = this._positionScreen;
        if (!positionScreen) {
            return;
        }

        // From near to far. indices have been sorted.
        for (var i = this.geometry.vertexCount - 1; i >= 0; i--) {
            var idx = this.geometry.indices[i];

            var cx = positionScreen[idx * 2];
            var cy = positionScreen[idx * 2 + 1];

            var size = this.geometry.attributes.size.get(idx) / this.sizeScale;
            var halfSize = size / 2;

            if (
                x > (cx - halfSize) && x < (cx + halfSize)
                && y > (cy - halfSize) && y < (cy + halfSize)
            ) {
                out.push({
                    vertexIndex: idx,
                    target: renderable
                });
            }
        }
    },

    updateScreenPosition: function (worldViewProjection, is2D, api) {
        var positionScreen = this._positionScreen;
        var geometry = this.geometry;
        if (!positionScreen || positionScreen.length / 2 !== geometry.vertexCount) {
            positionScreen = this._positionScreen = new Float32Array(geometry.vertexCount * 2);
        }

        if (!is2D) {
            var width = api.getWidth();
            var height = api.getHeight();

            var pos = vec4.create();
            for (var i = 0; i < geometry.vertexCount; i++) {
                geometry.attributes.position.get(i, pos);
                pos[3] = 1;
                vec4.transformMat4(pos, pos, worldViewProjection._array);
                vec4.scale(pos, pos, 1 / pos[3]);

                var x = pos[0] * 0.5 + 0.5;
                // Flip Y
                var y = -pos[1] * 0.5 + 0.5;
                positionScreen[i * 2] = x * width;
                positionScreen[i * 2 + 1] = y * height;
            }
        }
        else {
            for (var i = 0; i < geometry.vertexCount; i++) {
                positionScreen[i * 2] = geometry.attributes.position.value[i * 3];
                positionScreen[i * 2 + 1] = geometry.attributes.position.value[i * 3 + 1];
            }
        }
    }
});

module.exports = PointsMesh;