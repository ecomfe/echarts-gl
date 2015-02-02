/**
 * Mark line rendering
 *
 * @module echarts-x/entity/marker/MarkLine
 * @author Yi Shen(https://github.com/pissang)
 */
define(function (require) {

    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Renderable = require('qtek/Renderable');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Node = require('qtek/Node');
    var LinesGeometry = require('../../util/geometry/Lines');
    var CurveAnimatingPointsGeometry = require('../../util/geometry/CurveAnimatingPoints');
    var Texture2D = require('qtek/Texture2D');
    var Vector3 = require('qtek/math/Vector3');

    /**
     * @constructor
     * @alias module:echarts-x/entity/marker/MarkLine
     * @extends module:echarts-x/entity/marker/Base
     * @param {module:echarts-x/chart/base3d} chart
     */
    var MarkLine = function (chart) {
        MarkBase.call(this, chart);
        /**
         * Root scene node
         * @type {qtek.Node}
         */
        this._sceneNode = new Node();

        /**
         * @type {qtek.Renderable}
         */
        this._markLineRenderable = null;

        /**
         * @type {qtek.Renderable}
         */
        this._curveAnimatingPointsRenderable = null;

        /**
         * @type {number}
         */
        this._elapsedTime = 0;
    };

    MarkLine.prototype = {
        
        constructor: MarkLine,

        _createMarkLineRenderable: function () {
            var material = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.albedo.vertex'),
                    fragment: Shader.source('ecx.albedo.fragment')
                }),
                transparent: true,
                depthMask: false
            });
            material.shader.define('both', 'VERTEX_COLOR');
            this._markLineRenderable = new Renderable({
                geometry: new LinesGeometry(),
                material: material,
                mode: Renderable.LINES
            });
            this._sceneNode.add(this._markLineRenderable);
        },

        _createCurveAnimatingPointsRenderable: function () {
            var material = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.curveAnimatingPoints.vertex'),
                    fragment: Shader.source('ecx.curveAnimatingPoints.fragment')
                })
            });
            this._curveAnimatingPointsRenderable = new Renderable({
                material: material,
                mode: Renderable.POINTS,
                geometry: new CurveAnimatingPointsGeometry()
            });
            this._sceneNode.add(this._curveAnimatingPointsRenderable);
        },

        // Implement setSeries
        setSeries: function (serie, seriesIndex) {
            if (! serie.markLine || !serie.markLine.data) {
                return;
            }
            this.seriesIndex = seriesIndex;

            var chart = this.chart;
            var legend = chart.component.legend;
            var zr = chart.zr;
            var markLine = serie.markLine;
            var devicePixelRatio = window.devicePixelRatio || 1;

            if (! this._markLineRenderable) {
                this._createMarkLineRenderable();
            }
            var width = chart.query(markLine, 'itemStyle.normal.lineStyle.width');
            var opacity = chart.query(markLine, 'itemStyle.normal.lineStyle.opacity');
            var lineRenderable = this._markLineRenderable;
            lineRenderable.lineWidth = width * devicePixelRatio;
            lineRenderable.material.set('alpha', opacity);

            var showMarkLineEffect = chart.query(serie.markLine, 'effect.show');
            var pointsRenderable;
            if (showMarkLineEffect) {
                var scaleSize = chart.query(markLine, 'effect.scaleSize');
                if (! this._curveAnimatingPointsRenderable) {
                    this._createCurveAnimatingPointsRenderable();
                }
                pointsRenderable = this._curveAnimatingPointsRenderable;
                pointsRenderable.material.set(
                    'pointSize', scaleSize * devicePixelRatio
                );
                pointsRenderable.geometry.dirty();
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

                lineRenderable.geometry.addCubicCurve(p0, p1, p2, p3, colorArr);

                if (showMarkLineEffect) {
                    pointsRenderable.geometry.addPoint(p0, p1, p2, p3, colorArr);
                }
            }

            lineRenderable.geometry.dirty();
        },

        clear: function () {
            this._elapsedTime = 0;
            if (this._markLineRenderable) {
                this._markLineRenderable.geometry.clearLines();
            }
            if (this._curveAnimatingPointsRenderable) {
                this._curveAnimatingPointsRenderable.geometry.clearPoints();
            }
        },

        // Implement getSceneNode
        getSceneNode: function () {
            return this._sceneNode;
        },

        // Implement onframe
        onframe: function (deltaTime) {
            var renderable = this._curveAnimatingPointsRenderable;
            if (renderable && renderable.geometry.getVertexNumber() > 0) {
                this._elapsedTime += deltaTime / 1000;
                // 3 s
                var t = this._elapsedTime / 3;
                t %= 1;
                renderable.material.set('percent', t);

                this.chart.zr.refreshNextFrame();
            }
        }
    };

    zrUtil.inherits(MarkLine, MarkBase);

    return MarkLine;
});