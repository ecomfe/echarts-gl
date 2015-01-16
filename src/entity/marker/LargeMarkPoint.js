/**
 * Large scale markPoint rendering with point cloud
 * 
 * @module echarts-x/entity/marker/LargeMarkPoint
 * @author Yi Shen(https://github.com/pissang)
 */

define(function (require) {
    
    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Renderable = require('qtek/Renderable');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Node = require('qtek/Node');
    var PointsGeometry = require('../../util/geometry/Points');
    var AnimatingPointsGeometry = require('../../util/geometry/AnimatingPoints');
    var Texture2D = require('qtek/Texture2D');
    var spriteUtil = require('../../util/sprite');
    var Vector3 = require('qtek/math/Vector3');
    var IconShape = require('echarts/util/shape/Icon');

    /**
     * @constructor
     * @alias module:echarts-x/entity/marker/LargeMarkPoint
     * @extends module:echarts-x/entity/marker/Base
     * @param {module:echarts-x/chart/base3d} chart
     */
    var LargeMarkPoint = function (chart) {

        MarkBase.call(this, chart);

        /**
         * Root scene node
         * @type {qtek.Node}
         * @private
         */
        this._sceneNode = new Node();

        /**
         * @type {qtek.Renderable}
         * @private
         */
        this._markPointRenderable = null;
        /**
         * @type {qtek.Renderable}
         * @private
         */
        this._animatingMarkPointRenderable = null;

        /**
         * @type {qtek.texture.Texture2D}
         * @private
         */
        this._spriteTexture = null;

        /**
         * @type {number}
         * @private
         */
        this._elapsedTime = 0;
    };

    LargeMarkPoint.prototype = {
        
        constructor: LargeMarkPoint,

        _createMarkPointRenderable: function () {
            var mat = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.points.vertex'),
                    fragment: Shader.source('ecx.points.fragment')
                }),
                depthMask: false,
                transparent: true
            });
            mat.shader.enableTexture('sprite');

            this._markPointRenderable = new Renderable({
                geometry: new PointsGeometry(),
                material: mat,
                mode: Renderable.POINTS
            });

            if (this._spriteTexture) {
                mat.set('sprite', this._spriteTexture);
            }

            this._sceneNode.add(this._markPointRenderable);
        },

        _createAnimatingMarkPointRenderable: function () {
            var mat = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.points.vertex'),
                    fragment: Shader.source('ecx.points.fragment')
                }),
                depthMask: false,
                transparent: true
            });
            mat.shader.enableTexture('sprite');
            mat.shader.define('vertex', 'ANIMATING');

            this._animatingMarkPointRenderable = new Renderable({
                geometry: new AnimatingPointsGeometry(),
                material: mat,
                mode: Renderable.POINTS
            });

            if (this._spriteTexture) {
                mat.set('sprite', this._spriteTexture);
            }

            this._sceneNode.add(this._animatingMarkPointRenderable);
        },

        _updateSpriteTexture: function (size, shape) {
            if (! this._spriteTexture) {
                this._spriteTexture = new Texture2D({
                    flipY: false
                });
            }
            var spriteTexture = this._spriteTexture;
            spriteTexture.image = spriteUtil.makeSpriteFromShape(
                size, shape, spriteTexture.image
            );
            spriteTexture.dirty();
        },

        // Implement clear
        clear: function () {
            if (this._markPointRenderable) {
                this._markPointRenderable.geometry.clearPoints();
            }
            if (this._animatingMarkPointRenderable) {
                this._animatingMarkPointRenderable.geometry.clearPoints();
            }

            this._elapsedTime = 0;
        },

        // Implement setSeries
        setSeries: function (serie, seriesIndex) {
            if (! serie.markPoint || ! serie.markPoint.data) {
                return;
            }
            this.seriesIndex = seriesIndex;

            var chart = this.chart;
            var component = chart.component;
            var legend = component.legend;
            var dataRange = component.dataRange;
            var markPoint = serie.markPoint;
            var zr = chart.zr;

            var symbol = chart.query(markPoint, 'symbol')
            var showMarkPointEffect = chart.query(markPoint, 'effect.show');
            // Shadow blur scale from 0 - 1
            var shadowBlur = chart.query(markPoint, 'effect.shadowBlur') || 0;

            var shape = new IconShape({
                style: {
                    x: 0,
                    y: 0,
                    width: 128,
                    height: 128,
                    iconType: symbol,
                    color: 'white',
                    shadowBlur: shadowBlur * 128,
                    shadowColor: 'white'
                }
            });
            this._updateSpriteTexture(128, shape);

            if (showMarkPointEffect) {
                if (! this._animatingMarkPointRenderable) {
                    this._createAnimatingMarkPointRenderable();
                }
                this._animatingMarkPointRenderable.geometry.dirty();
            } else {
                if (! this._markPointRenderable) {
                    this._createMarkPointRenderable();
                }
                this._markPointRenderable.geometry.dirty();
            }

            var dataList = markPoint.data;

            var serieColor;
            if (legend) {
                serieColor = legend.getColor(serie.name);
            }
            serieColor = chart.query(markPoint, 'itemStyle.normal.color') || serieColor;
            var serieDefaultColor = chart.zr.getColor(seriesIndex);

            var globalSize = chart.query(markPoint, 'symbolSize') || 2;

            for (var i = 0; i < dataList.length; i++) {
                var dataItem = dataList[i];
                var value = chart.getDataFromOption(dataItem, null);

                var dataRangeColor = null;
                if (dataRange) {
                    dataRangeColor = isNaN(value) ? color : dataRange.getColor(value);
                    // Hide the mark if dataRange is enabled and return null from the given value
                    if (dataRangeColor == null) {
                        continue;
                    }
                }
                var itemColor = chart.query(dataItem, 'itemStyle.normal.color');

                // 0. Use the color of itemStyle in single data
                // 1. Use the color provided by data range component
                // 2. Color in user customized itemStyle
                // 3. Use the color provided by legend component
                // 4. Use series default color
                var color = itemColor || dataRangeColor || serieColor || serieDefaultColor;
                if (typeof(color) == 'function') {
                    color = color(dataItem);
                }
                var colorArr = chart.parseColor(color) || new Float32Array(4);

                var size = dataItem.symbolSize == null ? globalSize : dataItem.symbolSize;
                if (typeof(size) == 'function') {
                    size = size(dataItem);
                }
                size *= window.devicePixelRatio || 1;

                var coord = new Vector3();
                chart.getMarkCoord(seriesIndex, dataItem, coord);
                if (showMarkPointEffect) {
                    this._animatingMarkPointRenderable.geometry.addPoint(
                        coord, colorArr, size, Math.random() * 2
                    );
                } else {
                    this._markPointRenderable.geometry.addPoint(coord, colorArr, size);
                }
            }
        },

        // Implement getSceneNode
        getSceneNode: function () {
            return this._sceneNode;
        },

        // Implement onframe
        onframe: function (deltaTime) {
            if (this._animatingMarkPointRenderable) {
                var renderable = this._animatingMarkPointRenderable;
                // Have markpoint animation
                if (renderable.geometry.getVertexNumber() > 0) {
                    this._elapsedTime += deltaTime / 1000;
                    renderable.material.set('elapsedTime', this._elapsedTime);
                    this.chart.zr.refreshNextFrame();
                }
            }
        }
    };

    zrUtil.inherits(LargeMarkPoint, MarkBase);

    return LargeMarkPoint;
});