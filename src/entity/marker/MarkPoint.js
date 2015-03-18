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
    var Texture = require('qtek/Texture');

    var TextureAtlasSurface = require('../../surface/TextureAtlasSurface');
    var SpritesGeometry = require('../../util/geometry/Sprites');

    var IconShape = require('echarts/util/shape/Icon');
    var ImageShape = require('zrender/shape/Image');

    var ecData = require('echarts/util/ecData');

    var Matrix4 = require('qtek/math/Matrix4');
    var zrConfig = require('zrender/config');

    var eventList = ['CLICK', 'DBLCLICK', 'MOUSEOVER', 'MOUSEOUT', 'MOUSEMOVE'];

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
    };

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
            var serieDefaultColor = zr.getColor(seriesIndex);

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

                ecData.pack(
                    shape, serie, seriesIndex,
                    dataItem, i, dataItem.name, value
                );

                var labelQueryPrefix = 'itemStyle.normal.label';
                if (chart.deepQuery(
                    queryTarget, labelQueryPrefix + '.show'
                )) {
                    shapeStyle.text = chart.getSerieLabelText(
                        markPoint, dataItem, dataItem.name, 'normal'
                    );
                    shapeStyle.textPosition = chart.deepQuery(
                        queryTarget, labelQueryPrefix + '.position'
                    );
                    shapeStyle.textColor = chart.deepQuery(
                        queryTarget, labelQueryPrefix + '.textStyle.color'
                    );
                    shapeStyle.textFont = chart.getFont(
                        chart.deepQuery(
                            queryTarget, labelQueryPrefix + '.textStyle'
                        )
                    );
                }

                var coords = textureAtlas.addShape(
                    shape, spriteSize, spriteSize
                );
                // Texture atlas is full
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

                textureAtlas: textureAtlas
            });
            renderable.material.set('diffuseMap', textureAtlas.getTexture());

            eventList.forEach(function (eveName) {
                renderable.on(zrConfig.EVENT[eveName], this._mouseEventHandler, this);
            }, this);

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
        },

        _mouseEventHandler: function (e) {
            var chart = this.chart;
            var zr = chart.zr;

            var renderable = e.target;
            var textureAtlas = renderable.textureAtlas;

            var shape = textureAtlas.hover(e);
            if (shape) {
                if (e.type === zrConfig.EVENT.CLICK || e.type === zrConfig.EVENT.DBLCLICK) {
                    if (! shape.clickable) {
                        return;
                    }
                }
                else {
                    if (! shape.hoverable) {
                        return;
                    }
                }

                // Trigger a global zr event to tooltip
                zr.handler.dispatch(e.type, {
                    target: shape,
                    event: e.event,
                    type: e.type
                });
            }
        }
    };

    zrUtil.inherits(MarkPoint, MarkBase);

    return MarkPoint;
});