/**
 * MarPoint rendering with sprites
 *
 * @module echarts-x/entity/marker/MarkPoint
 * @author Yi Shen(https://github.com/pissang)
 */

define(function (require) {

    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Renderable = require('qtek/Renderable');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Node = require('qtek/Node');
    var Texture2D = require('qtek/Texture2D');
    var Texture = require('qtek/Texture');

    var TextureAtlasSurface = require('../../surface/TextureAtlasSurface');
    var SpritesGeometry = require('../../util/geometry/Sprites');
    var spriteUtil = require('../../util/sprite');

    var IconShape = require('echarts/util/shape/Icon');
    var ImageShape = require('zrender/shape/Image');

    var Matrix4 = require('qtek/math/Matrix4');

    /**
     * @constructor
     * @alias module:echarts-x/entity/marker/MarkPoint
     * @param {module:echarts-x/chart/base3d} chart
     */
    var MarkPoint = function (chart) {
        
        MarkBase.call(this, chart);

        this._sceneNode = new Node();

        this._spritesRenderables = [];
        this._spritesShader = null;

        this._textureAtlasList = [];

        this._spriteSize = 128;
    }

    MarkPoint.prototype = {

        constructor: MarkPoint,

        setSeries: function (serie, seriesIndex) {
            // Data check
            if (! serie.markPoint || ! serie.markPoint.data || serie.markPoint.data.length === 0) {
                return;
            }

            this.seriesIndex = seriesIndex;

            var chart = this.chart;
            var component = chart.component;
            var legend = component.legend;
            var dataRange = component.dataRange;
            var markPoint = serie.markPoint;
            var zr = chart.zr;
            var spriteSize = this._spriteSize;

            var dataList = markPoint.data;
            var serieColor;
            if (legend) {
                serieColor = legend.getColor(serie.name);
            }
            serieColor = chart.query(serie.markBar, 'itemStyle.normal.color') || serieColor;
            var serieDefaultColor = chart.zr.getColor(seriesIndex);

            var matrix = new Matrix4();
            var atlasSize = Texture.prototype.nextHighestPowerOfTwo(
                Math.sqrt(dataList.length) * this._spriteSize
            );
            // According to the webglstats.com. MAX_TEXTURE_SIZE 2048 is supported by all devices
            atlasSize = Math.min(2048, atlasSize);
            var textureAtlas = new TextureAtlasSurface(
                chart.zr, atlasSize, atlasSize
            );
            this._textureAtlasList.push(textureAtlas);
            var spriteRenderable = this._createSpritesRenderable(textureAtlas);
            for (var i = 0; i < dataList.length; i++) {
                var dataItem = dataList[i];
                var value = chart.getDataFromOption(dataItem, null);
                var queryTarget = [dataItem, markPoint];

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
                var symbol = chart.deepQuery(queryTarget, 'symbol');
                var symbolSize = chart.deepQuery(queryTarget, 'symbolSize');
                var strokeColor = chart.deepQuery(queryTarget, 'itemStyle.normal.borderColor');
                var lineWidth = chart.deepQuery(queryTarget, 'itemStyle.normal.borderWidth');

                var shape;
                if (symbol.match(/^image:\/\//)) {
                    shape = new ImageShape({
                        style: {
                            image: symbol.replace(/^image:\/\//, '')
                        }
                    });
                }
                else {
                    // Draw symbol shape
                    shape = new IconShape({
                        style: {
                            iconType: symbol,
                            color: color,
                            brushType: 'both',
                            strokeColor: strokeColor,
                            lineWidth: lineWidth / symbolSize * spriteSize
                        }
                    });
                }
                var shapeStyle = shape.style;
                shapeStyle.x = shapeStyle.y = 0;
                shapeStyle.width = shapeStyle.height = spriteSize;

                if (chart.deepQuery(
                    queryTarget, 'itemStyle.normal.label.show'
                )) {
                    shape.style.text = chart.getSerieLabelText(
                        markPoint, dataItem, dataItem.name, 'normal'
                    );
                    shape.style.textPosition = 'inside';
                    shape.style.textColor = chart.deepQuery(
                        queryTarget, 'itemStyle.normal.label.textStyle.color'
                    );
                    shape.style.textFont = chart.getFont(
                        chart.deepQuery(
                            queryTarget, 'itemStyle.normal.label.textStyle'
                        )
                    );
                }

                var coords = textureAtlas.addShape(
                    shape, spriteSize, spriteSize
                );
                // Texture Atlas is full
                if (! coords) {
                    // Create an other one
                    textureAtlas = new TextureAtlasSurface(
                        chart.zr, atlasSize, atlasSize
                    );
                    this._textureAtlasList.push(textureAtlas);
                    spriteRenderable = this._createSpritesRenderable(textureAtlas);
                    coords = textureAtlas.addShape(
                        shape, spriteSize, spriteSize
                    );
                }

                chart.getMarkPointTransform(seriesIndex, dataItem, matrix);

                spriteRenderable.geometry.addSprite(matrix, coords);
            }

            for (var i = 0; i < this._textureAtlasList.length; i++) {
                this._textureAtlasList[i].refresh();
            }
        },

        _createSpritesRenderable: function (textureAtlas) {
            if (! this._spritesShader) {
                this._spritesShader = new Shader({
                    vertex: Shader.source('ecx.albedo.vertex'),
                    fragment: Shader.source('ecx.albedo.fragment')
                });
                this._spritesShader.enableTexture('diffuseMap');
            }
            var renderable = new Renderable({
                material: new Material({
                    shader: this._spritesShader,
                    transparent: true,
                    depthMask: false
                }),
                culling: false,
                geometry: new SpritesGeometry(),
                ignorePicking: true
            });
            renderable.material.set('diffuseMap', textureAtlas.getTexture());
            this._spritesRenderables.push(renderable);

            this._sceneNode.add(renderable);
            return renderable;
        },

        clear: function () {
            var renderer = this.chart.baseLayer.renderer;
            renderer.disposeNode(this._sceneNode, true, true);
            this._sceneNode = new Node();
            this._spritesRenderables = [];
            this._textureAtlasList = [];
        },

        getSceneNode: function () {
            return this._sceneNode;
        }
    };

    zrUtil.inherits(MarkPoint, MarkBase);

    return MarkPoint;
});