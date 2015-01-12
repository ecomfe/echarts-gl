define(function (require) {
    
    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Mesh = require('qtek/Mesh');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Node = require('qtek/Node');
    var LinesGeometry = require('../../util/geometry/Lines');
    var CurveAnimatingPointsGeometry = require('../../util/geometry/CurveAnimatingPoints');
    var Texture2D = require('qtek/texture/Texture2D');
    var spriteUtil = require('../../util/sprite');
    var Vector3 = require('qtek/math/Vector3');

    var MarkLine = function (chart) {
        MarkBase.call(this, chart);

        this._sceneNode = new Node();

        this._markLineMesh = null;
        this._curveAnimatingPointsMesh = null;

        this._elapsedTime = 0;
    };

    MarkLine.prototype = {
        
        constructor: MarkLine,

        _createMarkLineMesh: function () {
            var material = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.albedo.vertex'),
                    fragment: Shader.source('ecx.albedo.fragment')
                }),
                transparent: true,
                depthMask: false
            });
            material.shader.define('both', 'VERTEX_COLOR');
            this._markLineMesh = new Mesh({
                geometry: new LinesGeometry(),
                material: material,
                mode: Mesh.LINES
            });
            this._sceneNode.add(this._markLineMesh);
        },

        _createCurveAnimatingPointsMesh: function () {
            var material = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.curveAnimatingPoints.vertex'),
                    fragment: Shader.source('ecx.curveAnimatingPoints.fragment')
                })
            });
            this._curveAnimatingPointsMesh = new Mesh({
                material: material,
                mode: Mesh.POINTS,
                geometry: new CurveAnimatingPointsGeometry()
            });
            this._sceneNode.add(this._curveAnimatingPointsMesh);
        },

        setSerie: function (serie, seriesIndex) {
            if (! serie.markLine || !serie.markLine.data) {
                return;
            }
            this.seriesIndex = seriesIndex;

            var chart = this.chart;
            var legend = chart.component.legend;
            var zr = chart.zr;
            var markLine = serie.markLine;
            var devicePixelRatio = window.devicePixelRatio || 1;

            if (! this._markLineMesh) {
                this._createMarkLineMesh();
            }
            var width = chart.query(markLine, 'itemStyle.normal.lineStyle.width');
            var opacity = chart.query(markLine, 'itemStyle.normal.lineStyle.opacity');
            var lineMesh = this._markLineMesh;
            lineMesh.lineWidth = width * devicePixelRatio;
            lineMesh.material.set('alpha', opacity);

            var showMarkLineEffect = chart.query(serie.markLine, 'effect.show');
            var pointsMesh;
            if (showMarkLineEffect) {
                var scaleSize = chart.query(markLine, 'effect.scaleSize');
                if (! this._curveAnimatingPointsMesh) {
                    this._createCurveAnimatingPointsMesh();
                }
                pointsMesh = this._curveAnimatingPointsMesh;
                pointsMesh.material.set(
                    'pointSize', scaleSize * devicePixelRatio
                );
                pointsMesh.geometry.dirty();
            }

            var serieColor;
            if (legend) {
                serieColor = legend.getColor(serie.name);
            }
            serieColor = chart.query(markLine, 'itemStyle.normal.color');
            var serieDefaultColor = chart.zr.getColor(seriesIndex);

            var dataList = markLine.data;

            for (var i = 0; i < dataList.length; i++) {
                var p0 = new Vector3();
                var p1 = new Vector3();
                var p2 = new Vector3();
                var p3 = new Vector3();
                var dataItem = dataList[i];

                var itemColor = chart.query(dataItem, 'itemStyle.normal.color');
                var color = itemColor || serieColor || serieDefaultColor;
                if (typeof(color) == 'function') {
                    color = color(dataItem);
                }
                var colorArr = chart.parseColor(color) || new Float32Array();

                chart.getMarkLinePoints(seriesIndex, dataItem, p0, p1, p2, p3);

                lineMesh.geometry.addCubicCurve(p0, p1, p2, p3, colorArr);

                if (showMarkLineEffect) {
                    pointsMesh.geometry.addPoint(p0, p1, p2, p3, colorArr);
                }
            }

            lineMesh.geometry.dirty();
        },

        clear: function () {
            this._elapsedTime = 0;
            if (this._markLineMesh) {
                this._markLineMesh.geometry.clearLines();
            }
            if (this._curveAnimatingPointsMesh) {
                this._curveAnimatingPointsMesh.geometry.clearPoints();
            }
        },

        getSceneNode: function () {
            return this._sceneNode;
        },

        onframe: function (deltaTime) {
            var mesh = this._curveAnimatingPointsMesh;
            if (mesh.geometry.getVertexNumber() > 0) {
                this._elapsedTime += deltaTime / 1000;
                // 3 s
                var t = this._elapsedTime / 3;
                t %= 1;
                mesh.material.set('percent', t);

                this.chart.zr.refreshNextFrame();
            }
        }
    };

    zrUtil.inherits(MarkLine, MarkBase);

    return MarkLine;
});