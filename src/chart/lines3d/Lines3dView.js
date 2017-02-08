var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var LinesGeometry = require('./LinesGeometry');

graphicGL.Shader.import(require('text!./shader/lines.glsl'));

module.exports = echarts.extendChartView({

    type: 'lines3d',

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        this._linesMesh = new graphicGL.Mesh({
            material: new graphicGL.Material({
                shader: new graphicGL.Shader({
                    vertex: graphicGL.Shader.source('ecgl.lines.vertex'),
                    fragment: graphicGL.Shader.source('ecgl.lines.fragment')
                }),
                transparent: true
            }),
            mode: graphicGL.Mesh.LINES,
            geometry: new LinesGeometry({
                dynamic: true
            }),
            ignorePicking: true
        });
    },

    render: function (seriesModel, ecModel, api) {

        this.groupGL.add(this._linesMesh);

        var coordSys = seriesModel.coordinateSystem;
        var data = seriesModel.getData();

        if (coordSys.type === 'globe') {
            var viewGL = coordSys.viewGL;
            viewGL.add(this.groupGL);

            if (data.getLayout('lineType') === 'cubicBezier') {
                this._generateBezierCurvesOnGlobe(seriesModel);
            }
        }

        this._linesMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
            ? function (gl) {
                gl.blendEquation( gl.FUNC_ADD );
                gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
            } : null;
    },

    _generateBezierCurvesOnGlobe: function (seriesModel) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;
        var geometry = this._linesMesh.geometry;
        geometry.segmentScale = coordSys.radius / 20;

        var nVertex = 0;
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            nVertex += geometry.getCubicCurveVertexCount(pts[0], pts[1], pts[2], pts[3]);
        });
        geometry.setVertexCount(nVertex);
        geometry.resetOffset();

        var colorArr = [];
        var opacityAccessPath = ['lineStyle', 'normal', 'opacity'];
        data.each(function (idx) {
            var itemModel = data.getItemModel(idx);
            var pts = data.getItemLayout(idx);
            var color = data.getItemVisual(idx, 'color');
            var opacity = data.getItemVisual(idx, 'opacity');
            if (opacity == null) {
                opacity = itemModel.get(opacityAccessPath);
            }
            colorArr = echarts.color.parse(color, colorArr);
            colorArr[0] /= 255; colorArr[1] /= 255; colorArr[2] /= 255;
            colorArr[3] *= opacity;

            geometry.addCubicCurve(pts[0], pts[1], pts[2], pts[3], colorArr);
        });

        geometry.dirty();
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});