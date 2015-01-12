define(function (require) {

    var zrUtil = require('zrender/tool/util');

    var ecData = require('echarts/util/ecData');

    var mapParams = require('echarts/util/mapData/params').params;
    var geoCoordMap = require('echarts/util/mapData/geoCoord');
    var textFixedMap = require('echarts/util/mapData/textFixed');

    var PolygonShape = require('zrender/shape/Polygon');
    var ShapeBundle = require('zrender/shape/ShapeBundle');
    var TextShape = require('zrender/shape/Text');

    var Node = require('qtek/Node');
    var Mesh = require('qtek/Mesh');
    var SphereGeometry = require('qtek/geometry/Sphere');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Texture2D = require('qtek/texture/Texture2D');
    var Vector3 = require('qtek/math/Vector3');

    var ecConfig = require('../config');
    var ChartBase3D = require('./base3d');
    var OrbitControl = require('../util/OrbitControl');

    var ZRenderSurface = require('../core/ZRenderSurface');

    function Map3D(ecTheme, messageCenter, zr, option, myChart) {

        ChartBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);

        this._earthRadius = 100;
        this._baseTextureSize = 2048;

        this._globeNode = null;

        this._orbitControl = null;

        this._rotateGlobe = false;

        this._mapDataMap = {};

        this._globeSurface = null;

        this.refresh(option);
    }

    Map3D.prototype = {

        type: ecConfig.CHART_TYPE_MAP3D,

        constructor: Map3D,

        _init: function () {
            var legend = this.component.legend;
            var series = this.series;
            this.selectedMap = {};

            this.beforeBuildMark();

            for (var i = 0; i < series.length; i++) {
                if (series[i].type === ecConfig.CHART_TYPE_MAP3D) {
                    series[i] = this.reformOption(series[i]);
                    var seriesName = series[i].name;
                    this.selectedMap[seriesName] = legend
                        ? legend.isSelected(seriesName) : true;

                    if (series[i].geoCoord) {
                        zrUtil.merge(
                            geoCoordMap, series[i].geoCoord, true
                        );
                    }
                    if (series[i].textFixed) {
                        zrUtil.merge(
                            textFixedMap, series[i].textFixed, true
                        );
                    }
                }
            }

            var seriesGroupByMapType = this._groupSeriesByMapType(series);
            var dataMap = this._mergeSeriesData(series);

            for (var mapType in dataMap) {
                if (!this._globeNode) {
                    this._createGlob(seriesGroupByMapType[mapType]);
                }
                this._buildGlobe(mapType, dataMap[mapType], seriesGroupByMapType[mapType]);
                //TODO Only support one mapType here
                break;
            }

            var camera = this.baseLayer.camera;
            camera.position.y = 0;
            camera.position.z = this._earthRadius * 2.5;

            camera.lookAt(Vector3.ZERO);

            this.afterBuildMark();
        },

        _groupSeriesByMapType: function (series) {
            var seriesGroupByMapType = {};
            for (var i = 0; i < series.length; i++) {
                if (
                    series[i].type === ecConfig.CHART_TYPE_MAP3D
                    && this.selectedMap[series[i].name]
                ) {
                    var mapType = series[i].mapType;
                    seriesGroupByMapType[mapType] = seriesGroupByMapType[mapType] || [];
                    seriesGroupByMapType[mapType].push(series[i]);
                }
            }
            return seriesGroupByMapType;
        },

        _mergeSeriesData: function (series) {

            var dataMap = {};

            for (var i = 0; i < series.length; i++) {
                if (
                    series[i].type === ecConfig.CHART_TYPE_MAP3D
                    && this.selectedMap[series[i].name]
                ) {
                    var mapType = series[i].mapType;
                    dataMap[mapType] = dataMap[mapType] || {};
                    var data = series[i].data || [];
                    // Merge the data from multiple series
                    for (var j = 0; j < data.length; j++) {
                        var name = data[j].name || '';
                        // TODO nameMap
                        dataMap[mapType][name] = dataMap[mapType][name]
                            || {seriesIdx: [], value: 0};
                        dataMap[mapType][name].seriesIdx.push(i);
                        for (var key in data[j]) {
                            var val = data[j][key];
                            if (key === 'value') {
                                if (!isNaN(val)) {
                                    dataMap[mapType][name].value += +val;
                                }
                            }
                            else {
                                dataMap[mapType][name][key] = val;
                            }
                        }
                    }
                    // TODO mapCalculation
                }
            }

            return dataMap;
        },

        _buildGlobe: function (mapType, data, seriesGroup) {

            if (this._mapDataMap[mapType]) {
                this._updateMapPolygonShapes(data, this._mapDataMap[mapType], seriesGroup);
                this._updateBaseTexture(seriesGroup);
                this.zr.refreshNextFrame();
            }
            else if (mapParams[mapType].getGeoJson) {
                var self = this;
                // Load geo json and draw the map on the base texture
                mapParams[mapType].getGeoJson(function (mapData) {
                    if (self._disposed) {
                        return;
                    }
                    self._mapDataMap[mapType] = mapData;
                    self._updateMapPolygonShapes(data, mapData, seriesGroup);
                    self._updateBaseTexture(seriesGroup);
                    self.zr.refreshNextFrame();
                });
            }

            // Init mark points
            seriesGroup.forEach(function (serie) {
                this.buildMark(
                    this.series.indexOf(serie), this._globeNode
                );
            }, this);
        },

        _createGlob: function (seriesGroup) {
            this._globeNode = new Node({
                name: 'globe'
            });
            var globeMesh = new Mesh({
                name: 'earth',
                geometry: new SphereGeometry({
                    widthSegments: 40,
                    heightSegments: 40,
                    radius: this._earthRadius
                }),
                material: new Material({
                    shader: new Shader({
                        vertex: Shader.source('ecx.albedo.vertex'),
                        fragment: Shader.source('ecx.albedo.fragment')
                    }),
                    transparent: true
                })
            });
            globeMesh.material.shader.enableTexture('diffuseMap');

            this._globeNode.add(globeMesh);

            globeMesh.on('mousemove', this._mouseMoveHandler, this);

            var scene = this.baseLayer.scene;
            scene.add(this._globeNode);

            this._orbitControl = new OrbitControl(this._globeNode, this.zr, this.baseLayer);
            this._orbitControl.init();
            // If auto rotating globe
            this._orbitControl.autoRotate = this.deepQuery(seriesGroup, 'autoRotate');

            var globeSurface = new ZRenderSurface(
                this.zr, this._baseTextureSize, this._baseTextureSize
            );
            this._globeSurface = globeSurface;
            globeMesh.material.set('diffuseMap', globeSurface.getTexture());

            var bgColor = this.deepQuery(seriesGroup, 'mapBackgroundColor');
            var bgImage = this.deepQuery(seriesGroup, 'mapBackgroundImage');
            globeSurface.clearColor = bgColor || '';
            if (bgImage) {
                 var img = new Image();
                 var zr = this.zr;
                 img.onload = function () {
                    globeSurface.backgroundImage = img;
                    globeSurface.refresh();
                    zr.refreshNextFrame();
                 }
                 img.src = bgImage;
            } else {
                globeSurface.backgroundImage = null;
            }
        },

        _updateBaseTexture: function (seriesGroup) {
            var width = this._baseTextureSize;
            var height = this._baseTextureSize;

            // Draw latitude and longitude grid
            // this._drawLatitude(ctx, seriesGroup, width, height);
            // this._drawLongitude(ctx, seriesGroup, width, height);

            this._globeSurface.refresh();
        },

        _updateMapPolygonShapes: function (data, mapData, seriesGroup) {
            this._globeSurface.clearElements();

            var self = this;
            var dataRange = this.component.dataRange;

            var bbox = {
                x: -180,
                y: -90,
                width: 360,
                height: 180
            };

            var scaleX = this._baseTextureSize / bbox.width;
            var scaleY = this._baseTextureSize / bbox.height;

            // Draw map
            // TODO Special area
            for (var i = 0; i < mapData.features.length; i++) {
                var feature = mapData.features[i];
                var name = feature.properties.name;

                var dataItem = data[name];
                var value;
                var queryTarget = [];
                var seriesName = [];
                if (dataItem) {
                    queryTarget.push(dataItem);
                    for (var j = 0; j < dataItem.seriesIdx.length; j++) {
                        var sIdx = dataItem.seriesIdx[j];
                        seriesName.push(this.series[sIdx].name);
                        queryTarget.push(this.series[sIdx]);
                    }
                    value = dataItem.value;
                } else {
                    dataItem = '-';
                    value = '-';

                    queryTarget = seriesGroup;
                }
                seriesName = seriesName.join(' ');

                var color = this.deepQuery(queryTarget, 'itemStyle.normal.areaStyle.color');
                // Use color provided by data range if have
                color = (dataRange && !isNaN(value))
                        ? dataRange.getColor(value)
                        : color;

                // Create area polygon shape
                var shape = new ShapeBundle({
                    name: name,
                    zlevel: 0,
                    cp: feature.properties.cp,
                    style: {
                        shapeList: [],
                        brushType: 'both',
                        color: color,
                        strokeColor: this.deepQuery(queryTarget, 'itemStyle.normal.borderColor'),
                        lineWidth: this.deepQuery(queryTarget, 'itemStyle.normal.borderWidth'),
                        opacity: this.deepQuery(queryTarget, 'itemStyle.normal.opacity')
                    },
                    highlightStyle: {
                        color: this.deepQuery(queryTarget, 'itemStyle.emphasis.areaStyle.color'),
                        strokeColor: this.deepQuery(queryTarget, 'itemStyle.emphasis.borderColor'),
                        lineWidth: this.deepQuery(queryTarget, 'itemStyle.emphasis.borderWidth') ,
                        opacity: this.deepQuery(queryTarget, 'itemStyle.emphasis.opacity') 
                    }
                });
                ecData.pack(
                    shape,
                    {
                        name: seriesName,
                        tooltip: this.deepQuery(queryTarget, 'tooltip')
                    },
                    0,
                    dataItem, 0,
                    name
                )

                if (feature.type == 'Feature') {
                    createGeometry(feature.geometry, shape);
                }
                else if (feature.type == 'GeometryCollection') {
                    for (var j = 0; j < feature.geometries; j++) {
                        createGeometry(feature.geometries[j], shape);
                    }
                }

                this._globeSurface.addElement(shape);

                // Create label text shape
                var cp = this._getTextPosition(shape);
                // Scale text by the latitude, text of high latitude will be pinched
                var lat = (0.5 - cp[1] / this._baseTextureSize) * Math.PI;
                var textScaleX = 1 / Math.cos(lat);
                var baseScale = this._baseTextureSize / 2048;
                var textShape = new TextShape({
                    zlevel: 1,
                    position: cp,
                    scale: [0.5 * textScaleX * baseScale, -baseScale],
                    style: {
                        x: 0,
                        y: 0,
                        brushType: 'fill',
                        text: this.getLabelText(name, value, queryTarget, 'normal'),
                        textAlign: 'center',
                        color: this.deepQuery(
                            queryTarget, 'itemStyle.normal.label.textStyle.color'
                        ),
                        opacity: this.deepQuery(queryTarget, 'itemStyle.normal.label.show') ? 1 : 0,
                        textFont: this.getFont(
                            this.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle')
                        )
                    },
                    highlightStyle: {
                        color: this.deepQuery(
                            queryTarget, 'itemStyle.emphasis.label.textStyle.color'
                        ),
                        opacity: this.deepQuery(queryTarget, 'itemStyle.emphasis.label.show') ? 1 : 0,
                        textFont: this.getFont(
                            this.deepQuery(queryTarget, 'itemStyle.emphasis.label.textStyle')
                        )
                    }
                });

                this._globeSurface.addElement(textShape);
            }

            function createGeometry(geometry, bundleShape) {
                if (geometry.type == 'Polygon') {
                    createPolygon(geometry.coordinates, bundleShape);
                } else if (geometry.type == 'MultiPolygon') {
                    for (var i = 0; i < geometry.coordinates.length; i++) {
                        createPolygon(geometry.coordinates[i], bundleShape);
                    }
                }
            }

            function createPolygon(coordinates, bundleShape) {
                for (var k = 0; k < coordinates.length; k++) {
                    var polygon = new PolygonShape({
                        style: {
                            pointList: []
                        }
                    });
                    for (var i = 0; i < coordinates[k].length; i++) {
                        var point = self._formatPoint(coordinates[k][i]);
                        // Format point
                        var x = (point[0] - bbox.x) * scaleX;
                        var y = (point[1] - bbox.y) * scaleY;
                        polygon.style.pointList.push([x, y]);
                    }
                    bundleShape.style.shapeList.push(polygon);
                }
            }
        },

        _getTextPosition: function (polygonShape) {
            var textPosition;
            var name = polygonShape.name;
            var textFixed = textFixedMap[name] || [0, 0];
            if (geoCoordMap[name]) {
                textPosition = Array.prototype.slice.call(geoCoordMap[name])
            }
            else if (polygonShape.cp) {
                textPosition = [
                    polygonShape.cp[0] + textFixed[0],
                    polygonShape.cp[1] + textFixed[1]
                ]
            }
            else {
                var bbox = polygonShape.getRect(polygonShape.style);
                textPosition = [
                    bbox.x + bbox.width / 2 + textFixed[0],
                    bbox.y + bbox.height / 2 + textFixed[1]
                ];
            }
            return textPosition;
        },

        _formatPoint: function (p) {
            //调整俄罗斯东部到地图右侧与俄罗斯相连
            return [
                (p[0] < -168.5 && p[1] > 63.8) ? p[0] + 360 : p[0], 
                p[1]
            ];
        },

        _drawLatitude: function(ctx, seriesGroup, width, height) {
            ctx.strokeStyle = this.deepQuery(seriesGroup, 'mapGridColor');
            ctx.beginPath();
            for (var i = 0; i < 18; i++) {
                var y = Math.round(height * i / 18) + 0.5;
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.lineWidth = 1;
            ctx.stroke();
        },

        _drawLongitude: function(ctx, seriesGroup, width, height) {
            ctx.strokeStyle = this.deepQuery(seriesGroup, 'mapGridColor');
            ctx.beginPath();
            for (var i = 0; i < 36; i++) {
                var x = Math.round(width * i / 36) + 0.5;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            ctx.lineWidth = 1;
            ctx.stroke();
        },

        _mouseMoveHandler: function (e) {
            this._globeSurface.hover(e);
        },

        _eulerToSphere: function (x, y, z) {
            var theta = Math.asin(y);
            var phi = Math.atan2(z, -x);
            if (phi < 0) {
                phi = Math.PI * 2  + phi;
            }

            var log = theta * 180 / Math.PI + 90;
            var lat = phi * 180 / Math.PI;
        },

        // Overwrite getMarkCoord
        getMarkCoord: function (seriesIdx, data, point) {
            var geoCoord = data.geoCoord;
            var coords = [];
            coords[0] = geoCoord.x == null ? geoCoord[0] : geoCoord.x;
            coords[1] = geoCoord.y == null ? geoCoord[1] : geoCoord.y;
            coords = this._formatPoint(coords);

            var log = coords[0];
            var lat = coords[1];

            log = Math.PI * log / 180;
            lat = Math.PI * lat / 180;

            var r = this._earthRadius + 0.1;
            var r0 = Math.cos(lat) * r;
            point._array[1] = Math.sin(lat) * r;
            // TODO
            point._array[0] = -r0 * Math.cos(log + Math.PI);
            point._array[2] = r0 * Math.sin(log + Math.PI);
        },

        // 根据 lablel.formatter 计算 label text
        getLabelText : function (name, value, queryTarget, status) {
            var formatter = this.deepQuery(
                queryTarget,
                'itemStyle.' + status + '.label.formatter'
            );
            if (formatter) {
                if (typeof formatter == 'function') {
                    return formatter.call(
                        this.myChart,
                        name,
                        value
                    );
                }
                else if (typeof formatter == 'string') {
                    formatter = formatter.replace('{a}','{a0}')
                                         .replace('{b}','{b0}');
                    formatter = formatter.replace('{a0}', name)
                                         .replace('{b0}', value);
                    return formatter;
                }
            }
            else {
                return name;
            }
        },

        // Overwrite getMarkBarPoints
        getMarkBarPoints: (function () {
            var normal = new Vector3();
            return function (seriesIndex, data, start, end) {
                var barHeight = data.barHeight != null ? data.barHeight : 1;
                if (typeof(barHeight) == 'function') {
                    barHeight = barHeight(data);
                }
                this.getMarkCoord(seriesIndex, data, start);
                Vector3.copy(normal, start);
                Vector3.normalize(normal, normal);
                Vector3.scaleAndAdd(end, start, normal, barHeight);
            };
        })(),

        // Overwrite getMarkLinePoints
        getMarkLinePoints: (function () {
            var normal = new Vector3();
            var tangent = new Vector3();
            var bitangent = new Vector3();
            var halfVector = new Vector3();
            return function (seriesIndex, data, p0, p1, p2, p3) {
                var isCurve = !!p2;
                if (!isCurve) { // Mark line is not a curve
                    p3 = p1;
                }
                this.getMarkCoord(seriesIndex, data[0], p0);
                this.getMarkCoord(seriesIndex, data[1], p3);
                if (isCurve) {
                    // Get p1
                    Vector3.normalize(normal, p0);
                    // TODO p0-p3 is parallel with normal
                    Vector3.sub(tangent, p3, p0);
                    Vector3.normalize(tangent, tangent);
                    Vector3.cross(bitangent, tangent, normal);
                    Vector3.normalize(bitangent, bitangent);
                    Vector3.cross(tangent, normal, bitangent);
                    // p1 is half vector of p0 and tangent on p0
                    Vector3.add(p1, normal, tangent);
                    Vector3.normalize(p1, p1);

                    // Get p2
                    Vector3.normalize(normal, p3);
                    Vector3.sub(tangent, p0, p3);
                    Vector3.normalize(tangent, tangent);
                    Vector3.cross(bitangent, tangent, normal);
                    Vector3.normalize(bitangent, bitangent);
                    Vector3.cross(tangent, normal, bitangent);
                    // p2 is half vector of p3 and tangent on p3
                    Vector3.add(p2, normal, tangent);
                    Vector3.normalize(p2, p2);

                    // Project distance of p0 on haflVector
                    Vector3.add(halfVector, p0, p3);
                    Vector3.normalize(halfVector, halfVector);
                    var projDist = Vector3.dot(p0, halfVector);
                    // Angle of halfVector and p1
                    var cosTheta = Vector3.dot(halfVector, p1);
                    var len = (this._earthRadius - projDist) / cosTheta * 2;

                    Vector3.scaleAndAdd(p1, p0, p1, len);
                    Vector3.scaleAndAdd(p2, p3, p2, len);
                }
            }
        })(),

        onframe: function (deltaTime) {
            ChartBase3D.prototype.onframe.call(this, deltaTime);

            this._orbitControl.update(deltaTime);
        },

        refresh: function(newOption) {
            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }

            this._init();
        },

        ondataRange: function (param, status) {
            if (this.component.dataRange) {
                this.refresh();
                this.zr.refreshNextFrame();
            }
        },

        dispose: function () {

            ChartBase3D.prototype.dispose.call(this);

            this.baseLayer.dispose();
            if (this._orbitControl) {
                this._orbitControl.dispose();
            }

            this._globeNode = null;
            this._orbitControl = null;

            this._disposed = true;
        }
    }

    zrUtil.inherits(Map3D, ChartBase3D);

    require('echarts/chart').define(ecConfig.CHART_TYPE_MAP3D, Map3D);

    return Map3D;
});