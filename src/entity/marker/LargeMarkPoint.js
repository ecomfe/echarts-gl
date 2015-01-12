define(function (require) {
    
    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Mesh = require('qtek/Mesh');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Node = require('qtek/Node');
    var PointsGeometry = require('../../util/geometry/Points');
    var AnimatingPointsGeometry = require('../../util/geometry/AnimatingPoints');
    var Texture2D = require('qtek/texture/Texture2D');
    var spriteUtil = require('../../util/sprite');
    var Vector3 = require('qtek/math/Vector3');

    var LargeMarkPoint = function (chart) {

        MarkBase.call(this, chart);

        this._sceneNode = new Node();
        this._markPointMesh = null;
        this._animatingMarkPointMesh = null;
        this._spriteTexture = null;

        this._elapsedTime = 0;
    };

    LargeMarkPoint.prototype = {
        
        constructor: LargeMarkPoint,

        _createMarkPointMesh: function () {
            var mat = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.points.vertex'),
                    fragment: Shader.source('ecx.points.fragment')
                }),
                depthMask: false,
                transparent: true
            });
            mat.shader.enableTexture('sprite');

            this._markPointMesh = new Mesh({
                geometry: new PointsGeometry(),
                material: mat,
                mode: Mesh.POINTS
            });

            if (this._spriteTexture) {
                mat.set('sprite', this._spriteTexture);
            }

            this._sceneNode.add(this._markPointMesh);
        },

        _createAnimatingMarkPointMesh: function () {
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

            this._animatingMarkPointMesh = new Mesh({
                geometry: new AnimatingPointsGeometry(),
                material: mat,
                mode: Mesh.POINTS
            });

            if (this._spriteTexture) {
                mat.set('sprite', this._spriteTexture);
            }

            this._sceneNode.add(this._animatingMarkPointMesh);
        },

        _updateSpriteTexture: function (style) {
            if (! this._spriteTexture) {
                this._spriteTexture = new Texture2D();
            }
            var spriteTexture = this._spriteTexture;
            spriteTexture.image = spriteUtil.makeCircle(
                style, spriteTexture.image
            );
            spriteTexture.dirty();
        },

        clear: function () {
            if (this._markPointMesh) {
                this._markPointMesh.geometry.clearPoints();
            }
            if (this._animatingMarkPointMesh) {
                this._animatingMarkPointMesh.geometry.clearPoints();
            }

            this._elapsedTime = 0;
        },

        setSerie: function (serie, seriesIndex) {
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

            var showMarkPointEffect = chart.query(markPoint, 'effect.show');
            this._updateSpriteTexture({
                size: 128,
                color: 'white'
            });

            if (showMarkPointEffect) {
                if (! this._animatingMarkPointMesh) {
                    this._createAnimatingMarkPointMesh();
                }
                this._animatingMarkPointMesh.geometry.dirty();
            } else {
                if (! this._markPointMesh) {
                    this._createMarkPointMesh();
                }
                this._markPointMesh.geometry.dirty();
            }

            var dataList = markPoint.data;

            var serieColor;
            if (legend) {
                serieColor = legend.getColor(serie.name);
            }
            serieColor = chart.query(serie.markBar, 'itemStyle.normal.color') || serieColor;
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
                // 2. Color in user customized itemStyle
                // 1. Use the color provided by data range component
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
                    this._animatingMarkPointMesh.geometry.addPoint(
                        coord, colorArr, size, Math.random() * 2
                    );
                } else {
                    this._markPointMesh.geometry.addPoint(coord, colorArr, size);
                }
            }
        },

        getSceneNode: function () {
            return this._sceneNode;
        },

        onframe: function (deltaTime) {
            if (this._animatingMarkPointMesh) {
                var mesh = this._animatingMarkPointMesh;
                // Have markpoint animation
                if (mesh.geometry.getVertexNumber() > 0) {
                    this._elapsedTime += deltaTime / 1000;
                    mesh.material.set('elapsedTime', this._elapsedTime);
                    this.chart.zr.refreshNextFrame();
                }
            }
        }
    };

    zrUtil.inherits(LargeMarkPoint, MarkBase);

    return LargeMarkPoint;
});