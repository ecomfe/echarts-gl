var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var LinesGeometry = require('./LinesGeometry');
var CurveAnimatingPointsMesh = require('./CurveAnimatingPointsMesh');

graphicGL.Shader.import(require('text!./shader/lines.glsl'));

module.exports = echarts.extendChartView({

    type: 'lines3D',

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        // TODO Windows chrome not support lineWidth > 1
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

        this._curveAnimatingPointsMesh = new CurveAnimatingPointsMesh();
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

        var curveAnimatingPointsMesh = this._curveAnimatingPointsMesh;
        curveAnimatingPointsMesh.stopAnimation();

        if (seriesModel.get('effect.show')) {
            this.groupGL.add(curveAnimatingPointsMesh);

            curveAnimatingPointsMesh.setScale(coordSys.radius);
            curveAnimatingPointsMesh.setData(data, api);

            var period = seriesModel.get('effect.period') * 1000;
            var delay = curveAnimatingPointsMesh.__percent ? -(period * curveAnimatingPointsMesh.__percent) : 0;
            curveAnimatingPointsMesh.__percent = 0;
            curveAnimatingPointsMesh.animate('', { loop: true })
                .when(period, {
                    __percent: 1
                })
                .delay(delay)
                .during(function () {
                    curveAnimatingPointsMesh.setAnimationPercent(curveAnimatingPointsMesh.__percent);
                })
                .start();
        }
        else {
            this.groupGL.remove(curveAnimatingPointsMesh);
        }

        this._linesMesh.material.blend = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
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
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            var color = data.getItemVisual(idx, 'color');
            var opacity = data.getItemVisual(idx, 'opacity');
            if (opacity == null) {
                opacity = 1;
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