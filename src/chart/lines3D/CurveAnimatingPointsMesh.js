var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');

var CurveAnimatingPointsGeometry = require('./CurveAnimatingPointsGeometry');

graphicGL.Shader.import(require('text!./shader/curveAnimatingPoints.glsl'));

module.exports = graphicGL.Mesh.extend(function () {

    return {
        geometry: new CurveAnimatingPointsGeometry({
            dynamic: true
        }),

        material: new graphicGL.Material()
    };
}, {

    setData: function (data) {
        var geometry = this.geometry;
        geometry.reset();

        var vertexCount = 0;
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            vertexCount += geometry.getPointVertexCount(pts[0], pts[1], pts[2], pts[3]);
        });
        geometry.setVertexCount(vertexCount);

        var colorArr = [];
        var opacityAccessPath = ['lineStyle', 'normal', 'opacity'];
        data.each(function (idx) {

        });
    }
});