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

    _pick: function (x, y, renderer, camera, renderable, out) {
        var positionNDC = this._positionNDC;
        if (!positionNDC) {
            return;
        }

        var viewport = renderer.viewport;
        var ndcScaleX = 2 / viewport.width;
        var ndcScaleY = 2 / viewport.height;
        // From near to far. indices have been sorted.
        for (var i = this.geometry.vertexCount - 1; i >= 0; i--) {
            var idx;
            if (!this.geometry.indices) {
                idx = i;
            }
            else {
                idx = this.geometry.indices[i];
            }

            var cx = positionNDC[idx * 2];
            var cy = positionNDC[idx * 2 + 1];

            var size = this.geometry.attributes.size.get(idx) / this.sizeScale;
            var halfSize = size / 2;

            if (
                x > (cx - halfSize * ndcScaleX) && x < (cx + halfSize * ndcScaleX)
                && y > (cy - halfSize * ndcScaleY) && y < (cy + halfSize * ndcScaleY)
            ) {
                var point = new graphicGL.Vector3();
                var pointWorld = new graphicGL.Vector3();
                this.geometry.attributes.position.get(idx, point._array);
                graphicGL.Vector3.transformMat4(pointWorld, point, this.worldTransform);
                out.push({
                    vertexIndex: idx,
                    point: point,
                    pointWorld: pointWorld,
                    target: this,
                    distance: pointWorld.distance(camera.getWorldPosition())
                });
            }
        }
    },

    updateNDCPosition: function (worldViewProjection, is2D, api) {
        var positionNDC = this._positionNDC;
        var geometry = this.geometry;
        if (!positionNDC || positionNDC.length / 2 !== geometry.vertexCount) {
            positionNDC = this._positionNDC = new Float32Array(geometry.vertexCount * 2);
        }

        if (!is2D) {
            var pos = vec4.create();
            for (var i = 0; i < geometry.vertexCount; i++) {
                geometry.attributes.position.get(i, pos);
                pos[3] = 1;
                vec4.transformMat4(pos, pos, worldViewProjection._array);
                vec4.scale(pos, pos, 1 / pos[3]);

                positionNDC[i * 2] = pos[0];
                positionNDC[i * 2 + 1] = pos[1];
            }
        }
        else {
            // TODO
            // var width = api.getWidth();
            // var height = api.getHeight();

            // for (var i = 0; i < geometry.vertexCount; i++) {
            //     positionNDC[i * 2] = geometry.attributes.position.value[i * 3];
            //     positionNDC[i * 2 + 1] = geometry.attributes.position.value[i * 3 + 1];
            // }
        }
    }
});

module.exports = PointsMesh;