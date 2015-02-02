define('echarts-x/chart/map3d', [
    'require',
    'zrender/tool/util',
    'zrender/config',
    'echarts/util/ecData',
    'echarts/util/mapData/params',
    'echarts/util/mapData/geoCoord',
    'echarts/util/mapData/textFixed',
    'zrender/shape/Polygon',
    'zrender/shape/ShapeBundle',
    'zrender/shape/Text',
    'qtek/Node',
    'qtek/Mesh',
    'qtek/geometry/Sphere',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Texture2D',
    'qtek/math/Vector3',
    'qtek/math/Matrix4',
    'qtek/core/glenum',
    '../config',
    './base3d',
    '../util/OrbitControl',
    '../surface/ZRenderSurface',
    '../surface/VectorFieldParticleSurface',
    'qtek/core/LRU',
    'echarts/chart'
], function (require) {
    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
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
    var Texture2D = require('qtek/Texture2D');
    var Vector3 = require('qtek/math/Vector3');
    var Matrix4 = require('qtek/math/Matrix4');
    var glenum = require('qtek/core/glenum');
    var ecConfig = require('../config');
    var ChartBase3D = require('./base3d');
    var OrbitControl = require('../util/OrbitControl');
    var ZRenderSurface = require('../surface/ZRenderSurface');
    var VectorFieldParticleSurface = require('../surface/VectorFieldParticleSurface');
    var LRU = require('qtek/core/LRU');
    var formatGeoPoint = function (p) {
        return [
            p[0] < -168.5 && p[1] > 63.8 ? p[0] + 360 : p[0],
            p[1]
        ];
    };
    function Map3D(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);
        if (!this.baseLayer.renderer) {
            return;
        }
        this._earthRadius = 100;
        this._baseTextureSize = 2048;
        this._globeNode = null;
        this._orbitControl = null;
        this._mapDataMap = {};
        this._nameMap = {};
        this._globeSurface = null;
        this._surfaceLayerRoot = null;
        this._albedoShader = new Shader({
            vertex: Shader.source('ecx.albedo.vertex'),
            fragment: Shader.source('ecx.albedo.fragment')
        });
        this._albedoShader.enableTexture('diffuseMap');
        this._albedoShaderPA = this._albedoShader.clone();
        this._albedoShaderPA.define('fragment', 'PREMULTIPLIED_ALPHA');
        this._sphereGeometry = new SphereGeometry({
            widthSegments: 40,
            heightSegments: 40
        });
        this._imageCache = new LRU(5);
        this._vfParticleSurfaceList = [];
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
                    var mapType = series[i].mapType;
                    this.selectedMap[seriesName] = legend ? legend.isSelected(seriesName) : true;
                    if (series[i].geoCoord) {
                        zrUtil.merge(geoCoordMap, series[i].geoCoord, true);
                    }
                    if (series[i].textFixed) {
                        zrUtil.merge(textFixedMap, series[i].textFixed, true);
                    }
                    if (series[i].nameMap) {
                        this._nameMap[mapType] = this._nameMap[mapType] || {};
                        zrUtil.merge(this._nameMap[mapType], series[i].nameMap, true);
                    }
                }
            }
            var seriesGroupByMapType = this._groupSeriesByMapType(series);
            var dataMap = this._mergeSeriesData(series);
            for (var mapType in dataMap) {
                var seriesGroup = seriesGroupByMapType[mapType];
                var mapQuality = this.deepQuery(seriesGroup, 'baseLayer.quality');
                if (isNaN(mapQuality)) {
                    switch (mapQuality) {
                    case 'low':
                        this._baseTextureSize = 1024;
                        break;
                    case 'high':
                        this._baseTextureSize = 4096;
                        break;
                    case 'medium':
                    default:
                        this._baseTextureSize = 2048;
                        break;
                    }
                } else {
                    this._baseTextureSize = mapQuality;
                }
                if (!this._globeNode) {
                    this._createGlob(seriesGroup);
                    this._initGlobeHandlers();
                }
                this._updateGlobe(mapType, dataMap[mapType], seriesGroup);
                this._setViewport(seriesGroup);
                break;
            }
            var camera = this.baseLayer.camera;
            camera.position.y = 0;
            camera.position.z = this._earthRadius * 2.5;
            camera.lookAt(Vector3.ZERO);
            this.afterBuildMark();
        },
        _setViewport: function (seriesGroup) {
            var mapLocation = this.deepQuery(seriesGroup, 'mapLocation') || {};
            var x = mapLocation.x;
            var y = mapLocation.y;
            var width = mapLocation.width;
            var height = mapLocation.height;
            var zrWidth = this.zr.getWidth();
            var zrHeight = this.zr.getHeight();
            x = this.parsePercent(x, zrWidth);
            y = this.parsePercent(y, zrHeight);
            width = this.parsePercent(width, zrWidth);
            height = this.parsePercent(height, zrHeight);
            x = isNaN(x) ? 0 : x;
            y = isNaN(y) ? 0 : x;
            width = isNaN(width) ? zrWidth : width;
            height = isNaN(height) ? zrHeight : height;
            this.baseLayer.setViewport(x, y, width, height);
        },
        _groupSeriesByMapType: function (series) {
            var seriesGroupByMapType = {};
            for (var i = 0; i < series.length; i++) {
                if (series[i].type === ecConfig.CHART_TYPE_MAP3D && this.selectedMap[series[i].name]) {
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
                if (series[i].type === ecConfig.CHART_TYPE_MAP3D && this.selectedMap[series[i].name]) {
                    var mapType = series[i].mapType;
                    dataMap[mapType] = dataMap[mapType] || {};
                    var data = series[i].data || [];
                    for (var j = 0; j < data.length; j++) {
                        var name = data[j].name || '';
                        dataMap[mapType][name] = dataMap[mapType][name] || {
                            seriesIdx: [],
                            value: 0
                        };
                        dataMap[mapType][name].seriesIdx.push(i);
                        for (var key in data[j]) {
                            var val = data[j][key];
                            if (key === 'value') {
                                if (!isNaN(val)) {
                                    dataMap[mapType][name].value += +val;
                                }
                            } else {
                                dataMap[mapType][name][key] = val;
                            }
                        }
                    }
                }
            }
            return dataMap;
        },
        _updateGlobe: function (mapType, data, seriesGroup) {
            var globeSurface = this._globeSurface;
            var self = this;
            globeSurface.resize(this._baseTextureSize, this._baseTextureSize);
            var bgColor = this.deepQuery(seriesGroup, 'baseLayer.backgroundColor');
            var bgImage = this.deepQuery(seriesGroup, 'baseLayer.backgroundImage');
            globeSurface.backgroundColor = this._isValueNone(bgColor) ? '' : bgColor;
            if (!this._isValueNone(bgImage)) {
                if (typeof bgImage == 'string') {
                    var img = new Image();
                    img.onload = function () {
                        globeSurface.backgroundImage = img;
                        globeSurface.refresh();
                    };
                    img.src = bgImage;
                } else {
                    globeSurface.backgroundImage = bgImage;
                }
            } else {
                globeSurface.backgroundImage = null;
            }
            if (this._mapDataMap[mapType]) {
                this._updateMapPolygonShapes(data, this._mapDataMap[mapType], seriesGroup);
                globeSurface.refresh();
            } else if (mapParams[mapType].getGeoJson) {
                mapParams[mapType].getGeoJson(function (mapData) {
                    if (self._disposed) {
                        return;
                    }
                    self._mapDataMap[mapType] = mapData;
                    self._updateMapPolygonShapes(data, mapData, seriesGroup);
                    globeSurface.refresh();
                });
            } else {
                globeSurface.refresh();
            }
            if (this._surfaceLayerRoot) {
                this.baseLayer.renderer.disposeNode(this._surfaceLayerRoot, false, true);
            }
            this._surfaceLayerRoot = new Node({ name: 'surfaceLayers' });
            this._globeNode.add(this._surfaceLayerRoot);
            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].dispose();
            }
            this._vfParticleSurfaceList = [];
            seriesGroup.forEach(function (serie) {
                var sIdx = this.series.indexOf(serie);
                this.buildMark(sIdx, this._globeNode);
                this._createSurfaceLayers(sIdx);
            }, this);
        },
        _createSurfaceLayers: function (seriesIdx) {
            var serie = this.series[seriesIdx];
            for (var i = 0; i < serie.surfaceLayers.length; i++) {
                var surfaceLayer = serie.surfaceLayers[i];
                var surfaceMesh = new Mesh({
                    name: 'surfaceLayer' + i,
                    geometry: this._sphereGeometry,
                    ignorePicking: true
                });
                var distance = surfaceLayer.distance;
                if (distance == null) {
                    distance = i + 1;
                }
                var r = this._earthRadius + distance;
                surfaceMesh.scale.set(r, r, r);
                switch (surfaceLayer.type) {
                case 'particle':
                    this._createParticleSurfaceLayer(seriesIdx, surfaceLayer, surfaceMesh);
                    break;
                case 'texture':
                default:
                    this._createTextureSurfaceLayer(seriesIdx, surfaceLayer, surfaceMesh);
                    break;
                }
                this._surfaceLayerRoot.add(surfaceMesh);
            }
        },
        _createTextureSurfaceLayer: function (seriesIdx, surfaceLayerCfg, surfaceMesh) {
            var self = this;
            surfaceMesh.material = new Material({
                shader: this._albedoShader,
                transparent: true,
                depthMask: false
            });
            var serie = this.series[seriesIdx];
            var image = surfaceLayerCfg.image;
            var canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            var texture = new Texture2D({
                anisotropic: 32,
                image: canvas
            });
            surfaceMesh.material.set('diffuseMap', texture);
            if (typeof image === 'string') {
                var src = image;
                image = this._imageCache.get(src);
                if (!image) {
                    image = new Image();
                    image.onload = function () {
                        texture.image = image;
                        texture.dirty();
                        self.zr.refreshNextFrame();
                        self._imageCache.put(src, image);
                    };
                    image.src = src;
                } else {
                    texture.image = image;
                }
            } else if (this._isValueImage(image)) {
                texture.image = image;
            }
        },
        _createParticleSurfaceLayer: function (seriesIdx, surfaceLayerCfg, surfaceMesh) {
            var self = this;
            var serie = this.series[seriesIdx];
            var data = this.query(surfaceLayerCfg, 'particle.vectorField');
            surfaceMesh.material = new Material({
                shader: this._albedoShaderPA,
                transparent: true,
                depthMask: false
            });
            var vfParticleSurface = new VectorFieldParticleSurface(this.baseLayer.renderer, data);
            var width = 0;
            var height = 0;
            var vfImage;
            if (data instanceof Array) {
                vfImage = this._createCanvasFromDataMatrix(data);
                width = vfImage.width;
                height = vfImage.height;
                if (!vfImage) {
                    return false;
                }
            } else if (this._isValueImage(data)) {
                width = data.width;
                height = data.height;
                vfImage = data;
            } else {
                return false;
            }
            if (!width || !height) {
                return;
            }
            var textureSize = this.query(surfaceLayerCfg, 'size');
            if (typeof textureSize === 'number') {
                textureSize = [
                    textureSize,
                    textureSize
                ];
            } else if (!textureSize) {
                textureSize = [
                    2048,
                    1024
                ];
            }
            var particleSizeScaling = this.query(surfaceLayerCfg, 'particle.sizeScaling') || 1;
            var particleSpeedScaling = this.query(surfaceLayerCfg, 'particle.speedScaling');
            if (particleSpeedScaling == null) {
                particleSpeedScaling = 1;
            }
            var particleColor = this.query(surfaceLayerCfg, 'particle.color') || 'white';
            var particleNumber = this.query(surfaceLayerCfg, 'particle.number');
            if (particleNumber == null) {
                particleNumber = 256 * 256;
            }
            ;
            var motionBlurFactor = this.query(surfaceLayerCfg, 'particle.motionBlurFactor');
            if (motionBlurFactor == null) {
                motionBlurFactor = 0.99;
            }
            vfParticleSurface.vectorFieldTexture = new Texture2D({
                image: vfImage,
                flipY: false
            });
            vfParticleSurface.surfaceTexture = new Texture2D({
                width: textureSize[0],
                height: textureSize[1],
                anisotropic: 32
            });
            vfParticleSurface.particleSizeScaling = particleSizeScaling;
            vfParticleSurface.particleSpeedScaling = particleSpeedScaling;
            vfParticleSurface.particleColor = this.parseColor(particleColor);
            vfParticleSurface.motionBlurFactor = motionBlurFactor;
            var size = Math.round(Math.sqrt(particleNumber));
            vfParticleSurface.init(size, size);
            vfParticleSurface.surfaceMesh = surfaceMesh;
            this._vfParticleSurfaceList.push(vfParticleSurface);
        },
        _createCanvasFromDataMatrix: function (data) {
            var height = data.length;
            if (!(data[0] instanceof Array)) {
                return null;
            }
            var width = data[0].length;
            if (!(data[0][0] instanceof Array)) {
                return null;
            }
            var vfImage = document.createElement('canvas');
            vfImage.width = width;
            vfImage.height = height;
            var ctx = vfImage.getContext('2d');
            var imageData = ctx.getImageData(0, 0, width, height);
            var p = 0;
            for (var j = 0; j < height; j++) {
                for (var i = 0; i < width; i++) {
                    var item = data[j][i];
                    var u = item.x == null ? item[0] : item.x;
                    var v = item.y == null ? item[1] : item.y;
                    imageData.data[p++] = u * 128 + 128;
                    imageData.data[p++] = v * 128 + 128;
                    imageData.data[p++] = 0;
                    imageData.data[p++] = 255;
                }
            }
            ctx.putImageData(imageData, 0, 0);
            return vfImage;
        },
        _createGlob: function (seriesGroup) {
            var zr = this.zr;
            var self = this;
            this._globeNode = new Node({ name: 'globe' });
            var earthMesh = new Mesh({
                name: 'earth',
                geometry: this._sphereGeometry,
                material: new Material({
                    shader: this._albedoShader,
                    transparent: true
                })
            });
            var radius = this._earthRadius;
            earthMesh.scale.set(radius, radius, radius);
            this._globeNode.add(earthMesh);
            var scene = this.baseLayer.scene;
            scene.add(this._globeNode);
            this._orbitControl = new OrbitControl(this._globeNode, this.zr, this.baseLayer);
            this._orbitControl.init();
            this._orbitControl.autoRotate = this.deepQuery(seriesGroup, 'autoRotate');
            var globeSurface = new ZRenderSurface(this._baseTextureSize, this._baseTextureSize);
            this._globeSurface = globeSurface;
            earthMesh.material.set('diffuseMap', globeSurface.getTexture());
            globeSurface.onrefresh = function () {
                zr.refreshNextFrame();
            };
        },
        _updateMapPolygonShapes: function (data, mapData, seriesGroup) {
            this._globeSurface.clearElements();
            var self = this;
            var dataRange = this.component.dataRange;
            var scaleX = this._baseTextureSize / 360;
            var scaleY = this._baseTextureSize / 180;
            var mapType = this.deepQuery(seriesGroup, 'mapType');
            var nameMap = this._nameMap[mapType] || {};
            for (var i = 0; i < mapData.features.length; i++) {
                var feature = mapData.features[i];
                var name = feature.properties.name;
                name = nameMap[name] || name;
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
                color = dataRange && !isNaN(value) ? dataRange.getColor(value) : color;
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
                        lineWidth: this.deepQuery(queryTarget, 'itemStyle.emphasis.borderWidth'),
                        opacity: this.deepQuery(queryTarget, 'itemStyle.emphasis.opacity')
                    }
                });
                ecData.pack(shape, {
                    name: seriesName,
                    tooltip: this.deepQuery(queryTarget, 'tooltip')
                }, 0, dataItem, 0, name);
                if (feature.type == 'Feature') {
                    createGeometry(feature.geometry, shape);
                } else if (feature.type == 'GeometryCollection') {
                    for (var j = 0; j < feature.geometries; j++) {
                        createGeometry(feature.geometries[j], shape);
                    }
                }
                this._globeSurface.addElement(shape);
                var cp = this._getTextPosition(shape);
                var lat = (0.5 - cp[1] / this._baseTextureSize) * Math.PI;
                var textScaleX = 1 / Math.cos(lat);
                var baseScale = this._baseTextureSize / 2048;
                var textShape = new TextShape({
                    zlevel: 1,
                    position: cp,
                    scale: [
                        0.5 * textScaleX * baseScale,
                        baseScale
                    ],
                    style: {
                        x: 0,
                        y: 0,
                        brushType: 'fill',
                        text: this._getMapLabelText(name, value, queryTarget, 'normal'),
                        textAlign: 'center',
                        color: this.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle.color'),
                        opacity: this.deepQuery(queryTarget, 'itemStyle.normal.label.show') ? 1 : 0,
                        textFont: this.getFont(this.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle'))
                    },
                    highlightStyle: {
                        color: this.deepQuery(queryTarget, 'itemStyle.emphasis.label.textStyle.color'),
                        opacity: this.deepQuery(queryTarget, 'itemStyle.emphasis.label.show') ? 1 : 0,
                        textFont: this.getFont(this.deepQuery(queryTarget, 'itemStyle.emphasis.label.textStyle'))
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
                    var polygon = new PolygonShape({ style: { pointList: [] } });
                    for (var i = 0; i < coordinates[k].length; i++) {
                        var point = formatGeoPoint(coordinates[k][i]);
                        var x = (point[0] + 180) * scaleX;
                        var y = (90 - point[1]) * scaleY;
                        polygon.style.pointList.push([
                            x,
                            y
                        ]);
                    }
                    bundleShape.style.shapeList.push(polygon);
                }
            }
        },
        _getTextPosition: function (polygonShape) {
            var textPosition;
            var name = polygonShape.name;
            var textFixed = textFixedMap[name] || [
                0,
                0
            ];
            var size = this._baseTextureSize;
            if (geoCoordMap[name]) {
                textPosition = [
                    (geoCoordMap[name][0] + 180) / 360 * size,
                    (90 - geoCoordMap[name][1]) / 180 * size
                ];
            } else if (polygonShape.cp) {
                textPosition = [
                    (polygonShape.cp[0] + textFixed[0] + 180) / 360 * size,
                    (90 - (polygonShape.cp[1] + textFixed[1])) / 180 * size
                ];
            } else {
                var bbox = polygonShape.getRect(polygonShape.style);
                textPosition = [
                    bbox.x + bbox.width / 2 + textFixed[0],
                    bbox.y + bbox.height / 2 + textFixed[1]
                ];
            }
            return textPosition;
        },
        _initGlobeHandlers: function () {
            var globeMesh = this._globeNode.queryNode('earth');
            var mouseEventHandler = function (e) {
                var shape = this._globeSurface.hover(e);
                if (shape) {
                    this.zr.handler.dispatch(e.type, {
                        target: shape,
                        event: e.event,
                        type: e.type
                    });
                }
            };
            var eventList = [
                'CLICK',
                'DBLCLICK',
                'MOUSEOVER',
                'MOUSEOUT',
                'MOUSEMOVE',
                'DRAGSTART',
                'DRAGEND',
                'DRAGENTER',
                'DRAGOVER',
                'DRAGLEAVE',
                'DROP'
            ];
            eventList.forEach(function (eveName) {
                globeMesh.on(zrConfig.EVENT[eveName], mouseEventHandler, this);
            }, this);
        },
        _eulerToSphere: function (x, y, z) {
            var theta = Math.asin(y);
            var phi = Math.atan2(z, -x);
            if (phi < 0) {
                phi = Math.PI * 2 + phi;
            }
            var log = theta * 180 / Math.PI + 90;
            var lat = phi * 180 / Math.PI;
        },
        _isValueNone: function (value) {
            return value == null || value === '' || typeof value == 'string' && value.toLowerCase() == 'none';
        },
        _isValueImage: function (value) {
            return value instanceof HTMLCanvasElement || value instanceof HTMLImageElement || value instanceof Image;
        },
        _getMapLabelText: function (name, value, queryTarget, status) {
            var formatter = this.deepQuery(queryTarget, 'itemStyle.' + status + '.label.formatter');
            if (formatter) {
                if (typeof formatter == 'function') {
                    return formatter.call(this.myChart, name, value);
                } else if (typeof formatter == 'string') {
                    formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}');
                    formatter = formatter.replace('{a0}', name).replace('{b0}', value);
                    return formatter;
                }
            } else {
                return name;
            }
        },
        getMarkCoord: function (seriesIdx, data, point) {
            var geoCoord = data.geoCoord || geoCoordMap[data.name];
            var coords = [];
            var serie = this.series[seriesIdx];
            var distance = this.deepQuery([
                data,
                serie.markPoint || serie.markLine || serie.markBar
            ], 'distance');
            coords[0] = geoCoord.x == null ? geoCoord[0] : geoCoord.x;
            coords[1] = geoCoord.y == null ? geoCoord[1] : geoCoord.y;
            coords = formatGeoPoint(coords);
            var lon = coords[0];
            var lat = coords[1];
            lon = Math.PI * lon / 180;
            lat = Math.PI * lat / 180;
            var r = this._earthRadius + distance;
            var r0 = Math.cos(lat) * r;
            point._array[1] = Math.sin(lat) * r;
            point._array[0] = -r0 * Math.cos(lon + Math.PI);
            point._array[2] = r0 * Math.sin(lon + Math.PI);
        },
        getMarkPointTransform: function () {
            var xAxis = new Vector3();
            var yAxis = new Vector3();
            var zAxis = new Vector3();
            var position = new Vector3();
            return function (seriesIdx, data, matrix) {
                var series = this.series[seriesIdx];
                var queryTarget = [
                    data,
                    series.markPoint
                ];
                var symbolSize = this.deepQuery(queryTarget, 'symbolSize');
                var orientation = this.deepQuery(queryTarget, 'orientation');
                var orientationAngle = this.deepQuery(queryTarget, 'orientationAngle');
                this.getMarkCoord(seriesIdx, data, position);
                Vector3.normalize(zAxis, position);
                Vector3.cross(xAxis, Vector3.UP, zAxis);
                Vector3.normalize(xAxis, xAxis);
                Vector3.cross(yAxis, zAxis, xAxis);
                if (!isNaN(symbolSize)) {
                    symbolSize = [
                        symbolSize,
                        symbolSize
                    ];
                }
                if (orientation === 'tangent') {
                    var tmp = zAxis;
                    zAxis = yAxis;
                    yAxis = tmp;
                    Vector3.negate(zAxis, zAxis);
                    Vector3.scaleAndAdd(position, position, yAxis, symbolSize[1]);
                }
                matrix.x = xAxis;
                matrix.y = yAxis;
                matrix.z = zAxis;
                Matrix4.rotateX(matrix, matrix, -orientationAngle / 180 * Math.PI);
                Matrix4.scale(matrix, matrix, new Vector3(symbolSize[0], symbolSize[1], 1));
                var arr = matrix._array;
                arr[12] = position.x;
                arr[13] = position.y;
                arr[14] = position.z;
            };
        }(),
        getMarkBarPoints: function () {
            var normal = new Vector3();
            return function (seriesIdx, data, start, end) {
                var barHeight = data.barHeight != null ? data.barHeight : 1;
                if (typeof barHeight == 'function') {
                    barHeight = barHeight(data);
                }
                this.getMarkCoord(seriesIdx, data, start);
                Vector3.copy(normal, start);
                Vector3.normalize(normal, normal);
                Vector3.scaleAndAdd(end, start, normal, barHeight);
            };
        }(),
        getMarkLinePoints: function () {
            var normal = new Vector3();
            var tangent = new Vector3();
            var bitangent = new Vector3();
            var halfVector = new Vector3();
            return function (seriesIdx, data, p0, p1, p2, p3) {
                var isCurve = !!p2;
                if (!isCurve) {
                    p3 = p1;
                }
                this.getMarkCoord(seriesIdx, data[0], p0);
                this.getMarkCoord(seriesIdx, data[1], p3);
                var normalize = Vector3.normalize;
                var cross = Vector3.cross;
                var sub = Vector3.sub;
                var add = Vector3.add;
                if (isCurve) {
                    normalize(normal, p0);
                    sub(tangent, p3, p0);
                    normalize(tangent, tangent);
                    cross(bitangent, tangent, normal);
                    normalize(bitangent, bitangent);
                    cross(tangent, normal, bitangent);
                    add(p1, normal, tangent);
                    normalize(p1, p1);
                    normalize(normal, p3);
                    sub(tangent, p0, p3);
                    normalize(tangent, tangent);
                    cross(bitangent, tangent, normal);
                    normalize(bitangent, bitangent);
                    cross(tangent, normal, bitangent);
                    add(p2, normal, tangent);
                    normalize(p2, p2);
                    add(halfVector, p0, p3);
                    normalize(halfVector, halfVector);
                    var projDist = Vector3.dot(p0, halfVector);
                    var cosTheta = Vector3.dot(halfVector, p1);
                    var len = (this._earthRadius - projDist) / cosTheta * 2;
                    Vector3.scaleAndAdd(p1, p0, p1, len);
                    Vector3.scaleAndAdd(p2, p3, p2, len);
                }
            };
        }(),
        onframe: function (deltaTime) {
            ChartBase3D.prototype.onframe.call(this, deltaTime);
            this._orbitControl.update(deltaTime);
            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].update(Math.min(deltaTime / 1000, 0.5));
                this.zr.refreshNextFrame();
            }
        },
        refresh: function (newOption) {
            if (!this.baseLayer.renderer) {
                return;
            }
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
            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].dispose();
            }
        }
    };
    zrUtil.inherits(Map3D, ChartBase3D);
    require('echarts/chart').define(ecConfig.CHART_TYPE_MAP3D, Map3D);
    return Map3D;
});define('qtek/Node', [
    'require',
    './core/Base',
    './math/Vector3',
    './math/Quaternion',
    './math/Matrix4',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var Vector3 = require('./math/Vector3');
    var Quaternion = require('./math/Quaternion');
    var Matrix4 = require('./math/Matrix4');
    var glMatrix = require('./dep/glmatrix');
    var mat4 = glMatrix.mat4;
    var nameId = 0;
    var Node = Base.derive({
        name: '',
        position: null,
        rotation: null,
        scale: null,
        worldTransform: null,
        localTransform: null,
        autoUpdateLocalTransform: true,
        _parent: null,
        _scene: null,
        _needsUpdateWorldTransform: true,
        _inIterating: false,
        __depth: 0
    }, function () {
        if (!this.name) {
            this.name = 'NODE_' + nameId++;
        }
        if (!this.position) {
            this.position = new Vector3();
        }
        if (!this.rotation) {
            this.rotation = new Quaternion();
        }
        if (!this.scale) {
            this.scale = new Vector3(1, 1, 1);
        }
        this.worldTransform = new Matrix4();
        this.localTransform = new Matrix4();
        this._children = [];
    }, {
        visible: true,
        isRenderable: function () {
            return false;
        },
        setName: function (name) {
            if (this._scene) {
                delete this._scene._nodeRepository[this.name];
                this._scene._nodeRepository[name] = this;
            }
            this.name = name;
        },
        add: function (node) {
            if (this._inIterating) {
                console.warn('Add operation can cause unpredictable error when in iterating');
            }
            if (node._parent === this) {
                return;
            }
            if (node._parent) {
                node._parent.remove(node);
            }
            node._parent = this;
            this._children.push(node);
            if (this._scene && this._scene !== node.scene) {
                node.traverse(this._addSelfToScene, this);
            }
        },
        remove: function (node) {
            if (this._inIterating) {
                console.warn('Remove operation can cause unpredictable error when in iterating');
            }
            var idx = this._children.indexOf(node);
            if (idx < 0) {
                return;
            }
            this._children.splice(idx, 1);
            node._parent = null;
            if (this._scene) {
                node.traverse(this._removeSelfFromScene, this);
            }
        },
        getScene: function () {
            return this._scene;
        },
        getParent: function () {
            return this._parent;
        },
        _removeSelfFromScene: function (descendant) {
            descendant._scene.removeFromScene(descendant);
            descendant._scene = null;
        },
        _addSelfToScene: function (descendant) {
            this._scene.addToScene(descendant);
            descendant._scene = this._scene;
        },
        isAncestor: function (node) {
            var parent = node._parent;
            while (parent) {
                if (parent === this) {
                    return true;
                }
                parent = parent._parent;
            }
            return false;
        },
        children: function () {
            return this._children.slice();
        },
        childAt: function (idx) {
            return this._children[idx];
        },
        getChildByName: function (name) {
            for (var i = 0; i < this._children.length; i++) {
                if (this._children[i].name === name) {
                    return this._children[i];
                }
            }
        },
        getDescendantByName: function (name) {
            for (var i = 0; i < this._children.length; i++) {
                var child = this._children[i];
                if (child.name === name) {
                    return child;
                } else {
                    var res = child.getDescendantByName(name);
                    if (res) {
                        return res;
                    }
                }
            }
        },
        queryNode: function (path) {
            if (!path) {
                return;
            }
            var pathArr = path.split('/');
            var current = this;
            for (var i = 0; i < pathArr.length; i++) {
                var name = pathArr[i];
                if (!name) {
                    continue;
                }
                var found = false;
                for (var j = 0; j < current._children.length; j++) {
                    var child = current._children[j];
                    if (child.name === name) {
                        current = child;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return;
                }
            }
            return current;
        },
        getPath: function (rootNode) {
            if (!this._parent) {
                return '/';
            }
            var current = this._parent;
            var path = this.name;
            while (current._parent) {
                path = current.name + '/' + path;
                if (current._parent == rootNode) {
                    break;
                }
                current = current._parent;
            }
            if (!current._parent && rootNode) {
                return null;
            }
            return path;
        },
        traverse: function (callback, context, ctor) {
            this._inIterating = true;
            if (ctor === undefined || this.constructor === ctor) {
                callback.call(context, this);
            }
            var _children = this._children;
            for (var i = 0, len = _children.length; i < len; i++) {
                _children[i].traverse(callback, context, ctor);
            }
            this._inIterating = false;
        },
        setLocalTransform: function (matrix) {
            mat4.copy(this.localTransform._array, matrix._array);
            this.decomposeLocalTransform();
        },
        decomposeLocalTransform: function (keepScale) {
            var scale = !keepScale ? this.scale : null;
            this.localTransform.decomposeMatrix(scale, this.rotation, this.position);
        },
        setWorldTransform: function (matrix) {
            mat4.copy(this.worldTransform._array, matrix._array);
            this.decomposeWorldTransform();
        },
        decomposeWorldTransform: function () {
            var tmp = mat4.create();
            return function (keepScale) {
                if (this._parent) {
                    mat4.invert(tmp, this._parent.worldTransform._array);
                    mat4.multiply(this.localTransform._array, tmp, this.worldTransform._array);
                } else {
                    mat4.copy(this.localTransform._array, this.worldTransform._array);
                }
                var scale = !keepScale ? this.scale : null;
                this.localTransform.decomposeMatrix(scale, this.rotation, this.position);
            };
        }(),
        updateLocalTransform: function () {
            var position = this.position;
            var rotation = this.rotation;
            var scale = this.scale;
            if (position._dirty || scale._dirty || rotation._dirty) {
                var m = this.localTransform._array;
                mat4.fromRotationTranslation(m, rotation._array, position._array);
                mat4.scale(m, m, scale._array);
                rotation._dirty = false;
                scale._dirty = false;
                position._dirty = false;
                this._needsUpdateWorldTransform = true;
            }
        },
        updateWorldTransform: function () {
            if (this._parent) {
                mat4.multiply(this.worldTransform._array, this._parent.worldTransform._array, this.localTransform._array);
            } else {
                mat4.copy(this.worldTransform._array, this.localTransform._array);
            }
        },
        update: function (forceUpdateWorld) {
            if (this.autoUpdateLocalTransform) {
                this.updateLocalTransform();
            } else {
                forceUpdateWorld = true;
            }
            if (forceUpdateWorld || this._needsUpdateWorldTransform) {
                this.updateWorldTransform();
                forceUpdateWorld = true;
                this._needsUpdateWorldTransform = false;
            }
            for (var i = 0, len = this._children.length; i < len; i++) {
                this._children[i].update(forceUpdateWorld);
            }
        },
        getWorldPosition: function (out) {
            var m = this.worldTransform._array;
            if (out) {
                out._array[0] = m[12];
                out._array[1] = m[13];
                out._array[2] = m[14];
                return out;
            } else {
                return new Vector3(m[12], m[13], m[14]);
            }
        },
        clone: function () {
            var node = new this.constructor();
            node.setName(this.name);
            node.position.copy(this.position);
            node.rotation.copy(this.rotation);
            node.scale.copy(this.scale);
            for (var i = 0; i < this._children.length; i++) {
                node.add(this._children[i].clone());
            }
            return node;
        },
        rotateAround: function () {
            var v = new Vector3();
            var RTMatrix = new Matrix4();
            return function (point, axis, angle) {
                v.copy(this.position).subtract(point);
                this.localTransform.identity();
                this.localTransform.translate(point);
                this.localTransform.rotate(angle, axis);
                RTMatrix.fromRotationTranslation(this.rotation, v);
                this.localTransform.multiply(RTMatrix);
                this.localTransform.scale(this.scale);
                this.decomposeLocalTransform();
                this._needsUpdateWorldTransform = true;
            };
        }(),
        lookAt: function () {
            var m = new Matrix4();
            return function (target, up) {
                m.lookAt(this.position, target, up || this.localTransform.y).invert();
                m.decomposeMatrix(null, this.rotation, this.position);
            };
        }()
    });
    return Node;
});define('qtek/Mesh', [
    'require',
    './Renderable',
    './core/glenum'
], function (require) {
    'use strict';
    var Renderable = require('./Renderable');
    var glenum = require('./core/glenum');
    var Mesh = Renderable.derive({
        skeleton: null,
        joints: null
    }, function () {
        if (!this.joints) {
            this.joints = [];
        }
    }, {
        render: function (_gl, globalMaterial) {
            var material = globalMaterial || this.material;
            if (this.skeleton) {
                var skinMatricesArray = this.skeleton.getSubSkinMatrices(this.__GUID__, this.joints);
                material.shader.setUniformBySemantic(_gl, 'SKIN_MATRIX', skinMatricesArray);
            }
            return Renderable.prototype.render.call(this, _gl, globalMaterial);
        }
    });
    Mesh.POINTS = glenum.POINTS;
    Mesh.LINES = glenum.LINES;
    Mesh.LINE_LOOP = glenum.LINE_LOOP;
    Mesh.LINE_STRIP = glenum.LINE_STRIP;
    Mesh.TRIANGLES = glenum.TRIANGLES;
    Mesh.TRIANGLE_STRIP = glenum.TRIANGLE_STRIP;
    Mesh.TRIANGLE_FAN = glenum.TRIANGLE_FAN;
    Mesh.BACK = glenum.BACK;
    Mesh.FRONT = glenum.FRONT;
    Mesh.FRONT_AND_BACK = glenum.FRONT_AND_BACK;
    Mesh.CW = glenum.CW;
    Mesh.CCW = glenum.CCW;
    return Mesh;
});define('qtek/geometry/Sphere', [
    'require',
    '../DynamicGeometry',
    '../dep/glmatrix',
    '../math/BoundingBox'
], function (require) {
    'use strict';
    var DynamicGeometry = require('../DynamicGeometry');
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;
    var BoundingBox = require('../math/BoundingBox');
    var Sphere = DynamicGeometry.derive({
        widthSegments: 20,
        heightSegments: 20,
        phiStart: 0,
        phiLength: Math.PI * 2,
        thetaStart: 0,
        thetaLength: Math.PI,
        radius: 1
    }, function () {
        this.build();
    }, {
        build: function () {
            var positions = this.attributes.position.value;
            var texcoords = this.attributes.texcoord0.value;
            var normals = this.attributes.normal.value;
            positions.length = 0;
            texcoords.length = 0;
            normals.length = 0;
            this.faces.length = 0;
            var x, y, z, u, v, i, j;
            var normal;
            var heightSegments = this.heightSegments;
            var widthSegments = this.widthSegments;
            var radius = this.radius;
            var phiStart = this.phiStart;
            var phiLength = this.phiLength;
            var thetaStart = this.thetaStart;
            var thetaLength = this.thetaLength;
            var radius = this.radius;
            for (j = 0; j <= heightSegments; j++) {
                for (i = 0; i <= widthSegments; i++) {
                    u = i / widthSegments;
                    v = j / heightSegments;
                    x = -radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                    y = radius * Math.cos(thetaStart + v * thetaLength);
                    z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                    positions.push(vec3.fromValues(x, y, z));
                    texcoords.push(vec2.fromValues(u, v));
                    normal = vec3.fromValues(x, y, z);
                    vec3.normalize(normal, normal);
                    normals.push(normal);
                }
            }
            var i1, i2, i3, i4;
            var faces = this.faces;
            var len = widthSegments + 1;
            for (j = 0; j < heightSegments; j++) {
                for (i = 0; i < widthSegments; i++) {
                    i2 = j * len + i;
                    i1 = j * len + i + 1;
                    i4 = (j + 1) * len + i + 1;
                    i3 = (j + 1) * len + i;
                    faces.push(vec3.fromValues(i1, i2, i4));
                    faces.push(vec3.fromValues(i2, i3, i4));
                }
            }
            this.boundingBox = new BoundingBox();
            this.boundingBox.max.set(radius, radius, radius);
            this.boundingBox.min.set(-radius, -radius, -radius);
        }
    });
    return Sphere;
});define('qtek/Material', [
    'require',
    './core/Base',
    './Texture'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var Texture = require('./Texture');
    var Material = Base.derive({
        name: '',
        uniforms: null,
        shader: null,
        depthTest: true,
        depthMask: true,
        transparent: false,
        blend: null,
        _enabledUniforms: null
    }, function () {
        if (!this.name) {
            this.name = 'MATERIAL_' + this.__GUID__;
        }
        if (this.shader) {
            this.attachShader(this.shader);
        }
    }, {
        bind: function (_gl, prevMaterial) {
            var slot = 0;
            var sameShader = prevMaterial && prevMaterial.shader === this.shader;
            for (var u = 0; u < this._enabledUniforms.length; u++) {
                var symbol = this._enabledUniforms[u];
                var uniform = this.uniforms[symbol];
                if (sameShader) {
                    if (prevMaterial.uniforms[symbol].value === uniform.value) {
                        continue;
                    }
                }
                if (uniform.value === undefined) {
                    console.warn('Uniform value "' + symbol + '" is undefined');
                    continue;
                } else if (uniform.value === null) {
                    continue;
                } else if (uniform.value instanceof Array && !uniform.value.length) {
                    continue;
                } else if (uniform.value instanceof Texture) {
                    var res = this.shader.setUniform(_gl, '1i', symbol, slot);
                    if (!res) {
                        continue;
                    }
                    var texture = uniform.value;
                    _gl.activeTexture(_gl.TEXTURE0 + slot);
                    if (texture.isRenderable()) {
                        texture.bind(_gl);
                    } else {
                        texture.unbind(_gl);
                    }
                    slot++;
                } else if (uniform.value instanceof Array) {
                    if (uniform.value.length === 0) {
                        continue;
                    }
                    var exampleValue = uniform.value[0];
                    if (exampleValue instanceof Texture) {
                        if (!this.shader.hasUniform(symbol)) {
                            continue;
                        }
                        var arr = [];
                        for (var i = 0; i < uniform.value.length; i++) {
                            var texture = uniform.value[i];
                            _gl.activeTexture(_gl.TEXTURE0 + slot);
                            if (texture.isRenderable()) {
                                texture.bind(_gl);
                            } else {
                                texture.unbind(_gl);
                            }
                            arr.push(slot++);
                        }
                        this.shader.setUniform(_gl, '1iv', symbol, arr);
                    } else {
                        this.shader.setUniform(_gl, uniform.type, symbol, uniform.value);
                    }
                } else {
                    this.shader.setUniform(_gl, uniform.type, symbol, uniform.value);
                }
            }
        },
        setUniform: function (symbol, value) {
            var uniform = this.uniforms[symbol];
            if (uniform) {
                uniform.value = value;
            }
        },
        setUniforms: function (obj) {
            for (var key in obj) {
                var val = obj[key];
                this.setUniform(key, val);
            }
        },
        enableUniform: function (symbol) {
            if (this.uniforms[symbol] && !this.isUniformEnabled(symbol)) {
                this._enabledUniforms.push(symbol);
            }
        },
        disableUniform: function (symbol) {
            var idx = this._enabledUniforms.indexOf(symbol);
            if (idx >= 0) {
                this._enabledUniforms.splice(idx, 1);
            }
        },
        isUniformEnabled: function (symbol) {
            return this._enabledUniforms.indexOf(symbol) >= 0;
        },
        set: function (symbol, value) {
            if (typeof symbol === 'object') {
                for (var key in symbol) {
                    var val = symbol[key];
                    this.set(key, val);
                }
            } else {
                var uniform = this.uniforms[symbol];
                if (uniform) {
                    uniform.value = value;
                }
            }
        },
        get: function (symbol) {
            var uniform = this.uniforms[symbol];
            if (uniform) {
                return uniform.value;
            }
        },
        attachShader: function (shader, keepUniform) {
            if (this.shader) {
                this.shader.detached();
            }
            var originalUniforms = this.uniforms;
            this.uniforms = shader.createUniforms();
            this.shader = shader;
            this._enabledUniforms = Object.keys(this.uniforms);
            if (keepUniform) {
                for (var symbol in originalUniforms) {
                    if (this.uniforms[symbol]) {
                        this.uniforms[symbol].value = originalUniforms[symbol].value;
                    }
                }
            }
            shader.attached();
        },
        detachShader: function () {
            this.shader.detached();
            this.shader = null;
            this.uniforms = {};
        },
        clone: function () {
            var material = new Material({
                name: this.name,
                shader: this.shader
            });
            for (var symbol in this.uniforms) {
                material.uniforms[symbol].value = this.uniforms[symbol].value;
            }
            material.depthTest = this.depthTest;
            material.depthMask = this.depthMask;
            material.transparent = this.transparent;
            material.blend = this.blend;
            return material;
        },
        dispose: function (_gl, disposeTexture) {
            if (disposeTexture) {
                for (var name in this.uniforms) {
                    var val = this.uniforms[name].value;
                    if (!val) {
                        continue;
                    }
                    if (val instanceof Texture) {
                        val.dispose(_gl);
                    } else if (val instanceof Array) {
                        for (var i = 0; i < val.length; i++) {
                            if (val[i] instanceof Texture) {
                                val[i].dispose(_gl);
                            }
                        }
                    }
                }
            }
            var shader = this.shader;
            if (shader) {
                this.detachShader();
                if (!shader.isAttachedToAny()) {
                    shader.dispose(_gl);
                }
            }
        }
    });
    return Material;
});define('qtek/Texture2D', [
    'require',
    './Texture',
    './core/glinfo',
    './core/glenum'
], function (require) {
    var Texture = require('./Texture');
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var Texture2D = Texture.derive(function () {
        return {
            image: null,
            pixels: null,
            mipmaps: []
        };
    }, {
        update: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this._cache.get('webgl_texture'));
            this.beforeUpdate(_gl);
            var glFormat = this.format;
            var glType = this.type;
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, this.wrapS);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, this.wrapT);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, this.magFilter);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, this.minFilter);
            var anisotropicExt = glinfo.getExtension(_gl, 'EXT_texture_filter_anisotropic');
            if (anisotropicExt && this.anisotropic > 1) {
                _gl.texParameterf(_gl.TEXTURE_2D, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }
            if (glType === 36193) {
                var halfFloatExt = glinfo.getExtension(_gl, 'OES_texture_half_float');
                if (!halfFloatExt) {
                    glType = glenum.FLOAT;
                }
            }
            if (this.image) {
                _gl.texImage2D(_gl.TEXTURE_2D, 0, glFormat, glFormat, glType, this.image);
            } else {
                if (glFormat <= Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT && glFormat >= Texture.COMPRESSED_RGB_S3TC_DXT1_EXT) {
                    _gl.compressedTexImage2D(_gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, this.pixels);
                } else {
                    _gl.texImage2D(_gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels);
                }
            }
            if (this.useMipmap) {
                if (this.mipmaps.length) {
                    if (this.image) {
                        for (var i = 0; i < this.mipmaps.length; i++) {
                            if (this.mipmaps[i]) {
                                _gl.texImage2D(_gl.TEXTURE_2D, i, glFormat, glFormat, glType, this.mipmaps[i]);
                            }
                        }
                    } else if (this.pixels) {
                        var width = this.width;
                        var height = this.height;
                        for (var i = 0; i < this.mipmaps.length; i++) {
                            if (this.mipmaps[i]) {
                                if (glFormat <= Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT && glFormat >= Texture.COMPRESSED_RGB_S3TC_DXT1_EXT) {
                                    _gl.compressedTexImage2D(_gl.TEXTURE_2D, 0, glFormat, width, height, 0, this.mipmaps[i]);
                                } else {
                                    _gl.texImage2D(_gl.TEXTURE_2D, i, glFormat, width, height, 0, glFormat, glType, this.mipmaps[i]);
                                }
                            }
                            width /= 2;
                            height /= 2;
                        }
                    }
                } else if (!this.NPOT && !this.mipmaps.length) {
                    _gl.generateMipmap(_gl.TEXTURE_2D);
                }
            }
            _gl.bindTexture(_gl.TEXTURE_2D, null);
        },
        generateMipmap: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this._cache.get('webgl_texture'));
            _gl.generateMipmap(_gl.TEXTURE_2D);
        },
        isPowerOfTwo: function () {
            var width;
            var height;
            if (this.image) {
                width = this.image.width;
                height = this.image.height;
            } else {
                width = this.width;
                height = this.height;
            }
            return (width & width - 1) === 0 && (height & height - 1) === 0;
        },
        isRenderable: function () {
            if (this.image) {
                return this.image.nodeName === 'CANVAS' || this.image.complete;
            } else {
                return this.width && this.height;
            }
        },
        bind: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this.getWebGLTexture(_gl));
        },
        unbind: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, null);
        },
        load: function (src) {
            var image = new Image();
            var self = this;
            image.onload = function () {
                self.dirty();
                self.trigger('success', self);
                image.onload = null;
            };
            image.onerror = function () {
                self.trigger('error', self);
                image.onerror = null;
            };
            image.src = src;
            this.image = image;
            return this;
        }
    });
    return Texture2D;
});define('qtek/math/Vector3', [
    'require',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var Vector3 = function (x, y, z) {
        x = x || 0;
        y = y || 0;
        z = z || 0;
        this._array = vec3.fromValues(x, y, z);
        this._dirty = true;
    };
    Vector3.prototype = {
        constructor: Vector3,
        add: function (b) {
            vec3.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        set: function (x, y, z) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._dirty = true;
            return this;
        },
        setArray: function (arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Vector3(this.x, this.y, this.z);
        },
        copy: function (b) {
            vec3.copy(this._array, b._array);
            this._dirty = true;
            return this;
        },
        cross: function (out, b) {
            vec3.cross(out._array, this._array, b._array);
            out._dirty = true;
            return this;
        },
        dist: function (b) {
            return vec3.dist(this._array, b._array);
        },
        distance: function (b) {
            return vec3.distance(this._array, b._array);
        },
        div: function (b) {
            vec3.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        divide: function (b) {
            vec3.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        dot: function (b) {
            return vec3.dot(this._array, b._array);
        },
        len: function () {
            return vec3.len(this._array);
        },
        length: function () {
            return vec3.length(this._array);
        },
        lerp: function (a, b, t) {
            vec3.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        min: function (b) {
            vec3.min(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        max: function (b) {
            vec3.max(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            vec3.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            vec3.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        negate: function () {
            vec3.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },
        normalize: function () {
            vec3.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },
        random: function (scale) {
            vec3.random(this._array, scale);
            this._dirty = true;
            return this;
        },
        scale: function (s) {
            vec3.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        scaleAndAdd: function (b, s) {
            vec3.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },
        sqrDist: function (b) {
            return vec3.sqrDist(this._array, b._array);
        },
        squaredDistance: function (b) {
            return vec3.squaredDistance(this._array, b._array);
        },
        sqrLen: function () {
            return vec3.sqrLen(this._array);
        },
        squaredLength: function () {
            return vec3.squaredLength(this._array);
        },
        sub: function (b) {
            vec3.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        subtract: function (b) {
            vec3.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        transformMat3: function (m) {
            vec3.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat4: function (m) {
            vec3.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformQuat: function (q) {
            vec3.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },
        applyProjection: function (m) {
            var v = this._array;
            m = m._array;
            if (m[15] === 0) {
                var w = -1 / v[2];
                v[0] = m[0] * v[0] * w;
                v[1] = m[5] * v[1] * w;
                v[2] = (m[10] * v[2] + m[14]) * w;
            } else {
                v[0] = m[0] * v[0] + m[12];
                v[1] = m[5] * v[1] + m[13];
                v[2] = m[10] * v[2] + m[14];
            }
            this._dirty = true;
            return this;
        },
        setEulerFromQuaternion: function (q) {
        },
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Vector3.prototype;
        Object.defineProperty(proto, 'x', {
            get: function () {
                return this._array[0];
            },
            set: function (value) {
                this._array[0] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                return this._array[1];
            },
            set: function (value) {
                this._array[1] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'z', {
            get: function () {
                return this._array[2];
            },
            set: function (value) {
                this._array[2] = value;
                this._dirty = true;
            }
        });
    }
    Vector3.add = function (out, a, b) {
        vec3.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.set = function (out, x, y, z) {
        vec3.set(out._array, x, y, z);
        out._dirty = true;
    };
    Vector3.copy = function (out, b) {
        vec3.copy(out._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.cross = function (out, a, b) {
        vec3.cross(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.dist = function (a, b) {
        return vec3.distance(a._array, b._array);
    };
    Vector3.distance = Vector3.dist;
    Vector3.div = function (out, a, b) {
        vec3.divide(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.divide = Vector3.div;
    Vector3.dot = function (a, b) {
        return vec3.dot(a._array, b._array);
    };
    Vector3.len = function (b) {
        return vec3.length(b._array);
    };
    Vector3.lerp = function (out, a, b, t) {
        vec3.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Vector3.min = function (out, a, b) {
        vec3.min(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.max = function (out, a, b) {
        vec3.max(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.mul = function (out, a, b) {
        vec3.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.multiply = Vector3.mul;
    Vector3.negate = function (out, a) {
        vec3.negate(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Vector3.normalize = function (out, a) {
        vec3.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Vector3.random = function (out, scale) {
        vec3.random(out._array, scale);
        out._dirty = true;
        return out;
    };
    Vector3.scale = function (out, a, scale) {
        vec3.scale(out._array, a._array, scale);
        out._dirty = true;
        return out;
    };
    Vector3.scaleAndAdd = function (out, a, b, scale) {
        vec3.scaleAndAdd(out._array, a._array, b._array, scale);
        out._dirty = true;
        return out;
    };
    Vector3.sqrDist = function (a, b) {
        return vec3.sqrDist(a._array, b._array);
    };
    Vector3.squaredDistance = Vector3.sqrDist;
    Vector3.sqrLen = function (a) {
        return vec3.sqrLen(a._array);
    };
    Vector3.squaredLength = Vector3.sqrLen;
    Vector3.sub = function (out, a, b) {
        vec3.subtract(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector3.subtract = Vector3.sub;
    Vector3.transformMat3 = function (out, a, m) {
        vec3.transformMat3(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector3.transformMat4 = function (out, a, m) {
        vec3.transformMat4(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector3.transformQuat = function (out, a, q) {
        vec3.transformQuat(out._array, a._array, q._array);
        out._dirty = true;
        return out;
    };
    Vector3.POSITIVE_X = new Vector3(1, 0, 0);
    Vector3.NEGATIVE_X = new Vector3(-1, 0, 0);
    Vector3.POSITIVE_Y = new Vector3(0, 1, 0);
    Vector3.NEGATIVE_Y = new Vector3(0, -1, 0);
    Vector3.POSITIVE_Z = new Vector3(0, 0, 1);
    Vector3.NEGATIVE_Z = new Vector3(0, 0, -1);
    Vector3.UP = new Vector3(0, 1, 0);
    Vector3.ZERO = new Vector3(0, 0, 0);
    return Vector3;
});define('qtek/math/Matrix4', [
    'require',
    '../dep/glmatrix',
    './Vector3'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var Vector3 = require('./Vector3');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var mat3 = glMatrix.mat3;
    var quat = glMatrix.quat;
    function makeProperty(n) {
        return {
            set: function (value) {
                this._array[n] = value;
                this._dirty = true;
            },
            get: function () {
                return this._array[n];
            }
        };
    }
    var Matrix4 = function () {
        this._axisX = new Vector3();
        this._axisY = new Vector3();
        this._axisZ = new Vector3();
        this._array = mat4.create();
        this._dirty = true;
    };
    Matrix4.prototype = {
        constructor: Matrix4,
        adjoint: function () {
            mat4.adjoint(this._array, this._array);
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Matrix4().copy(this);
        },
        copy: function (a) {
            mat4.copy(this._array, a._array);
            this._dirty = true;
            return this;
        },
        determinant: function () {
            return mat4.determinant(this._array);
        },
        fromQuat: function (q) {
            mat4.fromQuat(this._array, q._array);
            this._dirty = true;
            return this;
        },
        fromRotationTranslation: function (q, v) {
            mat4.fromRotationTranslation(this._array, q._array, v._array);
            this._dirty = true;
            return this;
        },
        fromMat2d: function (m2d) {
            Matrix4.fromMat2d(this, m2d);
            return this;
        },
        frustum: function (left, right, bottom, top, near, far) {
            mat4.frustum(this._array, left, right, bottom, top, near, far);
            this._dirty = true;
            return this;
        },
        identity: function () {
            mat4.identity(this._array);
            this._dirty = true;
            return this;
        },
        invert: function () {
            mat4.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },
        lookAt: function (eye, center, up) {
            mat4.lookAt(this._array, eye._array, center._array, up._array);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            mat4.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mulLeft: function (a) {
            mat4.mul(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            mat4.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiplyLeft: function (a) {
            mat4.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        ortho: function (left, right, bottom, top, near, far) {
            mat4.ortho(this._array, left, right, bottom, top, near, far);
            this._dirty = true;
            return this;
        },
        perspective: function (fovy, aspect, near, far) {
            mat4.perspective(this._array, fovy, aspect, near, far);
            this._dirty = true;
            return this;
        },
        rotate: function (rad, axis) {
            mat4.rotate(this._array, this._array, rad, axis._array);
            this._dirty = true;
            return this;
        },
        rotateX: function (rad) {
            mat4.rotateX(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateY: function (rad) {
            mat4.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateZ: function (rad) {
            mat4.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        scale: function (v) {
            mat4.scale(this._array, this._array, v._array);
            this._dirty = true;
            return this;
        },
        translate: function (v) {
            mat4.translate(this._array, this._array, v._array);
            this._dirty = true;
            return this;
        },
        transpose: function () {
            mat4.transpose(this._array, this._array);
            this._dirty = true;
            return this;
        },
        decomposeMatrix: function () {
            var x = vec3.create();
            var y = vec3.create();
            var z = vec3.create();
            var m3 = mat3.create();
            return function (scale, rotation, position) {
                var el = this._array;
                vec3.set(x, el[0], el[1], el[2]);
                vec3.set(y, el[4], el[5], el[6]);
                vec3.set(z, el[8], el[9], el[10]);
                var sx = vec3.length(x);
                var sy = vec3.length(y);
                var sz = vec3.length(z);
                if (scale) {
                    scale.x = sx;
                    scale.y = sy;
                    scale.z = sz;
                    scale._dirty = true;
                }
                position.set(el[12], el[13], el[14]);
                mat3.fromMat4(m3, el);
                mat3.transpose(m3, m3);
                m3[0] /= sx;
                m3[1] /= sx;
                m3[2] /= sx;
                m3[3] /= sy;
                m3[4] /= sy;
                m3[5] /= sy;
                m3[6] /= sz;
                m3[7] /= sz;
                m3[8] /= sz;
                quat.fromMat3(rotation._array, m3);
                quat.normalize(rotation._array, rotation._array);
                rotation._dirty = true;
                position._dirty = true;
            };
        }(),
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Matrix4.prototype;
        Object.defineProperty(proto, 'z', {
            get: function () {
                var el = this._array;
                this._axisZ.set(el[8], el[9], el[10]);
                return this._axisZ;
            },
            set: function (v) {
                var el = this._array;
                v = v._array;
                el[8] = v[0];
                el[9] = v[1];
                el[10] = v[2];
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                var el = this._array;
                this._axisY.set(el[4], el[5], el[6]);
                return this._axisY;
            },
            set: function (v) {
                var el = this._array;
                v = v._array;
                el[4] = v[0];
                el[5] = v[1];
                el[6] = v[2];
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'x', {
            get: function () {
                var el = this._array;
                this._axisX.set(el[0], el[1], el[2]);
                return this._axisX;
            },
            set: function (v) {
                var el = this._array;
                v = v._array;
                el[0] = v[0];
                el[1] = v[1];
                el[2] = v[2];
                this._dirty = true;
            }
        });
    }
    Matrix4.adjoint = function (out, a) {
        mat4.adjoint(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.copy = function (out, a) {
        mat4.copy(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.determinant = function (a) {
        return mat4.determinant(a._array);
    };
    Matrix4.identity = function (out) {
        mat4.identity(out._array);
        out._dirty = true;
        return out;
    };
    Matrix4.ortho = function (out, left, right, bottom, top, near, far) {
        mat4.ortho(out._array, left, right, bottom, top, near, far);
        out._dirty = true;
        return out;
    };
    Matrix4.perspective = function (out, fovy, aspect, near, far) {
        mat4.perspective(out._array, fovy, aspect, near, far);
        out._dirty = true;
        return out;
    };
    Matrix4.lookAt = function (out, eye, center, up) {
        mat4.lookAt(out._array, eye._array, center._array, up._array);
        out._dirty = true;
        return out;
    };
    Matrix4.invert = function (out, a) {
        mat4.invert(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.mul = function (out, a, b) {
        mat4.mul(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Matrix4.multiply = Matrix4.mul;
    Matrix4.fromQuat = function (out, q) {
        mat4.fromQuat(out._array, q._array);
        out._dirty = true;
        return out;
    };
    Matrix4.fromRotationTranslation = function (out, q, v) {
        mat4.fromRotationTranslation(out._array, q._array, v._array);
        out._dirty = true;
        return out;
    };
    Matrix4.fromMat2d = function (m4, m2d) {
        m4._dirty = true;
        var m2d = m2d._array;
        var m4 = m4._array;
        m4[0] = m2d[0];
        m4[4] = m2d[2];
        m4[12] = m2d[4];
        m4[1] = m2d[1];
        m4[5] = m2d[3];
        m4[13] = m2d[5];
        return m4;
    };
    Matrix4.rotate = function (out, a, rad, axis) {
        mat4.rotate(out._array, a._array, rad, axis._array);
        out._dirty = true;
        return out;
    };
    Matrix4.rotateX = function (out, a, rad) {
        mat4.rotateX(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Matrix4.rotateY = function (out, a, rad) {
        mat4.rotateY(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Matrix4.rotateZ = function (out, a, rad) {
        mat4.rotateZ(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Matrix4.scale = function (out, a, v) {
        mat4.scale(out._array, a._array, v._array);
        out._dirty = true;
        return out;
    };
    Matrix4.transpose = function (out, a) {
        mat4.transpose(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Matrix4.translate = function (out, a, v) {
        mat4.translate(out._array, a._array, v._array);
        out._dirty = true;
        return out;
    };
    return Matrix4;
});define('qtek/core/glenum', [], function () {
    return {
        DEPTH_BUFFER_BIT: 256,
        STENCIL_BUFFER_BIT: 1024,
        COLOR_BUFFER_BIT: 16384,
        POINTS: 0,
        LINES: 1,
        LINE_LOOP: 2,
        LINE_STRIP: 3,
        TRIANGLES: 4,
        TRIANGLE_STRIP: 5,
        TRIANGLE_FAN: 6,
        ZERO: 0,
        ONE: 1,
        SRC_COLOR: 768,
        ONE_MINUS_SRC_COLOR: 769,
        SRC_ALPHA: 770,
        ONE_MINUS_SRC_ALPHA: 771,
        DST_ALPHA: 772,
        ONE_MINUS_DST_ALPHA: 773,
        DST_COLOR: 774,
        ONE_MINUS_DST_COLOR: 775,
        SRC_ALPHA_SATURATE: 776,
        FUNC_ADD: 32774,
        BLEND_EQUATION: 32777,
        BLEND_EQUATION_RGB: 32777,
        BLEND_EQUATION_ALPHA: 34877,
        FUNC_SUBTRACT: 32778,
        FUNC_REVERSE_SUBTRACT: 32779,
        BLEND_DST_RGB: 32968,
        BLEND_SRC_RGB: 32969,
        BLEND_DST_ALPHA: 32970,
        BLEND_SRC_ALPHA: 32971,
        CONSTANT_COLOR: 32769,
        ONE_MINUS_CONSTANT_COLOR: 32770,
        CONSTANT_ALPHA: 32771,
        ONE_MINUS_CONSTANT_ALPHA: 32772,
        BLEND_COLOR: 32773,
        ARRAY_BUFFER: 34962,
        ELEMENT_ARRAY_BUFFER: 34963,
        ARRAY_BUFFER_BINDING: 34964,
        ELEMENT_ARRAY_BUFFER_BINDING: 34965,
        STREAM_DRAW: 35040,
        STATIC_DRAW: 35044,
        DYNAMIC_DRAW: 35048,
        BUFFER_SIZE: 34660,
        BUFFER_USAGE: 34661,
        CURRENT_VERTEX_ATTRIB: 34342,
        FRONT: 1028,
        BACK: 1029,
        FRONT_AND_BACK: 1032,
        CULL_FACE: 2884,
        BLEND: 3042,
        DITHER: 3024,
        STENCIL_TEST: 2960,
        DEPTH_TEST: 2929,
        SCISSOR_TEST: 3089,
        POLYGON_OFFSET_FILL: 32823,
        SAMPLE_ALPHA_TO_COVERAGE: 32926,
        SAMPLE_COVERAGE: 32928,
        NO_ERROR: 0,
        INVALID_ENUM: 1280,
        INVALID_VALUE: 1281,
        INVALID_OPERATION: 1282,
        OUT_OF_MEMORY: 1285,
        CW: 2304,
        CCW: 2305,
        LINE_WIDTH: 2849,
        ALIASED_POINT_SIZE_RANGE: 33901,
        ALIASED_LINE_WIDTH_RANGE: 33902,
        CULL_FACE_MODE: 2885,
        FRONT_FACE: 2886,
        DEPTH_RANGE: 2928,
        DEPTH_WRITEMASK: 2930,
        DEPTH_CLEAR_VALUE: 2931,
        DEPTH_FUNC: 2932,
        STENCIL_CLEAR_VALUE: 2961,
        STENCIL_FUNC: 2962,
        STENCIL_FAIL: 2964,
        STENCIL_PASS_DEPTH_FAIL: 2965,
        STENCIL_PASS_DEPTH_PASS: 2966,
        STENCIL_REF: 2967,
        STENCIL_VALUE_MASK: 2963,
        STENCIL_WRITEMASK: 2968,
        STENCIL_BACK_FUNC: 34816,
        STENCIL_BACK_FAIL: 34817,
        STENCIL_BACK_PASS_DEPTH_FAIL: 34818,
        STENCIL_BACK_PASS_DEPTH_PASS: 34819,
        STENCIL_BACK_REF: 36003,
        STENCIL_BACK_VALUE_MASK: 36004,
        STENCIL_BACK_WRITEMASK: 36005,
        VIEWPORT: 2978,
        SCISSOR_BOX: 3088,
        COLOR_CLEAR_VALUE: 3106,
        COLOR_WRITEMASK: 3107,
        UNPACK_ALIGNMENT: 3317,
        PACK_ALIGNMENT: 3333,
        MAX_TEXTURE_SIZE: 3379,
        MAX_VIEWPORT_DIMS: 3386,
        SUBPIXEL_BITS: 3408,
        RED_BITS: 3410,
        GREEN_BITS: 3411,
        BLUE_BITS: 3412,
        ALPHA_BITS: 3413,
        DEPTH_BITS: 3414,
        STENCIL_BITS: 3415,
        POLYGON_OFFSET_UNITS: 10752,
        POLYGON_OFFSET_FACTOR: 32824,
        TEXTURE_BINDING_2D: 32873,
        SAMPLE_BUFFERS: 32936,
        SAMPLES: 32937,
        SAMPLE_COVERAGE_VALUE: 32938,
        SAMPLE_COVERAGE_INVERT: 32939,
        COMPRESSED_TEXTURE_FORMATS: 34467,
        DONT_CARE: 4352,
        FASTEST: 4353,
        NICEST: 4354,
        GENERATE_MIPMAP_HINT: 33170,
        BYTE: 5120,
        UNSIGNED_BYTE: 5121,
        SHORT: 5122,
        UNSIGNED_SHORT: 5123,
        INT: 5124,
        UNSIGNED_INT: 5125,
        FLOAT: 5126,
        DEPTH_COMPONENT: 6402,
        ALPHA: 6406,
        RGB: 6407,
        RGBA: 6408,
        LUMINANCE: 6409,
        LUMINANCE_ALPHA: 6410,
        UNSIGNED_SHORT_4_4_4_4: 32819,
        UNSIGNED_SHORT_5_5_5_1: 32820,
        UNSIGNED_SHORT_5_6_5: 33635,
        FRAGMENT_SHADER: 35632,
        VERTEX_SHADER: 35633,
        MAX_VERTEX_ATTRIBS: 34921,
        MAX_VERTEX_UNIFORM_VECTORS: 36347,
        MAX_VARYING_VECTORS: 36348,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
        MAX_TEXTURE_IMAGE_UNITS: 34930,
        MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
        SHADER_TYPE: 35663,
        DELETE_STATUS: 35712,
        LINK_STATUS: 35714,
        VALIDATE_STATUS: 35715,
        ATTACHED_SHADERS: 35717,
        ACTIVE_UNIFORMS: 35718,
        ACTIVE_ATTRIBUTES: 35721,
        SHADING_LANGUAGE_VERSION: 35724,
        CURRENT_PROGRAM: 35725,
        NEVER: 512,
        LESS: 513,
        EQUAL: 514,
        LEQUAL: 515,
        GREATER: 516,
        NOTEQUAL: 517,
        GEQUAL: 518,
        ALWAYS: 519,
        KEEP: 7680,
        REPLACE: 7681,
        INCR: 7682,
        DECR: 7683,
        INVERT: 5386,
        INCR_WRAP: 34055,
        DECR_WRAP: 34056,
        VENDOR: 7936,
        RENDERER: 7937,
        VERSION: 7938,
        NEAREST: 9728,
        LINEAR: 9729,
        NEAREST_MIPMAP_NEAREST: 9984,
        LINEAR_MIPMAP_NEAREST: 9985,
        NEAREST_MIPMAP_LINEAR: 9986,
        LINEAR_MIPMAP_LINEAR: 9987,
        TEXTURE_MAG_FILTER: 10240,
        TEXTURE_MIN_FILTER: 10241,
        TEXTURE_WRAP_S: 10242,
        TEXTURE_WRAP_T: 10243,
        TEXTURE_2D: 3553,
        TEXTURE: 5890,
        TEXTURE_CUBE_MAP: 34067,
        TEXTURE_BINDING_CUBE_MAP: 34068,
        TEXTURE_CUBE_MAP_POSITIVE_X: 34069,
        TEXTURE_CUBE_MAP_NEGATIVE_X: 34070,
        TEXTURE_CUBE_MAP_POSITIVE_Y: 34071,
        TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072,
        TEXTURE_CUBE_MAP_POSITIVE_Z: 34073,
        TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074,
        MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
        TEXTURE0: 33984,
        TEXTURE1: 33985,
        TEXTURE2: 33986,
        TEXTURE3: 33987,
        TEXTURE4: 33988,
        TEXTURE5: 33989,
        TEXTURE6: 33990,
        TEXTURE7: 33991,
        TEXTURE8: 33992,
        TEXTURE9: 33993,
        TEXTURE10: 33994,
        TEXTURE11: 33995,
        TEXTURE12: 33996,
        TEXTURE13: 33997,
        TEXTURE14: 33998,
        TEXTURE15: 33999,
        TEXTURE16: 34000,
        TEXTURE17: 34001,
        TEXTURE18: 34002,
        TEXTURE19: 34003,
        TEXTURE20: 34004,
        TEXTURE21: 34005,
        TEXTURE22: 34006,
        TEXTURE23: 34007,
        TEXTURE24: 34008,
        TEXTURE25: 34009,
        TEXTURE26: 34010,
        TEXTURE27: 34011,
        TEXTURE28: 34012,
        TEXTURE29: 34013,
        TEXTURE30: 34014,
        TEXTURE31: 34015,
        ACTIVE_TEXTURE: 34016,
        REPEAT: 10497,
        CLAMP_TO_EDGE: 33071,
        MIRRORED_REPEAT: 33648,
        FLOAT_VEC2: 35664,
        FLOAT_VEC3: 35665,
        FLOAT_VEC4: 35666,
        INT_VEC2: 35667,
        INT_VEC3: 35668,
        INT_VEC4: 35669,
        BOOL: 35670,
        BOOL_VEC2: 35671,
        BOOL_VEC3: 35672,
        BOOL_VEC4: 35673,
        FLOAT_MAT2: 35674,
        FLOAT_MAT3: 35675,
        FLOAT_MAT4: 35676,
        SAMPLER_2D: 35678,
        SAMPLER_CUBE: 35680,
        VERTEX_ATTRIB_ARRAY_ENABLED: 34338,
        VERTEX_ATTRIB_ARRAY_SIZE: 34339,
        VERTEX_ATTRIB_ARRAY_STRIDE: 34340,
        VERTEX_ATTRIB_ARRAY_TYPE: 34341,
        VERTEX_ATTRIB_ARRAY_NORMALIZED: 34922,
        VERTEX_ATTRIB_ARRAY_POINTER: 34373,
        VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 34975,
        COMPILE_STATUS: 35713,
        LOW_FLOAT: 36336,
        MEDIUM_FLOAT: 36337,
        HIGH_FLOAT: 36338,
        LOW_INT: 36339,
        MEDIUM_INT: 36340,
        HIGH_INT: 36341,
        FRAMEBUFFER: 36160,
        RENDERBUFFER: 36161,
        RGBA4: 32854,
        RGB5_A1: 32855,
        RGB565: 36194,
        DEPTH_COMPONENT16: 33189,
        STENCIL_INDEX: 6401,
        STENCIL_INDEX8: 36168,
        DEPTH_STENCIL: 34041,
        RENDERBUFFER_WIDTH: 36162,
        RENDERBUFFER_HEIGHT: 36163,
        RENDERBUFFER_INTERNAL_FORMAT: 36164,
        RENDERBUFFER_RED_SIZE: 36176,
        RENDERBUFFER_GREEN_SIZE: 36177,
        RENDERBUFFER_BLUE_SIZE: 36178,
        RENDERBUFFER_ALPHA_SIZE: 36179,
        RENDERBUFFER_DEPTH_SIZE: 36180,
        RENDERBUFFER_STENCIL_SIZE: 36181,
        FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 36048,
        FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 36049,
        FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 36050,
        FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 36051,
        COLOR_ATTACHMENT0: 36064,
        DEPTH_ATTACHMENT: 36096,
        STENCIL_ATTACHMENT: 36128,
        DEPTH_STENCIL_ATTACHMENT: 33306,
        NONE: 0,
        FRAMEBUFFER_COMPLETE: 36053,
        FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 36054,
        FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 36055,
        FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 36057,
        FRAMEBUFFER_UNSUPPORTED: 36061,
        FRAMEBUFFER_BINDING: 36006,
        RENDERBUFFER_BINDING: 36007,
        MAX_RENDERBUFFER_SIZE: 34024,
        INVALID_FRAMEBUFFER_OPERATION: 1286,
        UNPACK_FLIP_Y_WEBGL: 37440,
        UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
        CONTEXT_LOST_WEBGL: 37442,
        UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
        BROWSER_DEFAULT_WEBGL: 37444
    };
});define('echarts-x/chart/base3d', [
    'require',
    'echarts/config',
    'zrender/tool/util',
    '../component/base3d',
    '../util/color',
    'qtek/core/LRU',
    'qtek/math/Vector3',
    'qtek/math/Matrix4',
    '../entity/marker/MarkLine',
    '../entity/marker/MarkBar',
    '../entity/marker/MarkPoint',
    '../entity/marker/LargeMarkPoint'
], function (require) {
    'use strict';
    var ecConfig = require('echarts/config');
    var zrUtil = require('zrender/tool/util');
    var ComponentBase3D = require('../component/base3d');
    var colorUtil = require('../util/color');
    var LRUCache = require('qtek/core/LRU');
    var Vector3 = require('qtek/math/Vector3');
    var Matrix4 = require('qtek/math/Matrix4');
    var MarkerCtorMap = {
        markLine: require('../entity/marker/MarkLine'),
        markBar: require('../entity/marker/MarkBar'),
        markPoint: require('../entity/marker/MarkPoint'),
        largeMarkPoint: require('../entity/marker/LargeMarkPoint')
    };
    function Base3D(ecTheme, messageCenter, zr, option, myChart) {
        ComponentBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);
        this._markLineList = [];
        this._markLineCount = 0;
        this._markPointList = [];
        this._markPointCount = 0;
        this._markBarList = [];
        this._markBarCount = 0;
        this._largeMarkPointList = [];
        this._largeMarkPointCount = 0;
        this._markList = [];
    }
    ;
    Base3D.prototype = {
        constructor: Base3D,
        beforeBuildMark: function () {
            for (var i = 0; i < this._markList.length; i++) {
                this._markList[i].clear();
            }
            this._markList.length = 0;
            this._markBarCount = 0;
            this._markPointCount = 0;
            this._markLineCount = 0;
            this._largeMarkPointCount = 0;
        },
        buildMark: function (seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];
            if (serie.markPoint) {
                zrUtil.merge(zrUtil.merge(serie.markPoint, this.ecTheme.markPoint || {}), ecConfig.markPoint);
                if (serie.markPoint.large) {
                    this._buildSingleTypeMarker('largeMarkPoint', seriesIndex, parentNode);
                } else {
                    this._buildSingleTypeMarker('markPoint', seriesIndex, parentNode);
                }
            }
            if (serie.markLine) {
                zrUtil.merge(zrUtil.merge(serie.markLine, this.ecTheme.markLine || {}), ecConfig.markLine);
                this._buildSingleTypeMarker('markLine', seriesIndex, parentNode);
            }
            if (serie.markBar) {
                zrUtil.merge(zrUtil.merge(serie.markBar, this.ecTheme.markBar || {}), ecConfig.markBar);
                this._buildSingleTypeMarker('markBar', seriesIndex, parentNode);
            }
        },
        afterBuildMark: function () {
            for (var i = this._markPointCount; i < this._markPointList.length; i++) {
                this._disposeSingleSerieMark(this._markPointList[i]);
            }
            this._markPointList.length = this._markPointCount;
            for (var i = this._largeMarkPointCount; i < this._largeMarkPointList.length; i++) {
                this._disposeSingleSerieMark(this._largeMarkPointList[i]);
            }
            this._largeMarkPointList.length = this._largeMarkPointCount;
            for (var i = this._markLineCount; i < this._markLineList.length; i++) {
                this._disposeSingleSerieMark(this._markLineList[i]);
            }
            this._markLineList.length = this._markLineCount;
            for (var i = this._markBarCount; i < this._markBarList.length; i++) {
                this._disposeSingleSerieMark(this._markBarList[i]);
            }
            this._markBarList.length = this._markBarCount;
        },
        _disposeSingleSerieMark: function (marker) {
            var sceneNode = marker.getSceneNode();
            if (sceneNode.getParent()) {
                sceneNode.getParent().remove(sceneNode);
            }
            marker.dispose();
        },
        _buildSingleTypeMarker: function (markerType, seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];
            var list = this['_' + markerType + 'List'];
            var count = this['_' + markerType + 'Count'];
            var MarkerCtor = MarkerCtorMap[markerType];
            if (!list || !MarkerCtor) {
                return;
            }
            if (!list[count]) {
                list[count] = new MarkerCtor(this);
            }
            var marker = list[count];
            marker.setSeries(serie, seriesIndex);
            var sceneNode = marker.getSceneNode();
            if (sceneNode.getParent() !== parentNode) {
                parentNode.add(sceneNode);
            }
            this['_' + markerType + 'Count']++;
            this._markList.push(marker);
        },
        parseColor: function (colorStr) {
            if (!colorStr) {
                return null;
            }
            if (colorStr instanceof Array) {
                return colorStr;
            }
            if (!this._colorCache) {
                this._colorCache = new LRUCache(10);
            }
            var colorArr = this._colorCache.get(colorStr);
            if (!colorArr) {
                colorArr = colorUtil.parse(colorStr);
                this._colorCache.put(colorStr, colorArr);
                colorArr[0] /= 255;
                colorArr[1] /= 255;
                colorArr[2] /= 255;
            }
            return colorArr;
        },
        getMarkCoord: function (seriesIndex, data, point) {
            point._array[0] = data.x;
            point._array[1] = data.y;
            point._array[2] = data.z;
        },
        getMarkPointTransform: function (seriesIndex, data, matrix) {
            Matrix4.identity(matrix);
            var position = new Vector3();
            this.getMarkCoord(seriesIndex, data, position);
            var arr = matrix._array;
            arr[12] = position.x;
            arr[13] = position.y;
            arr[14] = position.z;
        },
        getMarkBarPoints: function (seriesIndex, data, start, end) {
            var barHeight = data.barHeight != null ? data.barHeight : 1;
            if (typeof barHeight == 'function') {
                barHeight = barHeight(data);
            }
            this.getMarkCoord(seriesIndex, data, start);
            Vector3.scaleAndAdd(end, end, start, 1);
        },
        getMarkLinePoints: function (seriesIndex, data, p0, p1, p2, p3) {
            var isCurve = !!p2;
            if (!isCurve) {
                p3 = p1;
            }
            this.getMarkCoord(seriesIndex, data[0], p0);
            this.getMarkCoord(seriesIndex, data[1], p3);
            if (isCurve) {
                Vector3.copy(p1, p0);
                Vector3.copy(p2, p3);
            }
        },
        getSerieLabelText: function (serie, data, name, status) {
            var formatter = this.deepQuery([
                data,
                serie
            ], 'itemStyle.' + status + '.label.formatter');
            if (!formatter && status === 'emphasis') {
                formatter = this.deepQuery([
                    data,
                    serie
                ], 'itemStyle.normal.label.formatter');
            }
            var value = this.getDataFromOption(data, '-');
            if (formatter) {
                if (typeof formatter === 'function') {
                    return formatter.call(this.myChart, {
                        seriesName: serie.name,
                        series: serie,
                        name: name,
                        value: value,
                        data: data,
                        status: status
                    });
                } else if (typeof formatter === 'string') {
                    formatter = formatter.replace('{a}', '{a0}').replace('{b}', '{b0}').replace('{c}', '{c0}').replace('{a0}', serie.name).replace('{b0}', name).replace('{c0}', this.numAddCommas(value));
                    return formatter;
                }
            } else {
                if (value instanceof Array) {
                    return value[2] != null ? this.numAddCommas(value[2]) : value[0] + ' , ' + value[1];
                } else {
                    return this.numAddCommas(value);
                }
            }
        },
        onlegendSelected: function (param, status) {
            var legendSelected = param.selected;
            for (var itemName in this.selectedMap) {
                if (this.selectedMap[itemName] != legendSelected[itemName]) {
                    status.needRefresh = true;
                }
                this.selectedMap[itemName] = legendSelected[itemName];
            }
            return;
        },
        dispose: function () {
            ComponentBase3D.prototype.dispose.call(this);
            for (var i = 0; i < this._markList.length; i++) {
                this._disposeSingleSerieMark(this._markList[i]);
            }
        },
        onframe: function (deltaTime) {
            for (var i = 0; i < this._markList.length; i++) {
                this._markList[i].onframe(deltaTime);
            }
        }
    };
    zrUtil.inherits(Base3D, ComponentBase3D);
    return Base3D;
});define('echarts-x/util/OrbitControl', [
    'require',
    'zrender/config',
    'qtek/math/Vector2'
], function (require) {
    'use strict';
    var zrConfig = require('zrender/config');
    var Vector2 = require('qtek/math/Vector2');
    var EVENT = zrConfig.EVENT;
    var OrbitControl = function (target, zr, layer) {
        this.zr = zr;
        this.layer = layer;
        this.target = target;
        this.autoRotate = false;
        this.minZoom = 0.5;
        this.maxZoom = 1.5;
        this._zoom = 1;
        this._rotateY = 0;
        this._rotateX = 0;
        this._mouseX = 0;
        this._mouseY = 0;
        this._rotateVelocity = new Vector2();
        this._zoomSpeed = 0;
    };
    OrbitControl.prototype = {
        constructor: OrbitControl,
        init: function () {
            this.layer.bind(EVENT.MOUSEDOWN, this._mouseDownHandler, this);
            this.layer.bind(EVENT.MOUSEWHEEL, this._mouseWheelHandler, this);
        },
        dispose: function () {
            this.layer.unbind(EVENT.MOUSEDOWN, this._mouseDownHandler);
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler);
            this.layer.unbind(EVENT.MOUSEWHEEL, this._mouseWheelHandler);
        },
        update: function (deltaTime) {
            this._rotateY = (this._rotateVelocity.y + this._rotateY) % (Math.PI * 2);
            this._rotateX = (this._rotateVelocity.x + this._rotateX) % (Math.PI * 2);
            this._rotateX = Math.max(Math.min(this._rotateX, Math.PI / 2), -Math.PI / 2);
            this._zoom += this._zoomSpeed;
            this._zoom = Math.max(Math.min(this._zoom, this.maxZoom), this.minZoom);
            this.target.rotation.identity().rotateX(this._rotateX).rotateY(this._rotateY);
            var zoom = this._zoom;
            this.target.scale.set(zoom, zoom, zoom);
            if (this.autoRotate) {
                this._rotateY -= deltaTime * 0.0001;
                this.zr.refreshNextFrame();
            } else if (this._rotateVelocity.len() > 0 || this._zoomSpeed !== 0) {
                this.zr.refreshNextFrame();
            }
            var speed = this._rotateVelocity.len();
            speed = speed * 0.8;
            if (speed < 0.0001) {
                speed = 0;
            }
            this._rotateVelocity.normalize().scale(speed);
            this._zoomSpeed *= 0.8;
            if (Math.abs(this._zoomSpeed) < 0.001) {
                this._zoomSpeed = 0;
            }
        },
        _mouseDownHandler: function (e) {
            this.layer.bind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.bind(EVENT.MOUSEUP, this._mouseUpHandler, this);
            e = e.event;
            this._rotateVelocity.set(0, 0);
            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
            if (this.autoRotate) {
                this.autoRotate = false;
            }
        },
        _mouseMoveHandler: function (e) {
            e = e.event;
            this._rotateVelocity.y = (e.pageX - this._mouseX) / 500;
            this._rotateVelocity.x = (e.pageY - this._mouseY) / 500;
            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
        },
        _mouseWheelHandler: function (e) {
            e = e.event;
            var delta = e.wheelDelta || -e.detail;
            this._zoomSpeed = delta > 0 ? 0.05 : -0.05;
        },
        _mouseUpHandler: function () {
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler, this);
        }
    };
    return OrbitControl;
});define('echarts-x/surface/ZRenderSurface', [
    'require',
    'zrender/Storage',
    'qtek/Texture2D',
    'qtek/math/Vector3',
    'qtek/math/Vector2'
], function (require) {
    var Storage = require('zrender/Storage');
    var Texture = require('qtek/Texture2D');
    var Vector3 = require('qtek/math/Vector3');
    var Vector2 = require('qtek/math/Vector2');
    var ZRenderSurface = function (width, height) {
        this.onrefresh = function () {
        };
        this._storage = new Storage();
        this._canvas = document.createElement('canvas');
        this._width = width || 512;
        this._height = height || 512;
        this._canvas.width = this._width;
        this._canvas.height = this._height;
        this._ctx = this._canvas.getContext('2d');
        this._texture = new Texture({
            image: this._canvas,
            anisotropic: 32,
            flipY: false
        });
        this.refreshNextTick = this.refreshNextTick.bind(this);
    };
    ZRenderSurface.prototype = {
        constructor: ZRenderSurface,
        backgroundColor: '',
        backgroundImage: null,
        addElement: function (el) {
            this._storage.addRoot(el);
        },
        delElement: function (el) {
            this._storage.delRoot(el);
        },
        clearElements: function () {
            this._storage.delRoot();
        },
        getTexture: function () {
            return this._texture;
        },
        resize: function (width, height) {
            if (this._width === width && this._height === height) {
                return;
            }
            this._width = width;
            this._height = height;
            this._canvas.width = width;
            this._canvas.height = height;
            this.refresh();
        },
        getWidth: function () {
            return this._width;
        },
        getHeight: function () {
            return this._height;
        },
        refresh: function () {
            var ctx = this._ctx;
            ctx.clearRect(0, 0, this._width, this._height);
            if (this.backgroundColor) {
                ctx.fillStyle = this.backgroundColor;
                ctx.fillRect(0, 0, this._width, this._height);
            }
            var bg = this.backgroundImage;
            if (bg && bg.width && bg.height) {
                ctx.drawImage(this.backgroundImage, 0, 0, this._width, this._height);
            }
            var list = this._storage.getShapeList(true);
            for (var i = 0; i < list.length; i++) {
                var shape = list[i];
                if (!shape.invisible) {
                    shape.brush(ctx, shape.isHighlight, this.refreshNextTick);
                }
            }
            this._texture.dirty();
            this.onrefresh && this.onrefresh();
        },
        refreshNextTick: function () {
            var timeout;
            return function () {
                var self = this;
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(function () {
                    self.refresh();
                }, 16);
            };
        }(),
        hover: function (e) {
            var list = this._storage.getShapeList();
            var shape = this.pick(e.target, e.face, e.point, list);
            var needsRefresh = false;
            for (var i = 0; i < list.length; i++) {
                list[i].isHighlight = false;
                list[i].zlevel = 0;
                if (list[i] == shape && !list[i].isHighlight || list[i] != shape && list[i].isHighlight) {
                    needsRefresh = true;
                }
            }
            if (shape) {
                shape.isHighlight = true;
                shape.zlevel = 10;
            }
            if (needsRefresh) {
                this.refresh();
            }
            return shape;
        },
        pick: function () {
            var p0 = new Vector3();
            var p1 = new Vector3();
            var p2 = new Vector3();
            var uv0 = new Vector2();
            var uv1 = new Vector2();
            var uv2 = new Vector2();
            var uv = new Vector2();
            var vCross = new Vector3();
            return function (attachedMesh, triangle, points, list) {
                var geo = attachedMesh.geometry;
                var position = geo.attributes.position;
                var texcoord = geo.attributes.texcoord0;
                position.get(triangle[0], p0);
                position.get(triangle[1], p1);
                position.get(triangle[2], p2);
                texcoord.get(triangle[0], uv0);
                texcoord.get(triangle[1], uv1);
                texcoord.get(triangle[2], uv2);
                Vector3.cross(vCross, p1, p2);
                var det = Vector3.dot(p0, vCross);
                var t = Vector3.dot(points, vCross) / det;
                Vector3.cross(vCross, p2, p0);
                var u = Vector3.dot(points, vCross) / det;
                Vector3.cross(vCross, p0, p1);
                var v = Vector3.dot(points, vCross) / det;
                Vector2.scale(uv, uv0, t);
                Vector2.scaleAndAdd(uv, uv, uv1, u);
                Vector2.scaleAndAdd(uv, uv, uv2, v);
                var x = uv.x * this._width;
                var y = uv.y * this._height;
                var list = list || this._storage.getShapeList();
                for (var i = list.length - 1; i >= 0; i--) {
                    var shape = list[i];
                    if (!shape.isSilent() && shape.isCover(x, y)) {
                        return shape;
                    }
                }
            };
        }()
    };
    return ZRenderSurface;
});define('echarts-x/surface/VectorFieldParticleSurface', [
    'require',
    'qtek/compositor/Pass',
    'qtek/StaticGeometry',
    'qtek/Mesh',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Texture2D',
    'qtek/core/glenum',
    'qtek/camera/Orthographic',
    'qtek/Scene',
    'qtek/FrameBuffer',
    '../util/sprite'
], function (require) {
    var Pass = require('qtek/compositor/Pass');
    var StaticGeometry = require('qtek/StaticGeometry');
    var Mesh = require('qtek/Mesh');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Texture2D = require('qtek/Texture2D');
    var glenum = require('qtek/core/glenum');
    var OrthoCamera = require('qtek/camera/Orthographic');
    var Scene = require('qtek/Scene');
    var FrameBuffer = require('qtek/FrameBuffer');
    var spriteUtil = require('../util/sprite');
    var VectorFieldParticleSurface = function (renderer) {
        this.renderer = renderer;
        this.motionBlurFactor = 0.99;
        this.vectorFieldTexture = null;
        this.particleLife = [
            10,
            20
        ];
        this.particleSizeScaling = 1;
        this.particleColor = [
            1,
            1,
            1,
            1
        ];
        this.particleSpeedScaling = 1;
        this.surfaceTexture = null;
        this.surfaceMesh = null;
        this._particlePass = null;
        this._spawnTexture = null;
        this._particleTexture0 = null;
        this._particleTexture1 = null;
        this._particleMesh = null;
        this._frameBuffer = null;
        this._elapsedTime = 0;
        this._scene = null;
        this._camera = null;
        this._motionBlurPass = null;
        this._thisFrameTexture = null;
        this._lastFrameTexture = null;
    };
    VectorFieldParticleSurface.prototype = {
        constructor: VectorFieldParticleSurface,
        init: function (width, height) {
            var geometry = new StaticGeometry({ mainAttribute: 'texcoord0' });
            var nVertex = width * height;
            var attributes = geometry.attributes;
            attributes.texcoord0.init(nVertex);
            var spawnTextureData = new Float32Array(nVertex * 4);
            var off = 0;
            var lifeRange = this.particleLife;
            for (var i = 0; i < width; i++) {
                for (var j = 0; j < height; j++, off++) {
                    attributes.texcoord0.value[off * 2] = i / width;
                    attributes.texcoord0.value[off * 2 + 1] = j / height;
                    spawnTextureData[off * 4] = Math.random();
                    spawnTextureData[off * 4 + 1] = Math.random();
                    spawnTextureData[off * 4 + 2] = Math.random();
                    var life = (lifeRange[1] - lifeRange[0]) * Math.random() + lifeRange[0];
                    spawnTextureData[off * 4 + 3] = life;
                }
            }
            var parameters = {
                width: width,
                height: height,
                type: glenum.FLOAT,
                minFilter: glenum.NEAREST,
                magFilter: glenum.NEAREST,
                wrapS: glenum.REPEAT,
                wrapT: glenum.REPEAT,
                useMipmap: false
            };
            this._spawnTexture = new Texture2D(parameters);
            this._spawnTexture.pixels = spawnTextureData;
            this._particleTexture0 = new Texture2D(parameters);
            this._particleTexture1 = new Texture2D(parameters);
            this._frameBuffer = new FrameBuffer();
            this._particlePass = new Pass({ fragment: Shader.source('ecx.vfParticle.particle.fragment') });
            this._particlePass.setUniform('velocityTexture', this.vectorFieldTexture);
            this._particlePass.setUniform('spawnTexture', this._spawnTexture);
            this._particlePass.setUniform('speedScaling', this.particleSpeedScaling);
            this._motionBlurPass = new Pass({ fragment: Shader.source('ecx.motionBlur.fragment') });
            this._motionBlurPass.setUniform('percent', this.motionBlurFactor);
            var particleMesh = new Mesh({
                material: new Material({
                    shader: new Shader({
                        vertex: Shader.source('ecx.vfParticle.renderPoints.vertex'),
                        fragment: Shader.source('ecx.vfParticle.renderPoints.fragment')
                    })
                }),
                mode: glenum.POINTS,
                geometry: geometry
            });
            particleMesh.material.set('spriteTexture', new Texture2D({ image: spriteUtil.makeSimpleSprite(128) }));
            particleMesh.material.set('sizeScaling', this.particleSizeScaling * this.renderer.getDevicePixelRatio());
            particleMesh.material.set('color', this.particleColor);
            this._particleMesh = particleMesh;
            this._scene = new Scene();
            this._scene.add(this._particleMesh);
            this._camera = new OrthoCamera();
            if (!this.surfaceTexture) {
                this.surfaceTexture = new Texture2D({
                    width: 1024,
                    height: 1024
                });
            }
            var surfaceWidth = this.surfaceTexture.width;
            var surfaceHeight = this.surfaceTexture.height;
            this._lastFrameTexture = new Texture2D({
                width: surfaceWidth,
                height: surfaceHeight
            });
            this._thisFrameTexture = new Texture2D({
                width: surfaceWidth,
                height: surfaceHeight
            });
        },
        update: function (deltaTime) {
            var frameBuffer = this._frameBuffer;
            var particlePass = this._particlePass;
            var motionBlurPass = this._motionBlurPass;
            particlePass.attachOutput(this._particleTexture1);
            particlePass.setUniform('particleTexture', this._particleTexture0);
            particlePass.setUniform('deltaTime', deltaTime);
            particlePass.setUniform('elapsedTime', this._elapsedTime);
            particlePass.render(this.renderer, frameBuffer);
            this._particleMesh.material.set('particleTexture', this._particleTexture1);
            frameBuffer.attach(this.renderer.gl, this._thisFrameTexture);
            frameBuffer.bind(this.renderer);
            this.renderer.render(this._scene, this._camera);
            frameBuffer.unbind(this.renderer);
            motionBlurPass.attachOutput(this.surfaceTexture);
            motionBlurPass.setUniform('lastFrame', this._lastFrameTexture);
            motionBlurPass.setUniform('thisFrame', this._thisFrameTexture);
            motionBlurPass.render(this.renderer, frameBuffer);
            this._swapTexture();
            if (this.surfaceMesh) {
                this.surfaceMesh.material.set('diffuseMap', this.surfaceTexture);
            }
            this._elapsedTime += deltaTime;
        },
        _swapTexture: function () {
            var tmp = this._particleTexture0;
            this._particleTexture0 = this._particleTexture1;
            this._particleTexture1 = tmp;
            var tmp = this.surfaceTexture;
            this.surfaceTexture = this._lastFrameTexture;
            this._lastFrameTexture = tmp;
        },
        dispose: function () {
            var renderer = this.renderer;
            renderer.disposeFrameBuffer(this._frameBuffer);
            renderer.disposeTexture(this.vectorFieldTexture);
            renderer.disposeTexture(this._spawnTexture);
            renderer.disposeTexture(this._particleTexture0);
            renderer.disposeTexture(this._particleTexture1);
            renderer.disposeTexture(this._thisFrameTexture);
            renderer.disposeTexture(this._lastFrameTexture);
            renderer.disposeScene(this._scene);
        }
    };
    return VectorFieldParticleSurface;
});define('qtek/core/LRU', [
    'require',
    './LinkedList'
], function (require) {
    'use strict';
    var LinkedList = require('./LinkedList');
    var LRU = function (maxSize) {
        this._list = new LinkedList();
        this._map = {};
        this._maxSize = maxSize || 10;
    };
    LRU.prototype.setMaxSize = function (size) {
        this._maxSize = size;
    };
    LRU.prototype.put = function (key, value) {
        if (typeof this._map[key] == 'undefined') {
            var len = this._list.length();
            if (len >= this._maxSize && len > 0) {
                var leastUsedEntry = this._list.head;
                this._list.remove(leastUsedEntry);
                delete this._map[leastUsedEntry.key];
            }
            var entry = this._list.insert(value);
            entry.key = key;
            this._map[key] = entry;
        }
    };
    LRU.prototype.get = function (key) {
        var entry = this._map[key];
        if (typeof entry != 'undefined') {
            if (entry !== this._list.tail) {
                this._list.remove(entry);
                this._list.insertEntry(entry);
            }
            return entry.value;
        }
    };
    LRU.prototype.remove = function (key) {
        var entry = this._map[key];
        if (typeof entry != 'undefined') {
            delete this._map[key];
            this._list.remove(entry);
        }
    };
    LRU.prototype.clear = function () {
        this._list.clear();
        this._map = {};
    };
    return LRU;
});define('qtek/math/Quaternion', [
    'require',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var quat = glMatrix.quat;
    var Quaternion = function (x, y, z, w) {
        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = w === undefined ? 1 : w;
        this._array = quat.fromValues(x, y, z, w);
        this._dirty = true;
    };
    Quaternion.prototype = {
        constructor: Quaternion,
        add: function (b) {
            quat.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        calculateW: function () {
            quat.calculateW(this._array, this._array);
            this._dirty = true;
            return this;
        },
        set: function (x, y, z, w) {
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },
        setArray: function (arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._array[2] = arr[2];
            this._array[3] = arr[3];
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Quaternion(this.x, this.y, this.z, this.w);
        },
        conjugate: function () {
            quat.conjugate(this._array, this._array);
            this._dirty = true;
            return this;
        },
        copy: function (b) {
            quat.copy(this._array, b._array);
            this._dirty = true;
            return this;
        },
        dot: function (b) {
            return quat.dot(this._array, b._array);
        },
        fromMat3: function (m) {
            quat.fromMat3(this._array, m._array);
            this._dirty = true;
            return this;
        },
        fromMat4: function () {
            var mat3 = glMatrix.mat3;
            var m3 = mat3.create();
            return function (m) {
                mat3.fromMat4(m3, m._array);
                mat3.transpose(m3, m3);
                quat.fromMat3(this._array, m3);
                this._dirty = true;
                return this;
            };
        }(),
        identity: function () {
            quat.identity(this._array);
            this._dirty = true;
            return this;
        },
        invert: function () {
            quat.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },
        len: function () {
            return quat.len(this._array);
        },
        length: function () {
            return quat.length(this._array);
        },
        lerp: function (a, b, t) {
            quat.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            quat.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mulLeft: function (a) {
            quat.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            quat.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiplyLeft: function (a) {
            quat.multiply(this._array, a._array, this._array);
            this._dirty = true;
            return this;
        },
        normalize: function () {
            quat.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },
        rotateX: function (rad) {
            quat.rotateX(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateY: function (rad) {
            quat.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotateZ: function (rad) {
            quat.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },
        rotationTo: function (a, b) {
            quat.rotationTo(this._array, a._array, b._array);
            this._dirty = true;
            return this;
        },
        setAxes: function (view, right, up) {
            quat.setAxes(this._array, view._array, right._array, up._array);
            this._dirty = true;
            return this;
        },
        setAxisAngle: function (axis, rad) {
            quat.setAxisAngle(this._array, axis._array, rad);
            this._dirty = true;
            return this;
        },
        slerp: function (a, b, t) {
            quat.slerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        sqrLen: function () {
            return quat.sqrLen(this._array);
        },
        squaredLength: function () {
            return quat.squaredLength(this._array);
        },
        setFromEuler: function (v) {
        },
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Quaternion.prototype;
        Object.defineProperty(proto, 'x', {
            get: function () {
                return this._array[0];
            },
            set: function (value) {
                this._array[0] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                return this._array[1];
            },
            set: function (value) {
                this._array[1] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'z', {
            get: function () {
                return this._array[2];
            },
            set: function (value) {
                this._array[2] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'w', {
            get: function () {
                return this._array[3];
            },
            set: function (value) {
                this._array[3] = value;
                this._dirty = true;
            }
        });
    }
    Quaternion.add = function (out, a, b) {
        quat.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Quaternion.set = function (out, x, y, z, w) {
        quat.set(out._array, x, y, z, w);
        out._dirty = true;
    };
    Quaternion.copy = function (out, b) {
        quat.copy(out._array, b._array);
        out._dirty = true;
        return out;
    };
    Quaternion.calculateW = function (out, a) {
        quat.calculateW(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.conjugate = function (out, a) {
        quat.conjugate(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.identity = function (out) {
        quat.identity(out._array);
        out._dirty = true;
        return out;
    };
    Quaternion.invert = function (out, a) {
        quat.invert(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.dot = function (a, b) {
        return quat.dot(a._array, b._array);
    };
    Quaternion.len = function (a) {
        return quat.length(a._array);
    };
    Quaternion.lerp = function (out, a, b, t) {
        quat.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Quaternion.slerp = function (out, a, b, t) {
        quat.slerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Quaternion.mul = function (out, a, b) {
        quat.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Quaternion.multiply = Quaternion.mul;
    Quaternion.rotateX = function (out, a, rad) {
        quat.rotateX(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.rotateY = function (out, a, rad) {
        quat.rotateY(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.rotateZ = function (out, a, rad) {
        quat.rotateZ(out._array, a._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.setAxisAngle = function (out, axis, rad) {
        quat.setAxisAngle(out._array, axis._array, rad);
        out._dirty = true;
        return out;
    };
    Quaternion.normalize = function (out, a) {
        quat.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Quaternion.sqrLen = function (a) {
        return quat.sqrLen(a._array);
    };
    Quaternion.squaredLength = Quaternion.sqrLen;
    Quaternion.fromMat3 = function (out, m) {
        quat.fromMat3(out._array, m._array);
        out._dirty = true;
        return out;
    };
    Quaternion.setAxes = function (out, view, right, up) {
        quat.setAxes(out._array, view._array, right._array, up._array);
        out._dirty = true;
        return out;
    };
    Quaternion.rotationTo = function (out, a, b) {
        quat.rotationTo(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    return Quaternion;
});define('qtek/Renderable', [
    'require',
    './Node',
    './core/glenum',
    './core/glinfo',
    './DynamicGeometry'
], function (require) {
    'use strict';
    var Node = require('./Node');
    var glenum = require('./core/glenum');
    var glinfo = require('./core/glinfo');
    var DynamicGeometry = require('./DynamicGeometry');
    var prevDrawID = 0;
    var prevDrawIndicesBuffer = null;
    var prevDrawIsUseFace = true;
    var currentDrawID;
    var RenderInfo = function () {
        this.faceNumber = 0;
        this.vertexNumber = 0;
        this.drawCallNumber = 0;
    };
    function VertexArrayObject(availableAttributes, availableAttributeSymbols, indicesBuffer) {
        this.availableAttributes = availableAttributes;
        this.availableAttributeSymbols = availableAttributeSymbols;
        this.indicesBuffer = indicesBuffer;
        this.vao = null;
    }
    var Renderable = Node.derive({
        material: null,
        geometry: null,
        mode: glenum.TRIANGLES,
        _drawCache: null,
        _renderInfo: null
    }, function () {
        this._drawCache = {};
        this._renderInfo = new RenderInfo();
    }, {
        lineWidth: 1,
        culling: true,
        cullFace: glenum.BACK,
        frontFace: glenum.CCW,
        frustumCulling: true,
        receiveShadow: true,
        castShadow: true,
        ignorePicking: false,
        isRenderable: function () {
            return this.geometry && this.material && this.material.shader && this.visible;
        },
        render: function (_gl, globalMaterial) {
            var material = globalMaterial || this.material;
            var shader = material.shader;
            var geometry = this.geometry;
            var glDrawMode = this.mode;
            var nVertex = geometry.getVertexNumber();
            var isUseFace = geometry.isUseFace();
            var uintExt = glinfo.getExtension(_gl, 'OES_element_index_uint');
            var useUintExt = uintExt && nVertex > 65535;
            var indicesType = useUintExt ? _gl.UNSIGNED_INT : _gl.UNSIGNED_SHORT;
            var vaoExt = glinfo.getExtension(_gl, 'OES_vertex_array_object');
            var isStatic = !geometry.dynamic;
            var renderInfo = this._renderInfo;
            renderInfo.vertexNumber = nVertex;
            renderInfo.faceNumber = 0;
            renderInfo.drawCallNumber = 0;
            var drawHashChanged = false;
            currentDrawID = _gl.__GLID__ + '-' + geometry.__GUID__ + '-' + shader.__GUID__;
            if (currentDrawID !== prevDrawID) {
                drawHashChanged = true;
            } else {
                if (geometry instanceof DynamicGeometry && (nVertex > 65535 && !uintExt) && isUseFace || vaoExt && isStatic || geometry._cache.isDirty()) {
                    drawHashChanged = true;
                }
            }
            prevDrawID = currentDrawID;
            if (!drawHashChanged) {
                if (prevDrawIsUseFace) {
                    _gl.drawElements(glDrawMode, prevDrawIndicesBuffer.count, indicesType, 0);
                    renderInfo.faceNumber = prevDrawIndicesBuffer.count / 3;
                } else {
                    _gl.drawArrays(glDrawMode, 0, nVertex);
                }
                renderInfo.drawCallNumber = 1;
            } else {
                var vaoList = this._drawCache[currentDrawID];
                if (!vaoList) {
                    var chunks = geometry.getBufferChunks(_gl);
                    if (!chunks) {
                        return;
                    }
                    vaoList = [];
                    for (var c = 0; c < chunks.length; c++) {
                        var chunk = chunks[c];
                        var attributeBuffers = chunk.attributeBuffers;
                        var indicesBuffer = chunk.indicesBuffer;
                        var availableAttributes = [];
                        var availableAttributeSymbols = [];
                        for (var a = 0; a < attributeBuffers.length; a++) {
                            var attributeBufferInfo = attributeBuffers[a];
                            var name = attributeBufferInfo.name;
                            var semantic = attributeBufferInfo.semantic;
                            var symbol;
                            if (semantic) {
                                var semanticInfo = shader.attribSemantics[semantic];
                                symbol = semanticInfo && semanticInfo.symbol;
                            } else {
                                symbol = name;
                            }
                            if (symbol && shader.attributeTemplates[symbol]) {
                                availableAttributes.push(attributeBufferInfo);
                                availableAttributeSymbols.push(symbol);
                            }
                        }
                        var vao = new VertexArrayObject(availableAttributes, availableAttributeSymbols, indicesBuffer);
                        vaoList.push(vao);
                    }
                    if (isStatic) {
                        this._drawCache[currentDrawID] = vaoList;
                    }
                }
                for (var i = 0; i < vaoList.length; i++) {
                    var vao = vaoList[i];
                    var needsBindAttributes = true;
                    if (vaoExt && isStatic) {
                        if (vao.vao == null) {
                            vao.vao = vaoExt.createVertexArrayOES();
                        } else {
                            needsBindAttributes = false;
                        }
                        vaoExt.bindVertexArrayOES(vao.vao);
                    }
                    var availableAttributes = vao.availableAttributes;
                    var indicesBuffer = vao.indicesBuffer;
                    if (needsBindAttributes) {
                        var locationList = shader.enableAttributes(_gl, vao.availableAttributeSymbols, vaoExt && isStatic && vao.vao);
                        for (var a = 0; a < availableAttributes.length; a++) {
                            var location = locationList[a];
                            if (location === -1) {
                                continue;
                            }
                            var attributeBufferInfo = availableAttributes[a];
                            var buffer = attributeBufferInfo.buffer;
                            var size = attributeBufferInfo.size;
                            var glType;
                            switch (attributeBufferInfo.type) {
                            case 'float':
                                glType = _gl.FLOAT;
                                break;
                            case 'byte':
                                glType = _gl.BYTE;
                                break;
                            case 'ubyte':
                                glType = _gl.UNSIGNED_BYTE;
                                break;
                            case 'short':
                                glType = _gl.SHORT;
                                break;
                            case 'ushort':
                                glType = _gl.UNSIGNED_SHORT;
                                break;
                            default:
                                glType = _gl.FLOAT;
                                break;
                            }
                            _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                            _gl.vertexAttribPointer(location, size, glType, false, 0, 0);
                        }
                    }
                    if (glDrawMode == glenum.LINES || glDrawMode == glenum.LINE_STRIP || glDrawMode == glenum.LINE_LOOP) {
                        _gl.lineWidth(this.lineWidth);
                    }
                    prevDrawIndicesBuffer = indicesBuffer;
                    prevDrawIsUseFace = geometry.isUseFace();
                    if (prevDrawIsUseFace) {
                        if (needsBindAttributes) {
                            _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                        }
                        _gl.drawElements(glDrawMode, indicesBuffer.count, indicesType, 0);
                        renderInfo.faceNumber += indicesBuffer.count / 3;
                    } else {
                        _gl.drawArrays(glDrawMode, 0, nVertex);
                    }
                    if (vaoExt && isStatic) {
                        vaoExt.bindVertexArrayOES(null);
                    }
                    renderInfo.drawCallNumber++;
                }
            }
            return renderInfo;
        },
        clone: function () {
            var properties = [
                'castShadow',
                'receiveShadow',
                'mode',
                'culling',
                'cullFace',
                'frontFace',
                'frustumCulling'
            ];
            return function () {
                var renderable = Node.prototype.clone.call(this);
                renderable.geometry = this.geometry;
                renderable.material = this.material;
                for (var i = 0; i < properties.length; i++) {
                    var name = properties[i];
                    if (renderable[name] !== this[name]) {
                        renderable[name] = this[name];
                    }
                }
                return renderable;
            };
        }()
    });
    Renderable.beforeFrame = function () {
        prevDrawID = 0;
    };
    Renderable.POINTS = glenum.POINTS;
    Renderable.LINES = glenum.LINES;
    Renderable.LINE_LOOP = glenum.LINE_LOOP;
    Renderable.LINE_STRIP = glenum.LINE_STRIP;
    Renderable.TRIANGLES = glenum.TRIANGLES;
    Renderable.TRIANGLE_STRIP = glenum.TRIANGLE_STRIP;
    Renderable.TRIANGLE_FAN = glenum.TRIANGLE_FAN;
    Renderable.BACK = glenum.BACK;
    Renderable.FRONT = glenum.FRONT;
    Renderable.FRONT_AND_BACK = glenum.FRONT_AND_BACK;
    Renderable.CW = glenum.CW;
    Renderable.CCW = glenum.CCW;
    Renderable.RenderInfo = RenderInfo;
    return Renderable;
});define('qtek/core/glinfo', [], function () {
    'use strict';
    var EXTENSION_LIST = [
        'OES_texture_float',
        'OES_texture_half_float',
        'OES_texture_float_linear',
        'OES_texture_half_float_linear',
        'OES_standard_derivatives',
        'OES_vertex_array_object',
        'OES_element_index_uint',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_depth_texture',
        'EXT_texture_filter_anisotropic',
        'WEBGL_draw_buffers'
    ];
    var extensions = {};
    var glinfo = {
        initialize: function (_gl) {
            if (extensions[_gl.__GLID__]) {
                return;
            }
            extensions[_gl.__GLID__] = {};
            for (var i = 0; i < EXTENSION_LIST.length; i++) {
                var extName = EXTENSION_LIST[i];
                this._createExtension(_gl, extName);
            }
        },
        getExtension: function (_gl, name) {
            var glid = _gl.__GLID__;
            if (extensions[glid]) {
                if (typeof extensions[glid][name] == 'undefined') {
                    this._createExtension(_gl, name);
                }
                return extensions[glid][name];
            }
        },
        dispose: function (_gl) {
            delete extensions[_gl.__GLID__];
        },
        _createExtension: function (_gl, name) {
            var ext = _gl.getExtension(name);
            if (!ext) {
                ext = _gl.getExtension('MOZ_' + name);
            }
            if (!ext) {
                ext = _gl.getExtension('WEBKIT_' + name);
            }
            extensions[_gl.__GLID__][name] = ext;
        }
    };
    return glinfo;
});define('qtek/DynamicGeometry', [
    'require',
    './Geometry',
    './math/BoundingBox',
    './core/glenum',
    './core/glinfo',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Geometry = require('./Geometry');
    var BoundingBox = require('./math/BoundingBox');
    var glenum = require('./core/glenum');
    var glinfo = require('./core/glinfo');
    var glMatrix = require('./dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var mat4 = glMatrix.mat4;
    var arrSlice = Array.prototype.slice;
    var DynamicGeometry = Geometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                texcoord0: new Geometry.Attribute('texcoord0', 'float', 2, 'TEXCOORD_0', true),
                texcoord1: new Geometry.Attribute('texcoord1', 'float', 2, 'TEXCOORD_1', true),
                normal: new Geometry.Attribute('normal', 'float', 3, 'NORMAL', true),
                tangent: new Geometry.Attribute('tangent', 'float', 4, 'TANGENT', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true),
                weight: new Geometry.Attribute('weight', 'float', 3, 'WEIGHT', true),
                joint: new Geometry.Attribute('joint', 'float', 4, 'JOINT', true),
                barycentric: new Geometry.Attribute('barycentric', 'float', 3, null, true)
            },
            dynamic: true,
            hint: glenum.DYNAMIC_DRAW,
            faces: [],
            _enabledAttributes: null,
            _arrayChunks: []
        };
    }, {
        updateBoundingBox: function () {
            if (!this.boundingBox) {
                this.boundingBox = new BoundingBox();
            }
            this.boundingBox.updateFromVertices(this.attributes.position.value);
        },
        dirty: function (field) {
            if (!field) {
                this.dirty('indices');
                for (var name in this.attributes) {
                    this.dirty(name);
                }
                return;
            }
            this._cache.dirtyAll(field);
            this._cache.dirtyAll();
            this._enabledAttributes = null;
        },
        getVertexNumber: function () {
            var mainAttribute = this.attributes[this.mainAttribute];
            if (!mainAttribute || !mainAttribute.value) {
                return 0;
            }
            return mainAttribute.value.length;
        },
        getFaceNumber: function () {
            return this.faces.length;
        },
        getFace: function (idx, out) {
            if (idx < this.getFaceNumber() && idx >= 0) {
                if (!out) {
                    out = vec3.create();
                }
                vec3.copy(out, this.faces[idx]);
                return out;
            }
        },
        isUseFace: function () {
            return this.useFace && this.faces.length > 0;
        },
        isSplitted: function () {
            return this.getVertexNumber() > 65535;
        },
        createAttribute: function (name, type, size, semantic) {
            var attrib = new Geometry.Attribute(name, type, size, semantic, true);
            this.attributes[name] = attrib;
            this._attributeList.push(name);
            return attrib;
        },
        removeAttribute: function (name) {
            var idx = this._attributeList.indexOf(name);
            if (idx >= 0) {
                this._attributeList.splice(idx, 1);
                delete this.attributes[name];
                return true;
            }
            return false;
        },
        getEnabledAttributes: function () {
            if (this._enabledAttributes) {
                return this._enabledAttributes;
            }
            var result = {};
            var nVertex = this.getVertexNumber();
            for (var i = 0; i < this._attributeList.length; i++) {
                var name = this._attributeList[i];
                var attrib = this.attributes[name];
                if (attrib.value.length) {
                    if (attrib.value.length === nVertex) {
                        result[name] = attrib;
                    }
                }
            }
            this._enabledAttributes = result;
            return result;
        },
        _getDirtyAttributes: function () {
            var attributes = this.getEnabledAttributes();
            if (this._cache.miss('chunks')) {
                return attributes;
            } else {
                var result = {};
                var noDirtyAttributes = true;
                for (var name in attributes) {
                    if (this._cache.isDirty(name)) {
                        result[name] = attributes[name];
                        noDirtyAttributes = false;
                    }
                }
                if (!noDirtyAttributes) {
                    return result;
                }
            }
        },
        getChunkNumber: function () {
            return this._arrayChunks.length;
        },
        getBufferChunks: function (_gl) {
            this._cache.use(_gl.__GLID__);
            if (this._cache.isDirty()) {
                var dirtyAttributes = this._getDirtyAttributes();
                var isFacesDirty = this._cache.isDirty('indices');
                isFacesDirty = isFacesDirty && this.isUseFace();
                if (dirtyAttributes) {
                    this._updateAttributesAndIndicesArrays(dirtyAttributes, isFacesDirty, glinfo.getExtension(_gl, 'OES_element_index_uint') != null);
                    this._updateBuffer(_gl, dirtyAttributes, isFacesDirty);
                    for (var name in dirtyAttributes) {
                        this._cache.fresh(name);
                    }
                    this._cache.fresh('indices');
                    this._cache.fresh();
                }
            }
            return this._cache.get('chunks');
        },
        _updateAttributesAndIndicesArrays: function (attributes, isFacesDirty, useUintExtension) {
            var self = this;
            var nVertex = this.getVertexNumber();
            var verticesReorganizedMap = [];
            var reorganizedFaces = [];
            var ArrayConstructors = {};
            for (var name in attributes) {
                switch (type) {
                case 'byte':
                    ArrayConstructors[name] = Int8Array;
                    break;
                case 'ubyte':
                    ArrayConstructors[name] = Uint8Array;
                    break;
                case 'short':
                    ArrayConstructors[name] = Int16Array;
                    break;
                case 'ushort':
                    ArrayConstructors[name] = Uint16Array;
                    break;
                default:
                    ArrayConstructors[name] = Float32Array;
                    break;
                }
            }
            var newChunk = function (chunkIdx) {
                if (self._arrayChunks[chunkIdx]) {
                    return self._arrayChunks[chunkIdx];
                }
                var chunk = {
                    attributeArrays: {},
                    indicesArray: null
                };
                for (var name in attributes) {
                    chunk.attributeArrays[name] = null;
                }
                for (var i = 0; i < nVertex; i++) {
                    verticesReorganizedMap[i] = -1;
                }
                self._arrayChunks.push(chunk);
                return chunk;
            };
            var attribNameList = Object.keys(attributes);
            if (nVertex > 65535 && this.isUseFace() && !useUintExtension) {
                var chunkIdx = 0;
                var currentChunk;
                var chunkFaceStart = [0];
                var vertexUseCount = [];
                for (i = 0; i < nVertex; i++) {
                    vertexUseCount[i] = -1;
                    verticesReorganizedMap[i] = -1;
                }
                if (isFacesDirty) {
                    for (i = 0; i < this.faces.length; i++) {
                        reorganizedFaces[i] = [
                            0,
                            0,
                            0
                        ];
                    }
                }
                currentChunk = newChunk(chunkIdx);
                var vertexCount = 0;
                for (var i = 0; i < this.faces.length; i++) {
                    var face = this.faces[i];
                    var reorganizedFace = reorganizedFaces[i];
                    if (vertexCount + 3 > 65535) {
                        chunkIdx++;
                        chunkFaceStart[chunkIdx] = i;
                        vertexCount = 0;
                        currentChunk = newChunk(chunkIdx);
                    }
                    for (var f = 0; f < 3; f++) {
                        var ii = face[f];
                        var isNew = verticesReorganizedMap[ii] === -1;
                        for (var k = 0; k < attribNameList.length; k++) {
                            var name = attribNameList[k];
                            var attribArray = currentChunk.attributeArrays[name];
                            var values = attributes[name].value;
                            var size = attributes[name].size;
                            if (!attribArray) {
                                attribArray = currentChunk.attributeArrays[name] = [];
                            }
                            if (isNew) {
                                if (size === 1) {
                                    attribArray[vertexCount] = values[ii];
                                }
                                for (var j = 0; j < size; j++) {
                                    attribArray[vertexCount * size + j] = values[ii][j];
                                }
                            }
                        }
                        if (isNew) {
                            verticesReorganizedMap[ii] = vertexCount;
                            reorganizedFace[f] = vertexCount;
                            vertexCount++;
                        } else {
                            reorganizedFace[f] = verticesReorganizedMap[ii];
                        }
                    }
                }
                for (var c = 0; c < this._arrayChunks.length; c++) {
                    var chunk = this._arrayChunks[c];
                    for (var name in chunk.attributeArrays) {
                        var array = chunk.attributeArrays[name];
                        if (array instanceof Array) {
                            chunk.attributeArrays[name] = new ArrayConstructors[name](array);
                        }
                    }
                }
                if (isFacesDirty) {
                    var chunkStart, chunkEnd, cursor, chunk;
                    for (var c = 0; c < this._arrayChunks.length; c++) {
                        chunkStart = chunkFaceStart[c];
                        chunkEnd = chunkFaceStart[c + 1] || this.faces.length;
                        cursor = 0;
                        chunk = this._arrayChunks[c];
                        var indicesArray = chunk.indicesArray;
                        if (!indicesArray) {
                            indicesArray = chunk.indicesArray = new Uint16Array((chunkEnd - chunkStart) * 3);
                        }
                        for (var i = chunkStart; i < chunkEnd; i++) {
                            indicesArray[cursor++] = reorganizedFaces[i][0];
                            indicesArray[cursor++] = reorganizedFaces[i][1];
                            indicesArray[cursor++] = reorganizedFaces[i][2];
                        }
                    }
                }
            } else {
                var chunk = newChunk(0);
                if (isFacesDirty) {
                    var indicesArray = chunk.indicesArray;
                    var nFace = this.faces.length;
                    if (!indicesArray || nFace * 3 !== indicesArray.length) {
                        var ArrayCtor = nVertex > 65535 ? Uint32Array : Uint16Array;
                        indicesArray = chunk.indicesArray = new ArrayCtor(this.faces.length * 3);
                    }
                    var cursor = 0;
                    for (var i = 0; i < nFace; i++) {
                        indicesArray[cursor++] = this.faces[i][0];
                        indicesArray[cursor++] = this.faces[i][1];
                        indicesArray[cursor++] = this.faces[i][2];
                    }
                }
                for (var name in attributes) {
                    var values = attributes[name].value;
                    var type = attributes[name].type;
                    var size = attributes[name].size;
                    var attribArray = chunk.attributeArrays[name];
                    var arrSize = nVertex * size;
                    if (!attribArray || attribArray.length !== arrSize) {
                        attribArray = new ArrayConstructors[name](arrSize);
                        chunk.attributeArrays[name] = attribArray;
                    }
                    if (size === 1) {
                        for (var i = 0; i < values.length; i++) {
                            attribArray[i] = values[i];
                        }
                    } else {
                        var cursor = 0;
                        for (var i = 0; i < values.length; i++) {
                            for (var j = 0; j < size; j++) {
                                attribArray[cursor++] = values[i][j];
                            }
                        }
                    }
                }
            }
        },
        _updateBuffer: function (_gl, dirtyAttributes, isFacesDirty) {
            var chunks = this._cache.get('chunks');
            var firstUpdate = false;
            if (!chunks) {
                chunks = [];
                for (var i = 0; i < this._arrayChunks.length; i++) {
                    chunks[i] = {
                        attributeBuffers: [],
                        indicesBuffer: null
                    };
                }
                this._cache.put('chunks', chunks);
                firstUpdate = true;
            }
            for (var cc = 0; cc < this._arrayChunks.length; cc++) {
                var chunk = chunks[cc];
                if (!chunk) {
                    chunk = chunks[cc] = {
                        attributeBuffers: [],
                        indicesBuffer: null
                    };
                }
                var attributeBuffers = chunk.attributeBuffers;
                var indicesBuffer = chunk.indicesBuffer;
                var arrayChunk = this._arrayChunks[cc];
                var attributeArrays = arrayChunk.attributeArrays;
                var indicesArray = arrayChunk.indicesArray;
                var count = 0;
                var prevSearchIdx = 0;
                for (var name in dirtyAttributes) {
                    var attribute = dirtyAttributes[name];
                    var type = attribute.type;
                    var semantic = attribute.semantic;
                    var size = attribute.size;
                    var bufferInfo;
                    if (!firstUpdate) {
                        for (var i = prevSearchIdx; i < attributeBuffers.length; i++) {
                            if (attributeBuffers[i].name === name) {
                                bufferInfo = attributeBuffers[i];
                                prevSearchIdx = i + 1;
                                break;
                            }
                        }
                        if (!bufferInfo) {
                            for (var i = prevSearchIdx - 1; i >= 0; i--) {
                                if (attributeBuffers[i].name === name) {
                                    bufferInfo = attributeBuffers[i];
                                    prevSearchIdx = i;
                                    break;
                                }
                            }
                        }
                    }
                    var buffer;
                    if (bufferInfo) {
                        buffer = bufferInfo.buffer;
                    } else {
                        buffer = _gl.createBuffer();
                    }
                    _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                    _gl.bufferData(_gl.ARRAY_BUFFER, attributeArrays[name], this.hint);
                    attributeBuffers[count++] = new Geometry.AttributeBuffer(name, type, buffer, size, semantic);
                }
                attributeBuffers.length = count;
                if (isFacesDirty) {
                    if (!indicesBuffer) {
                        indicesBuffer = new Geometry.IndicesBuffer(_gl.createBuffer());
                        chunk.indicesBuffer = indicesBuffer;
                    }
                    indicesBuffer.count = indicesArray.length;
                    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, indicesArray, this.hint);
                }
            }
        },
        generateVertexNormals: function () {
            var faces = this.faces;
            var len = faces.length;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var normal = vec3.create();
            var v21 = vec3.create(), v32 = vec3.create();
            for (var i = 0; i < normals.length; i++) {
                vec3.set(normals[i], 0, 0, 0);
            }
            for (var i = normals.length; i < positions.length; i++) {
                normals[i] = [
                    0,
                    0,
                    0
                ];
            }
            for (var f = 0; f < len; f++) {
                var face = faces[f];
                var i1 = face[0];
                var i2 = face[1];
                var i3 = face[2];
                var p1 = positions[i1];
                var p2 = positions[i2];
                var p3 = positions[i3];
                vec3.sub(v21, p1, p2);
                vec3.sub(v32, p2, p3);
                vec3.cross(normal, v21, v32);
                vec3.add(normals[i1], normals[i1], normal);
                vec3.add(normals[i2], normals[i2], normal);
                vec3.add(normals[i3], normals[i3], normal);
            }
            for (var i = 0; i < normals.length; i++) {
                vec3.normalize(normals[i], normals[i]);
            }
        },
        generateFaceNormals: function () {
            if (!this.isUniqueVertex()) {
                this.generateUniqueVertex();
            }
            var faces = this.faces;
            var len = faces.length;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var normal = vec3.create();
            var v21 = vec3.create(), v32 = vec3.create();
            var isCopy = normals.length === positions.length;
            for (var i = 0; i < len; i++) {
                var face = faces[i];
                var i1 = face[0];
                var i2 = face[1];
                var i3 = face[2];
                var p1 = positions[i1];
                var p2 = positions[i2];
                var p3 = positions[i3];
                vec3.sub(v21, p1, p2);
                vec3.sub(v32, p2, p3);
                vec3.cross(normal, v21, v32);
                if (isCopy) {
                    vec3.copy(normals[i1], normal);
                    vec3.copy(normals[i2], normal);
                    vec3.copy(normals[i3], normal);
                } else {
                    normals[i1] = normals[i2] = normals[i3] = arrSlice.call(normal);
                }
            }
        },
        generateTangents: function () {
            var texcoords = this.attributes.texcoord0.value;
            var positions = this.attributes.position.value;
            var tangents = this.attributes.tangent.value;
            var normals = this.attributes.normal.value;
            var tan1 = [];
            var tan2 = [];
            var nVertex = this.getVertexNumber();
            for (var i = 0; i < nVertex; i++) {
                tan1[i] = [
                    0,
                    0,
                    0
                ];
                tan2[i] = [
                    0,
                    0,
                    0
                ];
            }
            var sdir = [
                0,
                0,
                0
            ];
            var tdir = [
                0,
                0,
                0
            ];
            for (var i = 0; i < this.faces.length; i++) {
                var face = this.faces[i], i1 = face[0], i2 = face[1], i3 = face[2], st1 = texcoords[i1], st2 = texcoords[i2], st3 = texcoords[i3], p1 = positions[i1], p2 = positions[i2], p3 = positions[i3];
                var x1 = p2[0] - p1[0], x2 = p3[0] - p1[0], y1 = p2[1] - p1[1], y2 = p3[1] - p1[1], z1 = p2[2] - p1[2], z2 = p3[2] - p1[2];
                var s1 = st2[0] - st1[0], s2 = st3[0] - st1[0], t1 = st2[1] - st1[1], t2 = st3[1] - st1[1];
                var r = 1 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r;
                sdir[2] = (t2 * z1 - t1 * z2) * r;
                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;
                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = [
                0,
                0,
                0,
                0
            ];
            var nCrossT = [
                0,
                0,
                0
            ];
            for (var i = 0; i < nVertex; i++) {
                var n = normals[i];
                var t = tan1[i];
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                vec3.cross(nCrossT, n, t);
                tmp[3] = vec3.dot(nCrossT, tan2[i]) < 0 ? -1 : 1;
                tangents[i] = tmp.slice();
            }
        },
        isUniqueVertex: function () {
            if (this.isUseFace()) {
                return this.getVertexNumber() === this.faces.length * 3;
            } else {
                return true;
            }
        },
        generateUniqueVertex: function () {
            var vertexUseCount = [];
            for (var i = 0; i < this.getVertexNumber(); i++) {
                vertexUseCount[i] = 0;
            }
            var cursor = this.getVertexNumber();
            var attributes = this.getEnabledAttributes();
            var faces = this.faces;
            var attributeNameList = Object.keys(attributes);
            for (var i = 0; i < faces.length; i++) {
                var face = faces[i];
                for (var j = 0; j < 3; j++) {
                    var ii = face[j];
                    if (vertexUseCount[ii] > 0) {
                        for (var a = 0; a < attributeNameList.length; a++) {
                            var name = attributeNameList[a];
                            var array = attributes[name].value;
                            var size = attributes[name].size;
                            if (size === 1) {
                                array.push(array[ii]);
                            } else {
                                array.push(arrSlice.call(array[ii]));
                            }
                        }
                        face[j] = cursor;
                        cursor++;
                    }
                    vertexUseCount[ii]++;
                }
            }
            this.dirty();
        },
        generateBarycentric: function () {
            var a = [
                1,
                0,
                0
            ];
            var b = [
                0,
                0,
                1
            ];
            var c = [
                0,
                1,
                0
            ];
            return function () {
                if (!this.isUniqueVertex()) {
                    this.generateUniqueVertex();
                }
                var array = this.attributes.barycentric.value;
                if (array.length == this.faces.length * 3) {
                    return;
                }
                var i1, i2, i3, face;
                for (var i = 0; i < this.faces.length; i++) {
                    face = this.faces[i];
                    i1 = face[0];
                    i2 = face[1];
                    i3 = face[2];
                    array[i1] = a;
                    array[i2] = b;
                    array[i3] = c;
                }
            };
        }(),
        convertToStatic: function (geometry, useUintExtension) {
            this._updateAttributesAndIndicesArrays(this.getEnabledAttributes(), true, useUintExtension);
            if (this._arrayChunks.length > 1) {
                console.warn('Large geometry will discard chunks when convert to StaticGeometry');
            } else if (this._arrayChunks.length === 0) {
                return geometry;
            }
            var chunk = this._arrayChunks[0];
            var attributes = this.getEnabledAttributes();
            for (var name in attributes) {
                var attrib = attributes[name];
                var geoAttrib = geometry.attributes[name];
                if (!geoAttrib) {
                    geoAttrib = geometry.attributes[name] = {
                        type: attrib.type,
                        size: attrib.size,
                        value: null
                    };
                    if (attrib.semantic) {
                        geoAttrib.semantic = attrib.semantic;
                    }
                }
                geoAttrib.value = chunk.attributeArrays[name];
            }
            geometry.faces = chunk.indicesArray;
            if (this.boundingBox) {
                geometry.boundingBox = new BoundingBox();
                geometry.boundingBox.min.copy(this.boundingBox.min);
                geometry.boundingBox.max.copy(this.boundingBox.max);
            }
            return geometry;
        },
        applyTransform: function (matrix) {
            if (this.boundingBox) {
                this.boundingBox.applyTransform(matrix);
            }
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var tangents = this.attributes.tangent.value;
            matrix = matrix._array;
            for (var i = 0; i < positions.length; i++) {
                vec3.transformMat4(positions[i], positions[i], matrix);
            }
            var inverseTransposeMatrix = mat4.create();
            mat4.invert(inverseTransposeMatrix, matrix);
            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);
            for (var i = 0; i < normals.length; i++) {
                vec3.transformMat4(normals[i], normals[i], inverseTransposeMatrix);
            }
            for (var i = 0; i < tangents.length; i++) {
                vec3.transformMat4(tangents[i], tangents[i], inverseTransposeMatrix);
            }
        },
        dispose: function (_gl) {
            this._cache.use(_gl.__GLID__);
            var chunks = this._cache.get('chunks');
            if (chunks) {
                for (var c = 0; c < chunks.length; c++) {
                    var chunk = chunks[c];
                    for (var k = 0; k < chunk.attributeBuffers.length; k++) {
                        var attribs = chunk.attributeBuffers[k];
                        _gl.deleteBuffer(attribs.buffer);
                    }
                }
            }
            this._cache.deleteContext(_gl.__GLID__);
        }
    });
    return DynamicGeometry;
});define('qtek/Geometry', [
    'require',
    './core/Base',
    './core/glenum',
    './core/Cache',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var glenum = require('./core/glenum');
    var Cache = require('./core/Cache');
    var glmatrix = require('./dep/glmatrix');
    var vec2 = glmatrix.vec2;
    var vec3 = glmatrix.vec3;
    var vec4 = glmatrix.vec4;
    function Attribute(name, type, size, semantic, isDynamic) {
        this.name = name;
        this.type = type;
        this.size = size;
        if (semantic) {
            this.semantic = semantic;
        }
        if (isDynamic) {
            this._isDynamic = true;
            this.value = [];
        } else {
            this._isDynamic = false;
            this.value = null;
        }
        switch (size) {
        case 1:
            this.get = function (idx) {
                return this.value[idx];
            };
            this.set = function (idx, value) {
                this.value[idx] = value;
            };
            break;
        case 2:
            if (isDynamic) {
                this.get = function (idx, out) {
                    out = out._array || out;
                    var item = this.value[idx];
                    if (item) {
                        vec2.copy(out, item);
                    }
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    var item = this.value[idx];
                    if (!item) {
                        item = this.value[idx] = vec2.create();
                    }
                    vec2.copy(item, val);
                };
            } else {
                this.get = function (idx, out) {
                    out = out._array || out;
                    out[0] = this.value[idx * 2];
                    out[1] = this.value[idx * 2 + 1];
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    this.value[idx * 2] = val[0];
                    this.value[idx * 2 + 1] = val[1];
                };
            }
            break;
        case 3:
            if (isDynamic) {
                this.get = function (idx, out) {
                    out = out._array || out;
                    var item = this.value[idx];
                    if (item) {
                        vec3.copy(out, item);
                    }
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    var item = this.value[idx];
                    if (!item) {
                        item = this.value[idx] = vec3.create();
                    }
                    vec3.copy(item, val);
                };
            } else {
                this.get = function (idx, out) {
                    out = out._array || out;
                    out[0] = this.value[idx * 3];
                    out[1] = this.value[idx * 3 + 1];
                    out[2] = this.value[idx * 3 + 2];
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    this.value[idx * 3] = val[0];
                    this.value[idx * 3 + 1] = val[1];
                    this.value[idx * 3 + 2] = val[2];
                };
            }
            break;
        case 4:
            if (isDynamic) {
                this.get = function (idx, out) {
                    out = out._array || out;
                    var item = this.value[idx];
                    if (item) {
                        vec4.copy(out, item);
                    }
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    var item = this.value[idx];
                    if (!item) {
                        item = this.value[idx] = vec4.create();
                    }
                    vec4.copy(item, val);
                };
            } else {
                this.get = function (idx, out) {
                    out = out._array || out;
                    out[0] = this.value[idx * 4];
                    out[1] = this.value[idx * 4 + 1];
                    out[2] = this.value[idx * 4 + 2];
                    out[3] = this.value[idx * 4 + 3];
                    return out;
                };
                this.set = function (idx, val) {
                    val = val._array || val;
                    this.value[idx * 4] = val[0];
                    this.value[idx * 4 + 1] = val[1];
                    this.value[idx * 4 + 2] = val[2];
                    this.value[idx * 4 + 3] = val[3];
                };
            }
            break;
        }
    }
    Attribute.prototype.init = function (nVertex) {
        if (!this._isDynamic) {
            if (!this.value || this.value.length != nVertex * this.size) {
                var ArrayConstructor;
                switch (this.type) {
                case 'byte':
                    ArrayConstructor = Int8Array;
                    break;
                case 'ubyte':
                    ArrayConstructor = Uint8Array;
                    break;
                case 'short':
                    ArrayConstructor = Int16Array;
                    break;
                case 'ushort':
                    ArrayConstructor = Uint16Array;
                    break;
                default:
                    ArrayConstructor = Float32Array;
                    break;
                }
                this.value = new ArrayConstructor(nVertex * this.size);
            }
        } else {
            console.warn('Dynamic geometry not support init method');
        }
    };
    Attribute.prototype.clone = function (copyValue) {
        var ret = new Attribute(this.name, this.type, this.size, this.semantic, this._isDynamic);
        if (copyValue) {
            console.warn('todo');
        }
        return ret;
    };
    function AttributeBuffer(name, type, buffer, size, semantic) {
        this.name = name;
        this.type = type;
        this.buffer = buffer;
        this.size = size;
        this.semantic = semantic;
        this.symbol = '';
    }
    function IndicesBuffer(buffer) {
        this.buffer = buffer;
        this.count = 0;
    }
    function notImplementedWarn() {
        console.warn('Geometry doesn\'t implement this method, use DynamicGeometry or StaticGeometry instead');
    }
    var Geometry = Base.derive({
        boundingBox: null,
        attributes: {},
        faces: null,
        dynamic: false,
        useFace: true
    }, function () {
        this._cache = new Cache();
        this._attributeList = Object.keys(this.attributes);
    }, {
        mainAttribute: 'position',
        dirty: notImplementedWarn,
        createAttribute: notImplementedWarn,
        removeAttribute: notImplementedWarn,
        getVertexNumber: notImplementedWarn,
        getFaceNumber: notImplementedWarn,
        getFace: notImplementedWarn,
        isUseFace: notImplementedWarn,
        getEnabledAttributes: notImplementedWarn,
        getBufferChunks: notImplementedWarn,
        generateVertexNormals: notImplementedWarn,
        generateFaceNormals: notImplementedWarn,
        isUniqueVertex: notImplementedWarn,
        generateUniqueVertex: notImplementedWarn,
        generateTangents: notImplementedWarn,
        generateBarycentric: notImplementedWarn,
        applyTransform: notImplementedWarn,
        dispose: notImplementedWarn
    });
    Geometry.STATIC_DRAW = glenum.STATIC_DRAW;
    Geometry.DYNAMIC_DRAW = glenum.DYNAMIC_DRAW;
    Geometry.STREAM_DRAW = glenum.STREAM_DRAW;
    Geometry.AttributeBuffer = AttributeBuffer;
    Geometry.IndicesBuffer = IndicesBuffer;
    Geometry.Attribute = Attribute;
    return Geometry;
});define('qtek/math/BoundingBox', [
    'require',
    './Vector3',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var Vector3 = require('./Vector3');
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var vec3TransformMat4 = vec3.transformMat4;
    var vec3Copy = vec3.copy;
    var vec3Set = vec3.set;
    var BoundingBox = function (min, max) {
        this.min = min || new Vector3(Infinity, Infinity, Infinity);
        this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
        var vertices = [];
        for (var i = 0; i < 8; i++) {
            vertices[i] = vec3.fromValues(0, 0, 0);
        }
        this.vertices = vertices;
    };
    BoundingBox.prototype = {
        constructor: BoundingBox,
        updateFromVertices: function (vertices) {
            if (vertices.length > 0) {
                var _min = this.min._array;
                var _max = this.max._array;
                vec3Copy(_min, vertices[0]);
                vec3Copy(_max, vertices[0]);
                for (var i = 1; i < vertices.length; i++) {
                    var vertex = vertices[i];
                    if (vertex[0] < _min[0]) {
                        _min[0] = vertex[0];
                    }
                    if (vertex[1] < _min[1]) {
                        _min[1] = vertex[1];
                    }
                    if (vertex[2] < _min[2]) {
                        _min[2] = vertex[2];
                    }
                    if (vertex[0] > _max[0]) {
                        _max[0] = vertex[0];
                    }
                    if (vertex[1] > _max[1]) {
                        _max[1] = vertex[1];
                    }
                    if (vertex[2] > _max[2]) {
                        _max[2] = vertex[2];
                    }
                }
                this.min._dirty = true;
                this.max._dirty = true;
            }
        },
        union: function (bbox) {
            vec3.min(this.min._array, this.min._array, bbox.min._array);
            vec3.max(this.max._array, this.max._array, bbox.max._array);
            this.min._dirty = true;
            this.max._dirty = true;
        },
        intersectBoundingBox: function (bbox) {
            var _min = this.min._array;
            var _max = this.max._array;
            var _min2 = bbox.min._array;
            var _max2 = bbox.max._array;
            return !(_min[0] > _max2[0] || _min[1] > _max2[1] || _min[2] > _max2[1] || _max[0] < _min2[0] || _max[1] < _min2[1] || _max[2] < _min2[2]);
        },
        applyTransform: function (matrix) {
            if (this.min._dirty || this.max._dirty) {
                this.updateVertices();
                this.min._dirty = false;
                this.max._dirty = false;
            }
            var m4 = matrix._array;
            var _min = this.min._array;
            var _max = this.max._array;
            var vertices = this.vertices;
            var v = vertices[0];
            vec3TransformMat4(v, v, m4);
            vec3Copy(_min, v);
            vec3Copy(_max, v);
            for (var i = 1; i < 8; i++) {
                v = vertices[i];
                vec3TransformMat4(v, v, m4);
                if (v[0] < _min[0]) {
                    _min[0] = v[0];
                }
                if (v[1] < _min[1]) {
                    _min[1] = v[1];
                }
                if (v[2] < _min[2]) {
                    _min[2] = v[2];
                }
                if (v[0] > _max[0]) {
                    _max[0] = v[0];
                }
                if (v[1] > _max[1]) {
                    _max[1] = v[1];
                }
                if (v[2] > _max[2]) {
                    _max[2] = v[2];
                }
            }
            this.min._dirty = true;
            this.max._dirty = true;
        },
        applyProjection: function (matrix) {
            if (this.min._dirty || this.max._dirty) {
                this.updateVertices();
                this.min._dirty = false;
                this.max._dirty = false;
            }
            var m = matrix._array;
            var v1 = this.vertices[0];
            var v2 = this.vertices[3];
            var v3 = this.vertices[7];
            var _min = this.min._array;
            var _max = this.max._array;
            if (m[15] === 1) {
                _min[0] = m[0] * v1[0] + m[12];
                _min[1] = m[5] * v1[1] + m[13];
                _max[2] = m[10] * v1[2] + m[14];
                _max[0] = m[0] * v3[0] + m[12];
                _max[1] = m[5] * v3[1] + m[13];
                _min[2] = m[10] * v3[2] + m[14];
            } else {
                var w = -1 / v1[2];
                _min[0] = m[0] * v1[0] * w;
                _min[1] = m[5] * v1[1] * w;
                _max[2] = (m[10] * v1[2] + m[14]) * w;
                w = -1 / v2[2];
                _max[0] = m[0] * v2[0] * w;
                _max[1] = m[5] * v2[1] * w;
                w = -1 / v3[2];
                _min[2] = (m[10] * v3[2] + m[14]) * w;
            }
            this.min._dirty = true;
            this.max._dirty = true;
        },
        updateVertices: function () {
            var min = this.min._array;
            var max = this.max._array;
            var vertices = this.vertices;
            vec3Set(vertices[0], min[0], min[1], min[2]);
            vec3Set(vertices[1], min[0], max[1], min[2]);
            vec3Set(vertices[2], max[0], min[1], min[2]);
            vec3Set(vertices[3], max[0], max[1], min[2]);
            vec3Set(vertices[4], min[0], min[1], max[2]);
            vec3Set(vertices[5], min[0], max[1], max[2]);
            vec3Set(vertices[6], max[0], min[1], max[2]);
            vec3Set(vertices[7], max[0], max[1], max[2]);
        },
        copy: function (bbox) {
            vec3Copy(this.min._array, bbox.min._array);
            vec3Copy(this.max._array, bbox.max._array);
            this.min._dirty = true;
            this.max._dirty = true;
        },
        clone: function () {
            var boundingBox = new BoundingBox();
            boundingBox.copy(this);
            return boundingBox;
        }
    };
    return BoundingBox;
});define('qtek/Texture', [
    'require',
    './core/Base',
    './core/glenum',
    './core/Cache'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var glenum = require('./core/glenum');
    var Cache = require('./core/Cache');
    var Texture = Base.derive({
        width: 512,
        height: 512,
        type: glenum.UNSIGNED_BYTE,
        format: glenum.RGBA,
        wrapS: glenum.CLAMP_TO_EDGE,
        wrapT: glenum.CLAMP_TO_EDGE,
        minFilter: glenum.LINEAR_MIPMAP_LINEAR,
        magFilter: glenum.LINEAR,
        useMipmap: true,
        anisotropic: 1,
        flipY: true,
        unpackAlignment: 4,
        premultiplyAlpha: false,
        dynamic: false,
        NPOT: false
    }, function () {
        this._cache = new Cache();
    }, {
        getWebGLTexture: function (_gl) {
            var cache = this._cache;
            cache.use(_gl.__GLID__);
            if (cache.miss('webgl_texture')) {
                cache.put('webgl_texture', _gl.createTexture());
            }
            if (this.dynamic) {
                this.update(_gl);
            } else if (cache.isDirty()) {
                this.update(_gl);
                cache.fresh();
            }
            return cache.get('webgl_texture');
        },
        bind: function () {
        },
        unbind: function () {
        },
        dirty: function () {
            this._cache.dirtyAll();
        },
        update: function (_gl) {
        },
        beforeUpdate: function (_gl) {
            _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
            _gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
            _gl.pixelStorei(_gl.UNPACK_ALIGNMENT, this.unpackAlignment);
            this.fallBack();
        },
        fallBack: function () {
            var isPowerOfTwo = this.isPowerOfTwo();
            if (this.format === glenum.DEPTH_COMPONENT) {
                this.useMipmap = false;
            }
            if (!isPowerOfTwo || !this.useMipmap) {
                this.NPOT = true;
                this._minFilterOriginal = this.minFilter;
                this._magFilterOriginal = this.magFilter;
                this._wrapSOriginal = this.wrapS;
                this._wrapTOriginal = this.wrapT;
                if (this.minFilter == glenum.NEAREST_MIPMAP_NEAREST || this.minFilter == glenum.NEAREST_MIPMAP_LINEAR) {
                    this.minFilter = glenum.NEAREST;
                } else if (this.minFilter == glenum.LINEAR_MIPMAP_LINEAR || this.minFilter == glenum.LINEAR_MIPMAP_NEAREST) {
                    this.minFilter = glenum.LINEAR;
                }
                this.wrapS = glenum.CLAMP_TO_EDGE;
                this.wrapT = glenum.CLAMP_TO_EDGE;
            } else {
                this.NPOT = false;
                if (this._minFilterOriginal) {
                    this.minFilter = this._minFilterOriginal;
                }
                if (this._magFilterOriginal) {
                    this.magFilter = this._magFilterOriginal;
                }
                if (this._wrapSOriginal) {
                    this.wrapS = this._wrapSOriginal;
                }
                if (this._wrapTOriginal) {
                    this.wrapT = this._wrapTOriginal;
                }
            }
        },
        nextHighestPowerOfTwo: function (x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i;
            }
            return x + 1;
        },
        dispose: function (_gl) {
            var cache = this._cache;
            cache.use(_gl.__GLID__);
            var webglTexture = cache.get('webgl_texture');
            if (webglTexture) {
                _gl.deleteTexture(webglTexture);
            }
            cache.deleteContext(_gl.__GLID__);
        },
        isRenderable: function () {
        },
        isPowerOfTwo: function () {
        }
    });
    Texture.BYTE = glenum.BYTE;
    Texture.UNSIGNED_BYTE = glenum.UNSIGNED_BYTE;
    Texture.SHORT = glenum.SHORT;
    Texture.UNSIGNED_SHORT = glenum.UNSIGNED_SHORT;
    Texture.INT = glenum.INT;
    Texture.UNSIGNED_INT = glenum.UNSIGNED_INT;
    Texture.FLOAT = glenum.FLOAT;
    Texture.HALF_FLOAT = 36193;
    Texture.DEPTH_COMPONENT = glenum.DEPTH_COMPONENT;
    Texture.ALPHA = glenum.ALPHA;
    Texture.RGB = glenum.RGB;
    Texture.RGBA = glenum.RGBA;
    Texture.LUMINANCE = glenum.LUMINANCE;
    Texture.LUMINANCE_ALPHA = glenum.LUMINANCE_ALPHA;
    Texture.COMPRESSED_RGB_S3TC_DXT1_EXT = 33776;
    Texture.COMPRESSED_RGBA_S3TC_DXT1_EXT = 33777;
    Texture.COMPRESSED_RGBA_S3TC_DXT3_EXT = 33778;
    Texture.COMPRESSED_RGBA_S3TC_DXT5_EXT = 33779;
    Texture.NEAREST = glenum.NEAREST;
    Texture.LINEAR = glenum.LINEAR;
    Texture.NEAREST_MIPMAP_NEAREST = glenum.NEAREST_MIPMAP_NEAREST;
    Texture.LINEAR_MIPMAP_NEAREST = glenum.LINEAR_MIPMAP_NEAREST;
    Texture.NEAREST_MIPMAP_LINEAR = glenum.NEAREST_MIPMAP_LINEAR;
    Texture.LINEAR_MIPMAP_LINEAR = glenum.LINEAR_MIPMAP_LINEAR;
    Texture.TEXTURE_MAG_FILTER = glenum.TEXTURE_MAG_FILTER;
    Texture.TEXTURE_MIN_FILTER = glenum.TEXTURE_MIN_FILTER;
    Texture.REPEAT = glenum.REPEAT;
    Texture.CLAMP_TO_EDGE = glenum.CLAMP_TO_EDGE;
    Texture.MIRRORED_REPEAT = glenum.MIRRORED_REPEAT;
    return Texture;
});define('echarts-x/component/base3d', [
    'require',
    'echarts/component/base',
    '../core/Layer3D',
    'zrender/tool/util'
], function (require) {
    'use strict';
    var ComponentBase = require('echarts/component/base');
    var Layer3D = require('../core/Layer3D');
    var zrUtil = require('zrender/tool/util');
    var Base3D = function (ecTheme, messageCenter, zr, option, myChart) {
        ComponentBase.call(this, ecTheme, messageCenter, zr, option, myChart);
        var zlevel = this.getZlevelBase();
        this.baseLayer = new Layer3D(zlevel, this.zr.painter);
        this.zr.painter.insertLayer(zlevel, this.baseLayer);
        this.zr.animation.bind('frame', this.onframe, this);
    };
    Base3D.prototype = {
        constructor: Base3D,
        onframe: function () {
        },
        dispose: function () {
            this.zr.animation.unbind('frame', this.onframe);
        }
    };
    zrUtil.inherits(Base3D, ComponentBase);
    return Base3D;
});define('echarts-x/util/color', [], function () {
    var kCSSColorTable = {
        'transparent': [
            0,
            0,
            0,
            0
        ],
        'aliceblue': [
            240,
            248,
            255,
            1
        ],
        'antiquewhite': [
            250,
            235,
            215,
            1
        ],
        'aqua': [
            0,
            255,
            255,
            1
        ],
        'aquamarine': [
            127,
            255,
            212,
            1
        ],
        'azure': [
            240,
            255,
            255,
            1
        ],
        'beige': [
            245,
            245,
            220,
            1
        ],
        'bisque': [
            255,
            228,
            196,
            1
        ],
        'black': [
            0,
            0,
            0,
            1
        ],
        'blanchedalmond': [
            255,
            235,
            205,
            1
        ],
        'blue': [
            0,
            0,
            255,
            1
        ],
        'blueviolet': [
            138,
            43,
            226,
            1
        ],
        'brown': [
            165,
            42,
            42,
            1
        ],
        'burlywood': [
            222,
            184,
            135,
            1
        ],
        'cadetblue': [
            95,
            158,
            160,
            1
        ],
        'chartreuse': [
            127,
            255,
            0,
            1
        ],
        'chocolate': [
            210,
            105,
            30,
            1
        ],
        'coral': [
            255,
            127,
            80,
            1
        ],
        'cornflowerblue': [
            100,
            149,
            237,
            1
        ],
        'cornsilk': [
            255,
            248,
            220,
            1
        ],
        'crimson': [
            220,
            20,
            60,
            1
        ],
        'cyan': [
            0,
            255,
            255,
            1
        ],
        'darkblue': [
            0,
            0,
            139,
            1
        ],
        'darkcyan': [
            0,
            139,
            139,
            1
        ],
        'darkgoldenrod': [
            184,
            134,
            11,
            1
        ],
        'darkgray': [
            169,
            169,
            169,
            1
        ],
        'darkgreen': [
            0,
            100,
            0,
            1
        ],
        'darkgrey': [
            169,
            169,
            169,
            1
        ],
        'darkkhaki': [
            189,
            183,
            107,
            1
        ],
        'darkmagenta': [
            139,
            0,
            139,
            1
        ],
        'darkolivegreen': [
            85,
            107,
            47,
            1
        ],
        'darkorange': [
            255,
            140,
            0,
            1
        ],
        'darkorchid': [
            153,
            50,
            204,
            1
        ],
        'darkred': [
            139,
            0,
            0,
            1
        ],
        'darksalmon': [
            233,
            150,
            122,
            1
        ],
        'darkseagreen': [
            143,
            188,
            143,
            1
        ],
        'darkslateblue': [
            72,
            61,
            139,
            1
        ],
        'darkslategray': [
            47,
            79,
            79,
            1
        ],
        'darkslategrey': [
            47,
            79,
            79,
            1
        ],
        'darkturquoise': [
            0,
            206,
            209,
            1
        ],
        'darkviolet': [
            148,
            0,
            211,
            1
        ],
        'deeppink': [
            255,
            20,
            147,
            1
        ],
        'deepskyblue': [
            0,
            191,
            255,
            1
        ],
        'dimgray': [
            105,
            105,
            105,
            1
        ],
        'dimgrey': [
            105,
            105,
            105,
            1
        ],
        'dodgerblue': [
            30,
            144,
            255,
            1
        ],
        'firebrick': [
            178,
            34,
            34,
            1
        ],
        'floralwhite': [
            255,
            250,
            240,
            1
        ],
        'forestgreen': [
            34,
            139,
            34,
            1
        ],
        'fuchsia': [
            255,
            0,
            255,
            1
        ],
        'gainsboro': [
            220,
            220,
            220,
            1
        ],
        'ghostwhite': [
            248,
            248,
            255,
            1
        ],
        'gold': [
            255,
            215,
            0,
            1
        ],
        'goldenrod': [
            218,
            165,
            32,
            1
        ],
        'gray': [
            128,
            128,
            128,
            1
        ],
        'green': [
            0,
            128,
            0,
            1
        ],
        'greenyellow': [
            173,
            255,
            47,
            1
        ],
        'grey': [
            128,
            128,
            128,
            1
        ],
        'honeydew': [
            240,
            255,
            240,
            1
        ],
        'hotpink': [
            255,
            105,
            180,
            1
        ],
        'indianred': [
            205,
            92,
            92,
            1
        ],
        'indigo': [
            75,
            0,
            130,
            1
        ],
        'ivory': [
            255,
            255,
            240,
            1
        ],
        'khaki': [
            240,
            230,
            140,
            1
        ],
        'lavender': [
            230,
            230,
            250,
            1
        ],
        'lavenderblush': [
            255,
            240,
            245,
            1
        ],
        'lawngreen': [
            124,
            252,
            0,
            1
        ],
        'lemonchiffon': [
            255,
            250,
            205,
            1
        ],
        'lightblue': [
            173,
            216,
            230,
            1
        ],
        'lightcoral': [
            240,
            128,
            128,
            1
        ],
        'lightcyan': [
            224,
            255,
            255,
            1
        ],
        'lightgoldenrodyellow': [
            250,
            250,
            210,
            1
        ],
        'lightgray': [
            211,
            211,
            211,
            1
        ],
        'lightgreen': [
            144,
            238,
            144,
            1
        ],
        'lightgrey': [
            211,
            211,
            211,
            1
        ],
        'lightpink': [
            255,
            182,
            193,
            1
        ],
        'lightsalmon': [
            255,
            160,
            122,
            1
        ],
        'lightseagreen': [
            32,
            178,
            170,
            1
        ],
        'lightskyblue': [
            135,
            206,
            250,
            1
        ],
        'lightslategray': [
            119,
            136,
            153,
            1
        ],
        'lightslategrey': [
            119,
            136,
            153,
            1
        ],
        'lightsteelblue': [
            176,
            196,
            222,
            1
        ],
        'lightyellow': [
            255,
            255,
            224,
            1
        ],
        'lime': [
            0,
            255,
            0,
            1
        ],
        'limegreen': [
            50,
            205,
            50,
            1
        ],
        'linen': [
            250,
            240,
            230,
            1
        ],
        'magenta': [
            255,
            0,
            255,
            1
        ],
        'maroon': [
            128,
            0,
            0,
            1
        ],
        'mediumaquamarine': [
            102,
            205,
            170,
            1
        ],
        'mediumblue': [
            0,
            0,
            205,
            1
        ],
        'mediumorchid': [
            186,
            85,
            211,
            1
        ],
        'mediumpurple': [
            147,
            112,
            219,
            1
        ],
        'mediumseagreen': [
            60,
            179,
            113,
            1
        ],
        'mediumslateblue': [
            123,
            104,
            238,
            1
        ],
        'mediumspringgreen': [
            0,
            250,
            154,
            1
        ],
        'mediumturquoise': [
            72,
            209,
            204,
            1
        ],
        'mediumvioletred': [
            199,
            21,
            133,
            1
        ],
        'midnightblue': [
            25,
            25,
            112,
            1
        ],
        'mintcream': [
            245,
            255,
            250,
            1
        ],
        'mistyrose': [
            255,
            228,
            225,
            1
        ],
        'moccasin': [
            255,
            228,
            181,
            1
        ],
        'navajowhite': [
            255,
            222,
            173,
            1
        ],
        'navy': [
            0,
            0,
            128,
            1
        ],
        'oldlace': [
            253,
            245,
            230,
            1
        ],
        'olive': [
            128,
            128,
            0,
            1
        ],
        'olivedrab': [
            107,
            142,
            35,
            1
        ],
        'orange': [
            255,
            165,
            0,
            1
        ],
        'orangered': [
            255,
            69,
            0,
            1
        ],
        'orchid': [
            218,
            112,
            214,
            1
        ],
        'palegoldenrod': [
            238,
            232,
            170,
            1
        ],
        'palegreen': [
            152,
            251,
            152,
            1
        ],
        'paleturquoise': [
            175,
            238,
            238,
            1
        ],
        'palevioletred': [
            219,
            112,
            147,
            1
        ],
        'papayawhip': [
            255,
            239,
            213,
            1
        ],
        'peachpuff': [
            255,
            218,
            185,
            1
        ],
        'peru': [
            205,
            133,
            63,
            1
        ],
        'pink': [
            255,
            192,
            203,
            1
        ],
        'plum': [
            221,
            160,
            221,
            1
        ],
        'powderblue': [
            176,
            224,
            230,
            1
        ],
        'purple': [
            128,
            0,
            128,
            1
        ],
        'red': [
            255,
            0,
            0,
            1
        ],
        'rosybrown': [
            188,
            143,
            143,
            1
        ],
        'royalblue': [
            65,
            105,
            225,
            1
        ],
        'saddlebrown': [
            139,
            69,
            19,
            1
        ],
        'salmon': [
            250,
            128,
            114,
            1
        ],
        'sandybrown': [
            244,
            164,
            96,
            1
        ],
        'seagreen': [
            46,
            139,
            87,
            1
        ],
        'seashell': [
            255,
            245,
            238,
            1
        ],
        'sienna': [
            160,
            82,
            45,
            1
        ],
        'silver': [
            192,
            192,
            192,
            1
        ],
        'skyblue': [
            135,
            206,
            235,
            1
        ],
        'slateblue': [
            106,
            90,
            205,
            1
        ],
        'slategray': [
            112,
            128,
            144,
            1
        ],
        'slategrey': [
            112,
            128,
            144,
            1
        ],
        'snow': [
            255,
            250,
            250,
            1
        ],
        'springgreen': [
            0,
            255,
            127,
            1
        ],
        'steelblue': [
            70,
            130,
            180,
            1
        ],
        'tan': [
            210,
            180,
            140,
            1
        ],
        'teal': [
            0,
            128,
            128,
            1
        ],
        'thistle': [
            216,
            191,
            216,
            1
        ],
        'tomato': [
            255,
            99,
            71,
            1
        ],
        'turquoise': [
            64,
            224,
            208,
            1
        ],
        'violet': [
            238,
            130,
            238,
            1
        ],
        'wheat': [
            245,
            222,
            179,
            1
        ],
        'white': [
            255,
            255,
            255,
            1
        ],
        'whitesmoke': [
            245,
            245,
            245,
            1
        ],
        'yellow': [
            255,
            255,
            0,
            1
        ],
        'yellowgreen': [
            154,
            205,
            50,
            1
        ]
    };
    function clamp_css_byte(i) {
        i = Math.round(i);
        return i < 0 ? 0 : i > 255 ? 255 : i;
    }
    function clamp_css_float(f) {
        return f < 0 ? 0 : f > 1 ? 1 : f;
    }
    function parse_css_int(str) {
        if (str[str.length - 1] === '%')
            return clamp_css_byte(parseFloat(str) / 100 * 255);
        return clamp_css_byte(parseInt(str));
    }
    function parse_css_float(str) {
        if (str[str.length - 1] === '%')
            return clamp_css_float(parseFloat(str) / 100);
        return clamp_css_float(parseFloat(str));
    }
    function css_hue_to_rgb(m1, m2, h) {
        if (h < 0)
            h += 1;
        else if (h > 1)
            h -= 1;
        if (h * 6 < 1)
            return m1 + (m2 - m1) * h * 6;
        if (h * 2 < 1)
            return m2;
        if (h * 3 < 2)
            return m1 + (m2 - m1) * (2 / 3 - h) * 6;
        return m1;
    }
    function parse(css_str) {
        var str = css_str.replace(/ /g, '').toLowerCase();
        if (str in kCSSColorTable)
            return kCSSColorTable[str].slice();
        if (str[0] === '#') {
            if (str.length === 4) {
                var iv = parseInt(str.substr(1), 16);
                if (!(iv >= 0 && iv <= 4095))
                    return null;
                return [
                    (iv & 3840) >> 4 | (iv & 3840) >> 8,
                    iv & 240 | (iv & 240) >> 4,
                    iv & 15 | (iv & 15) << 4,
                    1
                ];
            } else if (str.length === 7) {
                var iv = parseInt(str.substr(1), 16);
                if (!(iv >= 0 && iv <= 16777215))
                    return null;
                return [
                    (iv & 16711680) >> 16,
                    (iv & 65280) >> 8,
                    iv & 255,
                    1
                ];
            }
            return null;
        }
        var op = str.indexOf('('), ep = str.indexOf(')');
        if (op !== -1 && ep + 1 === str.length) {
            var fname = str.substr(0, op);
            var params = str.substr(op + 1, ep - (op + 1)).split(',');
            var alpha = 1;
            switch (fname) {
            case 'rgba':
                if (params.length !== 4)
                    return null;
                alpha = parse_css_float(params.pop());
            case 'rgb':
                if (params.length !== 3)
                    return null;
                return [
                    parse_css_int(params[0]),
                    parse_css_int(params[1]),
                    parse_css_int(params[2]),
                    alpha
                ];
            case 'hsla':
                if (params.length !== 4)
                    return null;
                alpha = parse_css_float(params.pop());
            case 'hsl':
                if (params.length !== 3)
                    return null;
                var h = (parseFloat(params[0]) % 360 + 360) % 360 / 360;
                var s = parse_css_float(params[1]);
                var l = parse_css_float(params[2]);
                var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
                var m1 = l * 2 - m2;
                return [
                    clamp_css_byte(css_hue_to_rgb(m1, m2, h + 1 / 3) * 255),
                    clamp_css_byte(css_hue_to_rgb(m1, m2, h) * 255),
                    clamp_css_byte(css_hue_to_rgb(m1, m2, h - 1 / 3) * 255),
                    alpha
                ];
            default:
                return null;
            }
        }
        return null;
    }
    return { parse: parse };
});define('echarts-x/entity/marker/MarkLine', [
    'require',
    'zrender/tool/util',
    './Base',
    'qtek/Renderable',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Node',
    '../../util/geometry/Lines',
    '../../util/geometry/CurveAnimatingPoints',
    'qtek/Texture2D',
    'qtek/math/Vector3'
], function (require) {
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
    var MarkLine = function (chart) {
        MarkBase.call(this, chart);
        this._sceneNode = new Node();
        this._markLineRenderable = null;
        this._curveAnimatingPointsRenderable = null;
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
        setSeries: function (serie, seriesIndex) {
            if (!serie.markLine || !serie.markLine.data) {
                return;
            }
            this.seriesIndex = seriesIndex;
            var chart = this.chart;
            var legend = chart.component.legend;
            var zr = chart.zr;
            var markLine = serie.markLine;
            var devicePixelRatio = window.devicePixelRatio || 1;
            if (!this._markLineRenderable) {
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
                if (!this._curveAnimatingPointsRenderable) {
                    this._createCurveAnimatingPointsRenderable();
                }
                pointsRenderable = this._curveAnimatingPointsRenderable;
                pointsRenderable.material.set('pointSize', scaleSize * devicePixelRatio);
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
                if (typeof color == 'function') {
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
        getSceneNode: function () {
            return this._sceneNode;
        },
        onframe: function (deltaTime) {
            var renderable = this._curveAnimatingPointsRenderable;
            if (renderable && renderable.geometry.getVertexNumber() > 0) {
                this._elapsedTime += deltaTime / 1000;
                var t = this._elapsedTime / 3;
                t %= 1;
                renderable.material.set('percent', t);
                this.chart.zr.refreshNextFrame();
            }
        }
    };
    zrUtil.inherits(MarkLine, MarkBase);
    return MarkLine;
});define('echarts-x/entity/marker/MarkBar', [
    'require',
    'zrender/tool/util',
    './Base',
    'qtek/Renderable',
    'qtek/Material',
    'qtek/Shader',
    '../../util/geometry/Bars',
    'qtek/math/Vector3'
], function (require) {
    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Renderable = require('qtek/Renderable');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var BarsGeometry = require('../../util/geometry/Bars');
    var Vector3 = require('qtek/math/Vector3');
    var MarkBar = function (chart) {
        MarkBase.call(this, chart);
        this._markBarRenderable = null;
    };
    MarkBar.prototype = {
        constructor: MarkBar,
        _createMarkBarRenderable: function () {
            var material = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.albedo.vertex'),
                    fragment: Shader.source('ecx.albedo.fragment')
                })
            });
            material.shader.define('both', 'VERTEX_COLOR');
            this._markBarRenderable = new Renderable({
                geometry: new BarsGeometry(),
                material: material,
                ignorePicking: true
            });
        },
        setSeries: function (serie, seriesIndex) {
            if (!serie.markBar || !serie.markBar.data) {
                return;
            }
            var chart = this.chart;
            var component = chart.component;
            var legend = component.legend;
            var dataRange = component.dataRange;
            if (!this._markBarRenderable) {
                this._createMarkBarRenderable();
            }
            var dataList = serie.markBar.data;
            var geometry = this._markBarRenderable.geometry;
            var serieColor;
            if (legend) {
                serieColor = legend.getColor(serie.name);
            }
            serieColor = chart.query(serie.markBar, 'itemStyle.normal.color') || serieColor;
            var serieDefaultColor = chart.zr.getColor(seriesIndex);
            var start = new Vector3();
            var end = new Vector3();
            var normal = new Vector3();
            var globalBarSize = serie.markBar.barSize;
            for (var i = 0; i < dataList.length; i++) {
                var dataItem = dataList[i];
                var value = chart.getDataFromOption(dataItem, null);
                var dataRangeColor = null;
                if (dataRange) {
                    dataRangeColor = isNaN(value) ? color : dataRange.getColor(value);
                    if (dataRangeColor == null) {
                        continue;
                    }
                }
                var itemColor = chart.query(dataItem, 'itemStyle.normal.color');
                var color = itemColor || dataRangeColor || serieColor || serieDefaultColor;
                if (typeof color == 'function') {
                    color = color(dataItem);
                }
                var colorArr = chart.parseColor(color) || new Float32Array();
                var barSize = dataItem.barSize != null ? dataItem.barSize : globalBarSize;
                if (typeof barSize == 'function') {
                    barSize = barSize(dataItem);
                }
                chart.getMarkBarPoints(seriesIndex, dataItem, start, end);
                this._markBarRenderable.geometry.addBar(start, end, barSize, colorArr);
            }
            this._markBarRenderable.geometry.dirty();
        },
        getSceneNode: function () {
            return this._markBarRenderable;
        },
        clear: function () {
            if (this._markBarRenderable) {
                this._markBarRenderable.geometry.clearBars();
            }
        }
    };
    zrUtil.inherits(MarkBar, MarkBase);
    return MarkBar;
});define('echarts-x/entity/marker/MarkPoint', [
    'require',
    'zrender/tool/util',
    './Base',
    'qtek/Renderable',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Node',
    'qtek/Texture2D',
    'qtek/Texture',
    '../../surface/TextureAtlasSurface',
    '../../util/geometry/Sprites',
    '../../util/sprite',
    'echarts/util/shape/Icon',
    'zrender/shape/Image',
    'qtek/math/Matrix4'
], function (require) {
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
            if (!serie.markPoint || !serie.markPoint.data || serie.markPoint.data.length === 0) {
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
            var atlasSize = Texture.prototype.nextHighestPowerOfTwo(Math.sqrt(dataList.length) * this._spriteSize);
            atlasSize = Math.min(2048, atlasSize);
            var textureAtlas = new TextureAtlasSurface(chart.zr, atlasSize, atlasSize);
            this._textureAtlasList.push(textureAtlas);
            var spriteRenderable = this._createSpritesRenderable(textureAtlas);
            for (var i = 0; i < dataList.length; i++) {
                var dataItem = dataList[i];
                var value = chart.getDataFromOption(dataItem, null);
                var queryTarget = [
                    dataItem,
                    markPoint
                ];
                var dataRangeColor = null;
                if (dataRange) {
                    dataRangeColor = isNaN(value) ? color : dataRange.getColor(value);
                    if (dataRangeColor == null) {
                        continue;
                    }
                }
                var itemColor = chart.query(dataItem, 'itemStyle.normal.color');
                var color = itemColor || dataRangeColor || serieColor || serieDefaultColor;
                if (typeof color == 'function') {
                    color = color(dataItem);
                }
                var symbol = chart.deepQuery(queryTarget, 'symbol');
                var symbolSize = chart.deepQuery(queryTarget, 'symbolSize');
                var strokeColor = chart.deepQuery(queryTarget, 'itemStyle.normal.borderColor');
                var lineWidth = chart.deepQuery(queryTarget, 'itemStyle.normal.borderWidth');
                var shape;
                if (symbol.match(/^image:\/\//)) {
                    shape = new ImageShape({ style: { image: symbol.replace(/^image:\/\//, '') } });
                } else {
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
                if (chart.deepQuery(queryTarget, 'itemStyle.normal.label.show')) {
                    shape.style.text = chart.getSerieLabelText(markPoint, dataItem, dataItem.name, 'normal');
                    shape.style.textPosition = 'inside';
                    shape.style.textColor = chart.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle.color');
                    shape.style.textFont = chart.getFont(chart.deepQuery(queryTarget, 'itemStyle.normal.label.textStyle'));
                }
                var coords = textureAtlas.addShape(shape, spriteSize, spriteSize);
                if (!coords) {
                    textureAtlas = new TextureAtlasSurface(chart.zr, atlasSize, atlasSize);
                    this._textureAtlasList.push(textureAtlas);
                    spriteRenderable = this._createSpritesRenderable(textureAtlas);
                    coords = textureAtlas.addShape(shape, spriteSize, spriteSize);
                }
                chart.getMarkPointTransform(seriesIndex, dataItem, matrix);
                spriteRenderable.geometry.addSprite(matrix, coords);
            }
            for (var i = 0; i < this._textureAtlasList.length; i++) {
                this._textureAtlasList[i].refresh();
            }
        },
        _createSpritesRenderable: function (textureAtlas) {
            if (!this._spritesShader) {
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
});define('echarts-x/entity/marker/LargeMarkPoint', [
    'require',
    'zrender/tool/util',
    './Base',
    'qtek/Renderable',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Node',
    '../../util/geometry/Points',
    '../../util/geometry/AnimatingPoints',
    'qtek/Texture2D',
    '../../util/sprite',
    'qtek/math/Vector3',
    'echarts/util/shape/Icon'
], function (require) {
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
    var LargeMarkPoint = function (chart) {
        MarkBase.call(this, chart);
        this._sceneNode = new Node();
        this._markPointRenderable = null;
        this._animatingMarkPointRenderable = null;
        this._spriteTexture = null;
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
            if (!this._spriteTexture) {
                this._spriteTexture = new Texture2D({ flipY: false });
            }
            var spriteTexture = this._spriteTexture;
            spriteTexture.image = spriteUtil.makeSpriteFromShape(size, shape, spriteTexture.image);
            spriteTexture.dirty();
        },
        clear: function () {
            if (this._markPointRenderable) {
                this._markPointRenderable.geometry.clearPoints();
            }
            if (this._animatingMarkPointRenderable) {
                this._animatingMarkPointRenderable.geometry.clearPoints();
            }
            this._elapsedTime = 0;
        },
        setSeries: function (serie, seriesIndex) {
            if (!serie.markPoint || !serie.markPoint.data) {
                return;
            }
            this.seriesIndex = seriesIndex;
            var chart = this.chart;
            var component = chart.component;
            var legend = component.legend;
            var dataRange = component.dataRange;
            var markPoint = serie.markPoint;
            var zr = chart.zr;
            var symbol = chart.query(markPoint, 'symbol');
            var showMarkPointEffect = chart.query(markPoint, 'effect.show');
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
                if (!this._animatingMarkPointRenderable) {
                    this._createAnimatingMarkPointRenderable();
                }
                this._animatingMarkPointRenderable.geometry.dirty();
            } else {
                if (!this._markPointRenderable) {
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
                    if (dataRangeColor == null) {
                        continue;
                    }
                }
                var itemColor = chart.query(dataItem, 'itemStyle.normal.color');
                var color = itemColor || dataRangeColor || serieColor || serieDefaultColor;
                if (typeof color == 'function') {
                    color = color(dataItem);
                }
                var colorArr = chart.parseColor(color) || new Float32Array(4);
                var size = dataItem.symbolSize == null ? globalSize : dataItem.symbolSize;
                if (typeof size == 'function') {
                    size = size(dataItem);
                }
                size *= window.devicePixelRatio || 1;
                var coord = new Vector3();
                chart.getMarkCoord(seriesIndex, dataItem, coord);
                if (showMarkPointEffect) {
                    this._animatingMarkPointRenderable.geometry.addPoint(coord, colorArr, size, Math.random() * 2);
                } else {
                    this._markPointRenderable.geometry.addPoint(coord, colorArr, size);
                }
            }
        },
        getSceneNode: function () {
            return this._sceneNode;
        },
        onframe: function (deltaTime) {
            if (this._animatingMarkPointRenderable) {
                var renderable = this._animatingMarkPointRenderable;
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
});define('echarts-x/core/Layer3D', [
    'require',
    'qtek/Renderer',
    'qtek/Scene',
    'qtek/camera/Perspective',
    'qtek/camera/Orthographic',
    'qtek/picking/RayPicking',
    'zrender/mixin/Eventful',
    'zrender/tool/util'
], function (require) {
    var Renderer = require('qtek/Renderer');
    var Scene = require('qtek/Scene');
    var PerspectiveCamera = require('qtek/camera/Perspective');
    var OrthoCamera = require('qtek/camera/Orthographic');
    var RayPicking = require('qtek/picking/RayPicking');
    var Eventful = require('zrender/mixin/Eventful');
    var zrUtil = require('zrender/tool/util');
    var Layer3D = function (id, painter) {
        Eventful.call(this);
        this.id = id;
        try {
            this.renderer = new Renderer();
            this.renderer.resize(painter.getWidth(), painter.getHeight());
        } catch (e) {
            this.renderer = null;
            this.dom = document.createElement('div');
            this.dom.style.cssText = 'position:absolute; left: 0; top: 0; right: 0; bottom: 0;';
            this.dom.className = 'ecx-nowebgl';
            this.dom.innerHTML = 'Sorry, your browser does support WebGL';
            return;
        }
        this.dom = this.renderer.canvas;
        var style = this.dom.style;
        style.position = 'absolute';
        style.left = '0';
        style.top = '0';
        this.camera = new PerspectiveCamera();
        this.camera.aspect = painter.getWidth() / painter.getHeight();
        this.scene = new Scene();
        this._viewport = {
            x: 0,
            y: 0,
            width: 1,
            height: 1
        };
        this._initHandlers();
    };
    Layer3D.prototype._initHandlers = function () {
        this.bind('click', this._clickHandler, this);
        this.bind('mousedown', this._mouseDownHandler, this);
        this.bind('mouseup', this._mouseUpHandler, this);
        this.bind('mousemove', this._mouseMoveHandler, this);
        this._picking = new RayPicking({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer
        });
    };
    Layer3D.prototype.resize = function (width, height) {
        var renderer = this.renderer;
        renderer.resize(width, height);
        var viewport = this._viewport;
        this.setViewport(viewport.x * width, viewport.y * height, viewport.width * width, viewport.height * height);
    };
    Layer3D.prototype.setViewport = function (x, y, width, height) {
        var renderer = this.renderer;
        var rendererWidth = renderer.getWidth();
        var rendererHeight = renderer.getHeight();
        var viewport = this._viewport;
        viewport.x = x / rendererWidth;
        viewport.y = y / rendererHeight;
        viewport.width = width / rendererWidth;
        viewport.height = 1 - height / rendererHeight;
        renderer.setViewport(x, y, width, height);
        var camera = this.camera;
        if (camera instanceof PerspectiveCamera) {
            camera.aspect = width / height;
        }
    };
    Layer3D.prototype.refresh = function () {
        this.renderer.render(this.scene, this.camera);
    };
    Layer3D.prototype.dispose = function () {
        this.renderer.disposeScene(this.scene);
    };
    Layer3D.prototype.onmousedown = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('mousedown', e, obj);
        }
    };
    Layer3D.prototype.onmousemove = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('mousemove', e, obj);
        }
    };
    Layer3D.prototype.onmouseup = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('mouseup', e, obj);
        }
    };
    Layer3D.prototype.onclick = function (e) {
        e = e.event;
        var obj = this.pickObject(e.offsetX, e.offsetY);
        if (obj) {
            this._dispatchEvent('click', e, obj);
        }
    };
    Layer3D.prototype.pickObject = function (x, y) {
        return this._picking.pick(x, y);
    };
    Layer3D.prototype._dispatchEvent = function (eveName, e, obj) {
        var current = obj.target;
        obj.cancelBubble = false;
        obj.event = e;
        obj.type = eveName;
        while (current) {
            current.trigger(eveName, obj);
            current = current.getParent();
            if (obj.cancelBubble) {
                break;
            }
        }
    };
    zrUtil.inherits(Layer3D, Eventful);
    return Layer3D;
});define('qtek/Renderer', [
    'require',
    './core/Base',
    './Texture',
    './core/glinfo',
    './core/glenum',
    './math/BoundingBox',
    './math/Matrix4',
    './shader/library',
    './Material',
    './math/Vector2',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var Texture = require('./Texture');
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var BoundingBox = require('./math/BoundingBox');
    var Matrix4 = require('./math/Matrix4');
    var shaderLibrary = require('./shader/library');
    var Material = require('./Material');
    var Vector2 = require('./math/Vector2');
    var glMatrix = require('./dep/glmatrix');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var glid = 0;
    var errorShader = {};
    var Renderer = Base.derive(function () {
        return {
            canvas: null,
            width: 100,
            height: 100,
            devicePixelRatio: window.devicePixelRatio || 1,
            color: [
                0,
                0,
                0,
                0
            ],
            clear: 17664,
            alhpa: true,
            depth: true,
            stencil: false,
            antialias: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            throwError: true,
            gl: null,
            viewport: {},
            _viewportSettings: [],
            _clearSettings: [],
            _sceneRendering: null
        };
    }, function () {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        try {
            var opts = {
                alhpa: this.alhpa,
                depth: this.depth,
                stencil: this.stencil,
                antialias: this.antialias,
                premultipliedAlpha: this.premultipliedAlpha,
                preserveDrawingBuffer: this.preserveDrawingBuffer
            };
            this.gl = this.canvas.getContext('webgl', opts) || this.canvas.getContext('experimental-webgl', opts);
            if (!this.gl) {
                throw new Error();
            }
            this.gl.__GLID__ = glid++;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
            this.resize(this.width, this.height);
            glinfo.initialize(this.gl);
        } catch (e) {
            throw 'Error creating WebGL Context';
        }
    }, {
        resize: function (width, height) {
            var canvas = this.canvas;
            if (typeof width !== 'undefined') {
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.width = width * this.devicePixelRatio;
                canvas.height = height * this.devicePixelRatio;
                this.width = width;
                this.height = height;
            } else {
                this.width = canvas.width / this.devicePixelRatio;
                this.height = canvas.height / this.devicePixelRatio;
            }
            this.setViewport(0, 0, width, height);
        },
        getWidth: function () {
            return this.width;
        },
        getHeight: function () {
            return this.height;
        },
        setDevicePixelRatio: function (devicePixelRatio) {
            this.devicePixelRatio = devicePixelRatio;
            this.resize(this.width, this.height);
        },
        getDevicePixelRatio: function () {
            return this.devicePixelRatio;
        },
        setViewport: function (x, y, width, height, dpr) {
            if (typeof x === 'object') {
                var obj = x;
                x = obj.x;
                y = obj.y;
                width = obj.width;
                height = obj.height;
            }
            dpr = dpr || this.devicePixelRatio;
            this.gl.viewport(x * dpr, y * dpr, width * dpr, height * dpr);
            this.viewport = {
                x: x,
                y: y,
                width: width,
                height: height
            };
        },
        saveViewport: function () {
            this._viewportSettings.push(this.viewport);
        },
        restoreViewport: function () {
            if (this._viewportSettings.length > 0) {
                this.setViewport(this._viewportSettings.pop());
            }
        },
        saveClear: function () {
            this._clearSettings.push(this.clear);
        },
        restoreClear: function () {
            if (this._clearSettings.length > 0) {
                this.clear = this._clearSettings.pop();
            }
        },
        render: function (scene, camera, notUpdateScene, preZ) {
            var _gl = this.gl;
            this._sceneRendering = scene;
            var color = this.color;
            if (this.clear) {
                _gl.clearColor(color[0], color[1], color[2], color[3]);
                _gl.clear(this.clear);
            }
            if (!notUpdateScene) {
                scene.update(false);
            }
            if (!camera.getScene()) {
                camera.update(true);
            }
            var opaqueQueue = scene.opaqueQueue;
            var transparentQueue = scene.transparentQueue;
            var sceneMaterial = scene.material;
            scene.trigger('beforerender', this, scene, camera);
            if (transparentQueue.length > 0) {
                var worldViewMat = mat4.create();
                var posViewSpace = vec3.create();
                for (var i = 0; i < transparentQueue.length; i++) {
                    var node = transparentQueue[i];
                    mat4.multiply(worldViewMat, camera.viewMatrix._array, node.worldTransform._array);
                    vec3.transformMat4(posViewSpace, node.position._array, worldViewMat);
                    node.__depth = posViewSpace[2];
                }
            }
            opaqueQueue.sort(Renderer.opaqueSortFunc);
            transparentQueue.sort(Renderer.transparentSortFunc);
            scene.trigger('beforerender:opaque', this, opaqueQueue);
            camera.sceneBoundingBoxLastFrame.min.set(Infinity, Infinity, Infinity);
            camera.sceneBoundingBoxLastFrame.max.set(-Infinity, -Infinity, -Infinity);
            _gl.disable(_gl.BLEND);
            _gl.enable(_gl.DEPTH_TEST);
            var opaqueRenderInfo = this.renderQueue(opaqueQueue, camera, sceneMaterial, preZ);
            scene.trigger('afterrender:opaque', this, opaqueQueue, opaqueRenderInfo);
            scene.trigger('beforerender:transparent', this, transparentQueue);
            _gl.enable(_gl.BLEND);
            var transparentRenderInfo = this.renderQueue(transparentQueue, camera, sceneMaterial);
            scene.trigger('afterrender:transparent', this, transparentQueue, transparentRenderInfo);
            var renderInfo = {};
            for (var name in opaqueRenderInfo) {
                renderInfo[name] = opaqueRenderInfo[name] + transparentRenderInfo[name];
            }
            scene.trigger('afterrender', this, scene, camera, renderInfo);
            return renderInfo;
        },
        renderQueue: function (queue, camera, globalMaterial, preZ) {
            var renderInfo = {
                faceNumber: 0,
                vertexNumber: 0,
                drawCallNumber: 0,
                meshNumber: queue.length,
                renderedMeshNumber: 0
            };
            mat4.copy(matrices.VIEW, camera.viewMatrix._array);
            mat4.copy(matrices.PROJECTION, camera.projectionMatrix._array);
            mat4.multiply(matrices.VIEWPROJECTION, camera.projectionMatrix._array, matrices.VIEW);
            mat4.copy(matrices.VIEWINVERSE, camera.worldTransform._array);
            mat4.invert(matrices.PROJECTIONINVERSE, matrices.PROJECTION);
            mat4.invert(matrices.VIEWPROJECTIONINVERSE, matrices.VIEWPROJECTION);
            var _gl = this.gl;
            var scene = this._sceneRendering;
            var prevMaterial;
            var prevShader;
            var depthTest, depthMask;
            var culling, cullFace, frontFace;
            var culledRenderQueue;
            if (preZ) {
                var preZPassMaterial = new Material({ shader: shaderLibrary.get('buildin.prez') });
                var preZPassShader = preZPassMaterial.shader;
                culledRenderQueue = [];
                preZPassShader.bind(_gl);
                _gl.colorMask(false, false, false, false);
                _gl.depthMask(true);
                for (var i = 0; i < queue.length; i++) {
                    var renderable = queue[i];
                    var worldM = renderable.worldTransform._array;
                    var geometry = renderable.geometry;
                    mat4.multiply(matrices.WORLDVIEW, matrices.VIEW, worldM);
                    mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION, worldM);
                    if (geometry.boundingBox) {
                        if (!this._frustumCulling(renderable, camera)) {
                            continue;
                        }
                    }
                    if (renderable.skeleton) {
                        continue;
                    }
                    if (renderable.cullFace !== cullFace) {
                        cullFace = renderable.cullFace;
                        _gl.cullFace(cullFace);
                    }
                    if (renderable.frontFace !== frontFace) {
                        frontFace = renderable.frontFace;
                        _gl.frontFace(frontFace);
                    }
                    if (renderable.culling !== culling) {
                        culling = renderable.culling;
                        culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE);
                    }
                    var semanticInfo = preZPassShader.matrixSemantics.WORLDVIEWPROJECTION;
                    preZPassShader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrices.WORLDVIEWPROJECTION);
                    renderable.render(_gl, preZPassMaterial);
                    culledRenderQueue.push(renderable);
                }
                _gl.depthFunc(_gl.LEQUAL);
                _gl.colorMask(true, true, true, true);
                _gl.depthMask(false);
            } else {
                culledRenderQueue = queue;
            }
            for (var i = 0; i < culledRenderQueue.length; i++) {
                var renderable = culledRenderQueue[i];
                var material = globalMaterial || renderable.material;
                var shader = material.shader;
                var geometry = renderable.geometry;
                var worldM = renderable.worldTransform._array;
                mat4.copy(matrices.WORLD, worldM);
                mat4.multiply(matrices.WORLDVIEW, matrices.VIEW, worldM);
                mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION, worldM);
                if (shader.matrixSemantics.WORLDINVERSE || shader.matrixSemantics.WORLDINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDINVERSE, worldM);
                }
                if (shader.matrixSemantics.WORLDVIEWINVERSE || shader.matrixSemantics.WORLDVIEWINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDVIEWINVERSE, matrices.WORLDVIEW);
                }
                if (shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSE || shader.matrixSemantics.WORLDVIEWPROJECTIONINVERSETRANSPOSE) {
                    mat4.invert(matrices.WORLDVIEWPROJECTIONINVERSE, matrices.WORLDVIEWPROJECTION);
                }
                if (geometry.boundingBox && !preZ) {
                    if (!this._frustumCulling(renderable, camera)) {
                        continue;
                    }
                }
                if (prevShader !== shader) {
                    if (scene && scene.isShaderLightNumberChanged(shader)) {
                        scene.setShaderLightNumber(shader);
                    }
                    var errMsg = shader.bind(_gl);
                    if (errMsg) {
                        if (errorShader[shader.__GUID__]) {
                            continue;
                        }
                        errorShader[shader.__GUID__] = true;
                        if (this.throwError) {
                            throw new Error(errMsg);
                        } else {
                            this.trigger('error', errMsg);
                        }
                    }
                    if (scene) {
                        scene.setLightUniforms(shader, _gl);
                    }
                    prevShader = shader;
                }
                if (prevMaterial !== material) {
                    if (!preZ) {
                        if (material.depthTest !== depthTest) {
                            material.depthTest ? _gl.enable(_gl.DEPTH_TEST) : _gl.disable(_gl.DEPTH_TEST);
                            depthTest = material.depthTest;
                        }
                        if (material.depthMask !== depthMask) {
                            _gl.depthMask(material.depthMask);
                            depthMask = material.depthMask;
                        }
                    }
                    material.bind(_gl, prevMaterial);
                    prevMaterial = material;
                    if (material.transparent) {
                        if (material.blend) {
                            material.blend(_gl);
                        } else {
                            _gl.blendEquationSeparate(_gl.FUNC_ADD, _gl.FUNC_ADD);
                            _gl.blendFuncSeparate(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA, _gl.ONE, _gl.ONE_MINUS_SRC_ALPHA);
                        }
                    }
                }
                var matrixSemanticKeys = shader.matrixSemanticKeys;
                for (var k = 0; k < matrixSemanticKeys.length; k++) {
                    var semantic = matrixSemanticKeys[k];
                    var semanticInfo = shader.matrixSemantics[semantic];
                    var matrix = matrices[semantic];
                    if (semanticInfo.isTranspose) {
                        var matrixNoTranspose = matrices[semanticInfo.semanticNoTranspose];
                        mat4.transpose(matrix, matrixNoTranspose);
                    }
                    shader.setUniform(_gl, semanticInfo.type, semanticInfo.symbol, matrix);
                }
                if (renderable.cullFace !== cullFace) {
                    cullFace = renderable.cullFace;
                    _gl.cullFace(cullFace);
                }
                if (renderable.frontFace !== frontFace) {
                    frontFace = renderable.frontFace;
                    _gl.frontFace(frontFace);
                }
                if (renderable.culling !== culling) {
                    culling = renderable.culling;
                    culling ? _gl.enable(_gl.CULL_FACE) : _gl.disable(_gl.CULL_FACE);
                }
                var objectRenderInfo = renderable.render(_gl, globalMaterial);
                if (objectRenderInfo) {
                    renderInfo.faceNumber += objectRenderInfo.faceNumber;
                    renderInfo.vertexNumber += objectRenderInfo.vertexNumber;
                    renderInfo.drawCallNumber += objectRenderInfo.drawCallNumber;
                    renderInfo.renderedMeshNumber++;
                }
            }
            return renderInfo;
        },
        _frustumCulling: function () {
            var cullingBoundingBox = new BoundingBox();
            var cullingMatrix = new Matrix4();
            return function (renderable, camera) {
                var geoBBox = renderable.geometry.boundingBox;
                cullingMatrix._array = matrices.WORLDVIEW;
                cullingBoundingBox.copy(geoBBox);
                cullingBoundingBox.applyTransform(cullingMatrix);
                if (renderable.castShadow) {
                    camera.sceneBoundingBoxLastFrame.union(cullingBoundingBox);
                }
                if (renderable.frustumCulling) {
                    if (!cullingBoundingBox.intersectBoundingBox(camera.frustum.boundingBox)) {
                        return false;
                    }
                    cullingMatrix._array = matrices.PROJECTION;
                    if (cullingBoundingBox.max._array[2] > 0 && cullingBoundingBox.min._array[2] < 0) {
                        cullingBoundingBox.max._array[2] = -1e-20;
                    }
                    cullingBoundingBox.applyProjection(cullingMatrix);
                    var min = cullingBoundingBox.min._array;
                    var max = cullingBoundingBox.max._array;
                    if (max[0] < -1 || min[0] > 1 || max[1] < -1 || min[1] > 1 || max[2] < -1 || min[2] > 1) {
                        return false;
                    }
                }
                return true;
            };
        }(),
        disposeScene: function (scene) {
            this.disposeNode(scene, true, true);
            scene.dispose();
        },
        disposeNode: function (root, disposeGeometry, disposeTexture) {
            var materials = {};
            var _gl = this.gl;
            if (root.getParent()) {
                root.getParent().remove(root);
            }
            root.traverse(function (node) {
                if (node.geometry && disposeGeometry) {
                    node.geometry.dispose(_gl);
                }
                if (node.material) {
                    materials[node.material.__GUID__] = node.material;
                }
                if (node.dispose) {
                    node.dispose(_gl);
                }
            });
            for (var guid in materials) {
                var mat = materials[guid];
                mat.dispose(_gl, disposeTexture);
            }
        },
        disposeShader: function (shader) {
            shader.dispose(this.gl);
        },
        disposeGeometry: function (geometry) {
            geometry.dispose(this.gl);
        },
        disposeTexture: function (texture) {
            texture.dispose(this.gl);
        },
        disposeFrameBuffer: function (frameBuffer) {
            frameBuffer.dispose(this.gl);
        },
        dispose: function () {
            glinfo.dispose(this.gl);
        },
        screenToNdc: function (x, y, out) {
            if (!out) {
                out = new Vector2();
            }
            y = this.height - y;
            var viewport = this.viewport;
            var dpr = this.devicePixelRatio;
            var arr = out._array;
            arr[0] = (x - viewport.x) / viewport.width;
            arr[0] = arr[0] * 2 - 1;
            arr[1] = (y - viewport.y) / viewport.height;
            arr[1] = arr[1] * 2 - 1;
            return out;
        }
    });
    Renderer.opaqueSortFunc = function (x, y) {
        if (x.material.shader === y.material.shader) {
            if (x.material === y.material) {
                return x.geometry.__GUID__ - y.geometry.__GUID__;
            }
            return x.material.__GUID__ - y.material.__GUID__;
        }
        return x.material.shader.__GUID__ - y.material.shader.__GUID__;
    };
    Renderer.transparentSortFunc = function (x, y) {
        if (x.__depth === y.__depth) {
            if (x.material.shader === y.material.shader) {
                if (x.material === y.material) {
                    return x.geometry.__GUID__ - y.geometry.__GUID__;
                }
                return x.material.__GUID__ - y.material.__GUID__;
            }
            return x.material.shader.__GUID__ - y.material.shader.__GUID__;
        }
        return x.__depth - y.__depth;
    };
    var matrices = {
        WORLD: mat4.create(),
        VIEW: mat4.create(),
        PROJECTION: mat4.create(),
        WORLDVIEW: mat4.create(),
        VIEWPROJECTION: mat4.create(),
        WORLDVIEWPROJECTION: mat4.create(),
        WORLDINVERSE: mat4.create(),
        VIEWINVERSE: mat4.create(),
        PROJECTIONINVERSE: mat4.create(),
        WORLDVIEWINVERSE: mat4.create(),
        VIEWPROJECTIONINVERSE: mat4.create(),
        WORLDVIEWPROJECTIONINVERSE: mat4.create(),
        WORLDTRANSPOSE: mat4.create(),
        VIEWTRANSPOSE: mat4.create(),
        PROJECTIONTRANSPOSE: mat4.create(),
        WORLDVIEWTRANSPOSE: mat4.create(),
        VIEWPROJECTIONTRANSPOSE: mat4.create(),
        WORLDVIEWPROJECTIONTRANSPOSE: mat4.create(),
        WORLDINVERSETRANSPOSE: mat4.create(),
        VIEWINVERSETRANSPOSE: mat4.create(),
        PROJECTIONINVERSETRANSPOSE: mat4.create(),
        WORLDVIEWINVERSETRANSPOSE: mat4.create(),
        VIEWPROJECTIONINVERSETRANSPOSE: mat4.create(),
        WORLDVIEWPROJECTIONINVERSETRANSPOSE: mat4.create()
    };
    Renderer.COLOR_BUFFER_BIT = glenum.COLOR_BUFFER_BIT;
    Renderer.DEPTH_BUFFER_BIT = glenum.DEPTH_BUFFER_BIT;
    Renderer.STENCIL_BUFFER_BIT = glenum.STENCIL_BUFFER_BIT;
    return Renderer;
});define('qtek/Scene', [
    'require',
    './Node',
    './Light'
], function (require) {
    'use strict';
    var Node = require('./Node');
    var Light = require('./Light');
    var Scene = Node.derive(function () {
        return {
            material: null,
            autoUpdate: true,
            opaqueQueue: [],
            transparentQueue: [],
            lights: [],
            _lightUniforms: {},
            _lightNumber: {
                'POINT_LIGHT': 0,
                'DIRECTIONAL_LIGHT': 0,
                'SPOT_LIGHT': 0,
                'AMBIENT_LIGHT': 0
            },
            _opaqueObjectCount: 0,
            _transparentObjectCount: 0,
            _nodeRepository: {}
        };
    }, function () {
        this._scene = this;
    }, {
        addToScene: function (node) {
            if (node.name) {
                this._nodeRepository[node.name] = node;
            }
        },
        removeFromScene: function (node) {
            if (node.name) {
                delete this._nodeRepository[node.name];
            }
        },
        getNode: function (name) {
            return this._nodeRepository[name];
        },
        cloneNode: function (node) {
            var newNode = node.clone();
            var materialsMap = {};
            var cloneSkeleton = function (current, currentNew) {
                if (current.skeleton) {
                    currentNew.skeleton = current.skeleton.clone(node, newNode);
                    currentNew.joints = current.joints.slice();
                }
                if (current.material) {
                    materialsMap[current.material.__GUID__] = { oldMat: current.material };
                }
                for (var i = 0; i < current._children.length; i++) {
                    cloneSkeleton(current._children[i], currentNew._children[i]);
                }
            };
            cloneSkeleton(node, newNode);
            for (var guid in materialsMap) {
                materialsMap[guid].newMat = materialsMap[guid].oldMat.clone();
            }
            newNode.traverse(function (current) {
                if (current.material) {
                    current.material = materialsMap[current.material.__GUID__].newMat;
                }
            });
            return newNode;
        },
        update: function (force) {
            if (!(this.autoUpdate || force)) {
                return;
            }
            Node.prototype.update.call(this, force);
            var lights = this.lights;
            var sceneMaterialTransparent = this.material && this.material.transparent;
            this._opaqueObjectCount = 0;
            this._transparentObjectCount = 0;
            lights.length = 0;
            this._updateRenderQueue(this, sceneMaterialTransparent);
            this.opaqueQueue.length = this._opaqueObjectCount;
            this.transparentQueue.length = this._transparentObjectCount;
            for (var type in this._lightNumber) {
                this._lightNumber[type] = 0;
            }
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                this._lightNumber[light.type]++;
            }
            this._updateLightUniforms();
        },
        _updateRenderQueue: function (parent, sceneMaterialTransparent) {
            if (!parent.visible) {
                return;
            }
            for (var i = 0; i < parent._children.length; i++) {
                var child = parent._children[i];
                if (child instanceof Light) {
                    this.lights.push(child);
                }
                if (child.isRenderable()) {
                    if (child.material.transparent || sceneMaterialTransparent) {
                        this.transparentQueue[this._transparentObjectCount++] = child;
                    } else {
                        this.opaqueQueue[this._opaqueObjectCount++] = child;
                    }
                }
                if (child._children.length > 0) {
                    this._updateRenderQueue(child);
                }
            }
        },
        _updateLightUniforms: function () {
            var lights = this.lights;
            lights.sort(lightSortFunc);
            var lightUniforms = this._lightUniforms;
            for (var symbol in lightUniforms) {
                lightUniforms[symbol].value.length = 0;
            }
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                for (symbol in light.uniformTemplates) {
                    var uniformTpl = light.uniformTemplates[symbol];
                    if (!lightUniforms[symbol]) {
                        lightUniforms[symbol] = {
                            type: '',
                            value: []
                        };
                    }
                    var value = uniformTpl.value(light);
                    var lu = lightUniforms[symbol];
                    lu.type = uniformTpl.type + 'v';
                    switch (uniformTpl.type) {
                    case '1i':
                    case '1f':
                        lu.value.push(value);
                        break;
                    case '2f':
                    case '3f':
                    case '4f':
                        for (var j = 0; j < value.length; j++) {
                            lu.value.push(value[j]);
                        }
                        break;
                    default:
                        console.error('Unkown light uniform type ' + uniformTpl.type);
                    }
                }
            }
        },
        isShaderLightNumberChanged: function (shader) {
            return shader.lightNumber.POINT_LIGHT !== this._lightNumber.POINT_LIGHT || shader.lightNumber.DIRECTIONAL_LIGHT !== this._lightNumber.DIRECTIONAL_LIGHT || shader.lightNumber.SPOT_LIGHT !== this._lightNumber.SPOT_LIGHT || shader.lightNumber.AMBIENT_LIGHT !== this._lightNumber.AMBIENT_LIGHT;
        },
        setShaderLightNumber: function (shader) {
            for (var type in this._lightNumber) {
                shader.lightNumber[type] = this._lightNumber[type];
            }
            shader.dirty();
        },
        setLightUniforms: function (shader, _gl) {
            for (var symbol in this._lightUniforms) {
                var lu = this._lightUniforms[symbol];
                shader.setUniform(_gl, lu.type, symbol, lu.value);
            }
        },
        dispose: function () {
            this.material = null;
            this.opaqueQueue = [];
            this.transparentQueue = [];
            this.lights = [];
            this._lightUniforms = {};
            this._lightNumber = {};
            this._nodeRepository = {};
        }
    });
    function lightSortFunc(a, b) {
        if (b.castShadow && !a.castShadow) {
            return true;
        }
    }
    return Scene;
});define('qtek/camera/Perspective', [
    'require',
    '../Camera'
], function (require) {
    'use strict';
    var Camera = require('../Camera');
    var Perspective = Camera.derive({
        fov: 50,
        aspect: 1,
        near: 0.1,
        far: 2000
    }, {
        updateProjectionMatrix: function () {
            var rad = this.fov / 180 * Math.PI;
            this.projectionMatrix.perspective(rad, this.aspect, this.near, this.far);
        },
        clone: function () {
            var camera = Camera.prototype.clone.call(this);
            camera.fov = this.fov;
            camera.aspect = this.aspect;
            camera.near = this.near;
            camera.far = this.far;
            return camera;
        }
    });
    return Perspective;
});define('qtek/camera/Orthographic', [
    'require',
    '../Camera'
], function (require) {
    'use strict';
    var Camera = require('../Camera');
    var Orthographic = Camera.derive({
        left: -1,
        right: 1,
        near: -1,
        far: 1,
        top: 1,
        bottom: -1
    }, {
        updateProjectionMatrix: function () {
            this.projectionMatrix.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far);
        },
        clone: function () {
            var camera = Camera.prototype.clone.call(this);
            camera.left = this.left;
            camera.right = this.right;
            camera.near = this.near;
            camera.far = this.far;
            camera.top = this.top;
            camera.bottom = this.bottom;
            return camera;
        }
    });
    return Orthographic;
});define('qtek/picking/RayPicking', [
    'require',
    '../core/Base',
    '../math/Ray',
    '../math/Vector2',
    '../math/Vector3',
    '../math/Matrix4',
    '../Renderable',
    '../StaticGeometry',
    '../core/glenum'
], function (require) {
    var Base = require('../core/Base');
    var Ray = require('../math/Ray');
    var Vector2 = require('../math/Vector2');
    var Vector3 = require('../math/Vector3');
    var Matrix4 = require('../math/Matrix4');
    var Renderable = require('../Renderable');
    var StaticGeometry = require('../StaticGeometry');
    var glenum = require('../core/glenum');
    var RayPicking = Base.derive({
        scene: null,
        camera: null,
        renderer: null
    }, function () {
        this._ray = new Ray();
        this._ndc = new Vector2();
    }, {
        pick: function (x, y) {
            var out = this.pickAll(x, y);
            return out[0] || null;
        },
        pickAll: function (x, y) {
            this.renderer.screenToNdc(x, y, this._ndc);
            this.camera.castRay(this._ndc, this._ray);
            var output = [];
            this._intersectNode(this.scene, output);
            output.sort(this._intersectionCompareFunc);
            return output;
        },
        _intersectNode: function (node, out) {
            if (node instanceof Renderable && node.isRenderable()) {
                if (!node.ignorePicking && node.geometry.isUseFace()) {
                    this._intersectRenderable(node, out);
                }
            }
            for (var i = 0; i < node._children.length; i++) {
                this._intersectNode(node._children[i], out);
            }
        },
        _intersectRenderable: function () {
            var v1 = new Vector3();
            var v2 = new Vector3();
            var v3 = new Vector3();
            var ray = new Ray();
            var worldInverse = new Matrix4();
            return function (renderable, out) {
                ray.copy(this._ray);
                Matrix4.invert(worldInverse, renderable.worldTransform);
                ray.applyTransform(worldInverse);
                var geometry = renderable.geometry;
                if (geometry.boundingBox) {
                    if (!ray.intersectBoundingBox(geometry.boundingBox)) {
                        return false;
                    }
                }
                var isStatic = geometry instanceof StaticGeometry;
                var cullBack = renderable.cullFace === glenum.BACK && renderable.frontFace === glenum.CCW || renderable.cullFace === glenum.FRONT && renderable.frontFace === glenum.CW;
                var point;
                if (isStatic) {
                    var faces = geometry.faces;
                    var positions = geometry.attributes.position.value;
                    for (var i = 0; i < faces.length;) {
                        var i1 = faces[i++] * 3;
                        var i2 = faces[i++] * 3;
                        var i3 = faces[i++] * 3;
                        v1._array[0] = positions[i1];
                        v1._array[1] = positions[i1 + 1];
                        v1._array[2] = positions[i1 + 2];
                        v2._array[0] = positions[i2];
                        v2._array[1] = positions[i2 + 1];
                        v2._array[2] = positions[i2 + 2];
                        v3._array[0] = positions[i3];
                        v3._array[1] = positions[i3 + 1];
                        v3._array[2] = positions[i3 + 2];
                        if (cullBack) {
                            point = ray.intersectTriangle(v1, v2, v3, renderable.culling);
                        } else {
                            point = ray.intersectTriangle(v1, v3, v2, renderable.culling);
                        }
                        if (point) {
                            var pointW = new Vector3();
                            Vector3.transformMat4(pointW, point, renderable.worldTransform);
                            out.push(new RayPicking.Intersection(point, pointW, renderable, [
                                i1,
                                i2,
                                i3
                            ], Vector3.dist(pointW, this._ray.origin)));
                        }
                    }
                } else {
                    var faces = geometry.faces;
                    var positions = geometry.attributes.position.value;
                    for (var i = 0; i < faces.length; i++) {
                        var face = faces[i];
                        var i1 = face[0];
                        var i2 = face[1];
                        var i3 = face[2];
                        v1.setArray(positions[i1]);
                        v2.setArray(positions[i2]);
                        v3.setArray(positions[i3]);
                        if (cullBack) {
                            point = ray.intersectTriangle(v1, v2, v3, renderable.culling);
                        } else {
                            point = ray.intersectTriangle(v1, v3, v2, renderable.culling);
                        }
                        if (point) {
                            var pointW = new Vector3();
                            Vector3.transformMat4(pointW, point, renderable.worldTransform);
                            out.push(new RayPicking.Intersection(point, pointW, renderable, [
                                i1,
                                i2,
                                i3
                            ], Vector3.dist(pointW, this._ray.origin)));
                        }
                    }
                }
            };
        }(),
        _intersectionCompareFunc: function (a, b) {
            return a.distance - b.distance;
        }
    });
    RayPicking.Intersection = function (point, pointWorld, target, face, distance) {
        this.point = point;
        this.pointWorld = pointWorld;
        this.target = target;
        this.face = face;
        this.distance = distance;
    };
    return RayPicking;
});define('qtek/shader/library', [
    'require',
    '../Shader',
    '../core/util'
], function (require) {
    var Shader = require('../Shader');
    var util = require('../core/util');
    var _library = {};
    function ShaderLibrary() {
        this._pool = {};
    }
    ShaderLibrary.prototype.get = function (name, option) {
        var enabledTextures = [];
        var vertexDefines = {};
        var fragmentDefines = {};
        if (typeof option === 'string') {
            enabledTextures = Array.prototype.slice.call(arguments, 1);
        } else if (Object.prototype.toString.call(option) == '[object Object]') {
            enabledTextures = option.textures || [];
            vertexDefines = option.vertexDefines || {};
            fragmentDefines = option.fragmentDefines || {};
        } else if (option instanceof Array) {
            enabledTextures = option;
        }
        var vertexDefineKeys = Object.keys(vertexDefines);
        var fragmentDefineKeys = Object.keys(fragmentDefines);
        enabledTextures.sort();
        vertexDefineKeys.sort();
        fragmentDefineKeys.sort();
        var keyArr = [name];
        keyArr = keyArr.concat(enabledTextures);
        for (var i = 0; i < vertexDefineKeys.length; i++) {
            keyArr.push(vertexDefines[vertexDefineKeys[i]]);
        }
        for (var i = 0; i < fragmentDefineKeys.length; i++) {
            keyArr.push(fragmentDefines[fragmentDefineKeys[i]]);
        }
        var key = keyArr.join('_');
        if (this._pool[key]) {
            return this._pool[key];
        } else {
            var source = _library[name];
            if (!source) {
                console.error('Shader "' + name + '"' + ' is not in the library');
                return;
            }
            var shader = new Shader({
                'vertex': source.vertex,
                'fragment': source.fragment
            });
            for (var i = 0; i < enabledTextures.length; i++) {
                shader.enableTexture(enabledTextures[i]);
            }
            for (var name in vertexDefines) {
                shader.define('vertex', name, vertexDefines[name]);
            }
            for (var name in fragmentDefines) {
                shader.define('fragment', name, fragmentDefines[name]);
            }
            this._pool[key] = shader;
            return shader;
        }
    };
    ShaderLibrary.prototype.clear = function () {
        this._pool = {};
    };
    function template(name, vertex, fragment) {
        _library[name] = {
            vertex: vertex,
            fragment: fragment
        };
    }
    var defaultLibrary = new ShaderLibrary();
    return {
        createLibrary: function () {
            return new ShaderLibrary();
        },
        get: function () {
            return defaultLibrary.get.apply(defaultLibrary, arguments);
        },
        template: template,
        clear: function () {
            return defaultLibrary.clear();
        }
    };
});define('qtek/math/Vector2', [
    'require',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var glMatrix = require('../dep/glmatrix');
    var vec2 = glMatrix.vec2;
    var Vector2 = function (x, y) {
        x = x || 0;
        y = y || 0;
        this._array = vec2.fromValues(x, y);
        this._dirty = true;
    };
    Vector2.prototype = {
        constructor: Vector2,
        add: function (b) {
            vec2.add(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        set: function (x, y) {
            this._array[0] = x;
            this._array[1] = y;
            this._dirty = true;
            return this;
        },
        setArray: function (arr) {
            this._array[0] = arr[0];
            this._array[1] = arr[1];
            this._dirty = true;
            return this;
        },
        clone: function () {
            return new Vector2(this.x, this.y);
        },
        copy: function (b) {
            vec2.copy(this._array, b._array);
            this._dirty = true;
            return this;
        },
        cross: function (out, b) {
            vec2.cross(out._array, this._array, b._array);
            out._dirty = true;
            return this;
        },
        dist: function (b) {
            return vec2.dist(this._array, b._array);
        },
        distance: function (b) {
            return vec2.distance(this._array, b._array);
        },
        div: function (b) {
            vec2.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        divide: function (b) {
            vec2.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        dot: function (b) {
            return vec2.dot(this._array, b._array);
        },
        len: function () {
            return vec2.len(this._array);
        },
        length: function () {
            return vec2.length(this._array);
        },
        lerp: function (a, b, t) {
            vec2.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },
        min: function (b) {
            vec2.min(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        max: function (b) {
            vec2.max(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        mul: function (b) {
            vec2.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        multiply: function (b) {
            vec2.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        negate: function () {
            vec2.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },
        normalize: function () {
            vec2.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },
        random: function (scale) {
            vec2.random(this._array, scale);
            this._dirty = true;
            return this;
        },
        scale: function (s) {
            vec2.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        scaleAndAdd: function (b, s) {
            vec2.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },
        sqrDist: function (b) {
            return vec2.sqrDist(this._array, b._array);
        },
        squaredDistance: function (b) {
            return vec2.squaredDistance(this._array, b._array);
        },
        sqrLen: function () {
            return vec2.sqrLen(this._array);
        },
        squaredLength: function () {
            return vec2.squaredLength(this._array);
        },
        sub: function (b) {
            vec2.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        subtract: function (b) {
            vec2.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },
        transformMat2: function (m) {
            vec2.transformMat2(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat2d: function (m) {
            vec2.transformMat2d(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat3: function (m) {
            vec2.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        transformMat4: function (m) {
            vec2.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },
        toString: function () {
            return '[' + Array.prototype.join.call(this._array, ',') + ']';
        }
    };
    if (Object.defineProperty) {
        var proto = Vector2.prototype;
        Object.defineProperty(proto, 'x', {
            get: function () {
                return this._array[0];
            },
            set: function (value) {
                this._array[0] = value;
                this._dirty = true;
            }
        });
        Object.defineProperty(proto, 'y', {
            get: function () {
                return this._array[1];
            },
            set: function (value) {
                this._array[1] = value;
                this._dirty = true;
            }
        });
    }
    Vector2.add = function (out, a, b) {
        vec2.add(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.set = function (out, x, y) {
        vec2.set(out._array, x, y);
        out._dirty = true;
        return out;
    };
    Vector2.copy = function (out, b) {
        vec2.copy(out._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.cross = function (out, a, b) {
        vec2.cross(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.dist = function (a, b) {
        return vec2.distance(a._array, b._array);
    };
    Vector2.distance = Vector2.dist;
    Vector2.div = function (out, a, b) {
        vec2.divide(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.divide = Vector2.div;
    Vector2.dot = function (a, b) {
        return vec2.dot(a._array, b._array);
    };
    Vector2.len = function (b) {
        return vec2.length(b._array);
    };
    Vector2.lerp = function (out, a, b, t) {
        vec2.lerp(out._array, a._array, b._array, t);
        out._dirty = true;
        return out;
    };
    Vector2.min = function (out, a, b) {
        vec2.min(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.max = function (out, a, b) {
        vec2.max(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.mul = function (out, a, b) {
        vec2.multiply(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.multiply = Vector2.mul;
    Vector2.negate = function (out, a) {
        vec2.negate(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Vector2.normalize = function (out, a) {
        vec2.normalize(out._array, a._array);
        out._dirty = true;
        return out;
    };
    Vector2.random = function (out, scale) {
        vec2.random(out._array, scale);
        out._dirty = true;
        return out;
    };
    Vector2.scale = function (out, a, scale) {
        vec2.scale(out._array, a._array, scale);
        out._dirty = true;
        return out;
    };
    Vector2.scaleAndAdd = function (out, a, b, scale) {
        vec2.scaleAndAdd(out._array, a._array, b._array, scale);
        out._dirty = true;
        return out;
    };
    Vector2.sqrDist = function (a, b) {
        return vec2.sqrDist(a._array, b._array);
    };
    Vector2.squaredDistance = Vector2.sqrDist;
    Vector2.sqrLen = function (a) {
        return vec2.sqrLen(a._array);
    };
    Vector2.squaredLength = Vector2.sqrLen;
    Vector2.sub = function (out, a, b) {
        vec2.subtract(out._array, a._array, b._array);
        out._dirty = true;
        return out;
    };
    Vector2.subtract = Vector2.sub;
    Vector2.transformMat2 = function (out, a, m) {
        vec2.transformMat2(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector2.transformMat2d = function (out, a, m) {
        vec2.transformMat2d(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector2.transformMat3 = function (out, a, m) {
        vec2.transformMat3(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    Vector2.transformMat4 = function (out, a, m) {
        vec2.transformMat4(out._array, a._array, m._array);
        out._dirty = true;
        return out;
    };
    return Vector2;
});define('qtek/Light', [
    'require',
    './Node',
    './Shader',
    './light/light.essl'
], function (require) {
    'use strict';
    var Node = require('./Node');
    var Shader = require('./Shader');
    var Light = Node.derive(function () {
        return {
            color: [
                1,
                1,
                1
            ],
            intensity: 1,
            castShadow: true,
            shadowResolution: 512
        };
    }, {
        type: '',
        clone: function () {
            var light = Node.prototype.clone.call(this);
            light.color = Array.prototype.slice.call(this.color);
            light.intensity = this.intensity;
            light.castShadow = this.castShadow;
            light.shadowResolution = this.shadowResolution;
            return light;
        }
    });
    Shader['import'](require('./light/light.essl'));
    return Light;
});;
define('qtek/light/light.essl', function() { return '@export buildin.header.directional_light\nuniform vec3 directionalLightDirection[ DIRECTIONAL_LIGHT_NUMBER ] : unconfigurable;\nuniform vec3 directionalLightColor[ DIRECTIONAL_LIGHT_NUMBER ] : unconfigurable;\n@end\n\n@export buildin.header.ambient_light\nuniform vec3 ambientLightColor[ AMBIENT_LIGHT_NUMBER ] : unconfigurable;\n@end\n\n@export buildin.header.point_light\nuniform vec3 pointLightPosition[ POINT_LIGHT_NUMBER ] : unconfigurable;\nuniform float pointLightRange[ POINT_LIGHT_NUMBER ] : unconfigurable;\nuniform vec3 pointLightColor[ POINT_LIGHT_NUMBER ] : unconfigurable;\n@end\n\n@export buildin.header.spot_light\nuniform vec3 spotLightPosition[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform vec3 spotLightDirection[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightRange[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightUmbraAngleCosine[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightPenumbraAngleCosine[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform float spotLightFalloffFactor[SPOT_LIGHT_NUMBER] : unconfigurable;\nuniform vec3 spotLightColor[SPOT_LIGHT_NUMBER] : unconfigurable;\n@end'});
define('qtek/Camera', [
    'require',
    './Node',
    './math/Matrix4',
    './math/Frustum',
    './math/BoundingBox',
    './math/Ray',
    './dep/glmatrix'
], function (require) {
    'use strict';
    var Node = require('./Node');
    var Matrix4 = require('./math/Matrix4');
    var Frustum = require('./math/Frustum');
    var BoundingBox = require('./math/BoundingBox');
    var Ray = require('./math/Ray');
    var glMatrix = require('./dep/glmatrix');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var vec4 = glMatrix.vec4;
    var Camera = Node.derive(function () {
        return {
            projectionMatrix: new Matrix4(),
            invProjectionMatrix: new Matrix4(),
            viewMatrix: new Matrix4(),
            frustum: new Frustum(),
            sceneBoundingBoxLastFrame: new BoundingBox()
        };
    }, function () {
        this.update(true);
    }, {
        update: function (force) {
            Node.prototype.update.call(this, force);
            mat4.invert(this.viewMatrix._array, this.worldTransform._array);
            this.updateProjectionMatrix();
            mat4.invert(this.invProjectionMatrix._array, this.projectionMatrix._array);
            this.frustum.setFromProjection(this.projectionMatrix);
        },
        updateProjectionMatrix: function () {
        },
        castRay: function () {
            var v4 = vec4.create();
            return function (ndc, out) {
                var ray = out !== undefined ? out : new Ray();
                var x = ndc._array[0];
                var y = ndc._array[1];
                vec4.set(v4, x, y, -1, 1);
                vec4.transformMat4(v4, v4, this.invProjectionMatrix._array);
                vec4.transformMat4(v4, v4, this.worldTransform._array);
                vec3.scale(ray.origin._array, v4, 1 / v4[3]);
                vec4.set(v4, x, y, 1, 1);
                vec4.transformMat4(v4, v4, this.invProjectionMatrix._array);
                vec4.transformMat4(v4, v4, this.worldTransform._array);
                vec3.scale(v4, v4, 1 / v4[3]);
                vec3.sub(ray.direction._array, v4, ray.origin._array);
                vec3.normalize(ray.direction._array, ray.direction._array);
                ray.direction._dirty = true;
                ray.origin._dirty = true;
                return ray;
            };
        }()
    });
    return Camera;
});define('qtek/math/Frustum', [
    'require',
    './Vector3',
    './BoundingBox',
    './Plane',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var Vector3 = require('./Vector3');
    var BoundingBox = require('./BoundingBox');
    var Plane = require('./Plane');
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var Frustum = function () {
        this.planes = [];
        for (var i = 0; i < 6; i++) {
            this.planes.push(new Plane());
        }
        this.boundingBox = new BoundingBox();
        this.vertices = [];
        for (var i = 0; i < 8; i++) {
            this.vertices[i] = vec3.fromValues(0, 0, 0);
        }
    };
    Frustum.prototype = {
        setFromProjection: function (projectionMatrix) {
            var planes = this.planes;
            var m = projectionMatrix._array;
            var m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
            var m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
            var m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
            var m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];
            vec3.set(planes[0].normal._array, m3 - m0, m7 - m4, m11 - m8);
            planes[0].distance = -(m15 - m12);
            planes[0].normalize();
            vec3.set(planes[1].normal._array, m3 + m0, m7 + m4, m11 + m8);
            planes[1].distance = -(m15 + m12);
            planes[1].normalize();
            vec3.set(planes[2].normal._array, m3 + m1, m7 + m5, m11 + m9);
            planes[2].distance = -(m15 + m13);
            planes[2].normalize();
            vec3.set(planes[3].normal._array, m3 - m1, m7 - m5, m11 - m9);
            planes[3].distance = -(m15 - m13);
            planes[3].normalize();
            vec3.set(planes[4].normal._array, m3 - m2, m7 - m6, m11 - m10);
            planes[4].distance = -(m15 - m14);
            planes[4].normalize();
            vec3.set(planes[5].normal._array, m3 + m2, m7 + m6, m11 + m10);
            planes[5].distance = -(m15 + m14);
            planes[5].normalize();
            if (m15 === 0) {
                var aspect = m5 / m0;
                var zNear = -m14 / (m10 - 1);
                var zFar = -m14 / (m10 + 1);
                var farY = -zFar / m5;
                var nearY = -zNear / m5;
                this.boundingBox.min.set(-farY * aspect, -farY, zFar);
                this.boundingBox.max.set(farY * aspect, farY, zNear);
                var vertices = this.vertices;
                vec3.set(vertices[0], -farY * aspect, -farY, zFar);
                vec3.set(vertices[1], -farY * aspect, farY, zFar);
                vec3.set(vertices[2], farY * aspect, -farY, zFar);
                vec3.set(vertices[3], farY * aspect, farY, zFar);
                vec3.set(vertices[4], -nearY * aspect, -nearY, zNear);
                vec3.set(vertices[5], -nearY * aspect, nearY, zNear);
                vec3.set(vertices[6], nearY * aspect, -nearY, zNear);
                vec3.set(vertices[7], nearY * aspect, nearY, zNear);
            } else {
                var left = (-1 - m12) / m0;
                var right = (1 - m12) / m0;
                var top = (1 - m13) / m5;
                var bottom = (-1 - m13) / m5;
                var near = (-1 - m14) / m10;
                var far = (1 - m14) / m10;
                this.boundingBox.min.set(left, bottom, far);
                this.boundingBox.max.set(right, top, near);
                for (var i = 0; i < 8; i++) {
                    vec3.copy(this.vertices[i], this.boundingBox.vertices[i]);
                }
            }
        },
        getTransformedBoundingBox: function () {
            var tmpVec3 = vec3.create();
            return function (bbox, matrix) {
                var vertices = this.vertices;
                var m4 = matrix._array;
                var _min = bbox.min._array;
                var _max = bbox.max._array;
                var v = vertices[0];
                vec3.transformMat4(tmpVec3, v, m4);
                vec3.copy(_min, tmpVec3);
                vec3.copy(_max, tmpVec3);
                for (var i = 1; i < 8; i++) {
                    v = vertices[i];
                    vec3.transformMat4(tmpVec3, v, m4);
                    _min[0] = Math.min(tmpVec3[0], _min[0]);
                    _min[1] = Math.min(tmpVec3[1], _min[1]);
                    _min[2] = Math.min(tmpVec3[2], _min[2]);
                    _max[0] = Math.max(tmpVec3[0], _max[0]);
                    _max[1] = Math.max(tmpVec3[1], _max[1]);
                    _max[2] = Math.max(tmpVec3[2], _max[2]);
                }
                bbox.min._dirty = true;
                bbox.max._dirty = true;
                return bbox;
            };
        }()
    };
    return Frustum;
});define('qtek/math/Ray', [
    'require',
    './Vector3',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var Vector3 = require('./Vector3');
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var EPSILON = 0.00001;
    var Ray = function (origin, direction) {
        this.origin = origin || new Vector3();
        this.direction = direction || new Vector3();
    };
    Ray.prototype = {
        constructor: Ray,
        intersectPlane: function (plane, out) {
            var pn = plane.normal._array;
            var d = plane.distance;
            var ro = this.origin._array;
            var rd = this.direction._array;
            var divider = vec3.dot(pn, rd);
            if (divider === 0) {
                return null;
            }
            if (!out) {
                out = new Vector3();
            }
            var t = (vec3.dot(pn, ro) - d) / divider;
            vec3.scaleAndAdd(out._array, ro, rd, -t);
            out._dirty = true;
            return out;
        },
        mirrorAgainstPlane: function (plane) {
            var d = vec3.dot(plane.normal._array, this.direction._array);
            vec3.scaleAndAdd(this.direction._array, this.direction._array, plane.normal._array, -d * 2);
            this.direction._dirty = true;
        },
        distanceToPoint: function () {
            var v = vec3.create();
            return function (point) {
                vec3.sub(v, point, this.origin._array);
                var b = vec3.dot(v, this.direction._array);
                if (b < 0) {
                    return vec3.distance(this.origin._array, point);
                }
                var c2 = vec3.lenSquared(v);
                return Math.sqrt(c2 - b * b);
            };
        }(),
        intersectSphere: function () {
            var v = vec3.create();
            return function (center, radius, out) {
                var origin = this.origin._array;
                var direction = this.direction._array;
                vec3.sub(v, center, origin);
                var b = vec3.dot(v, direction);
                var c2 = vec3.lenSquared(v);
                var d2 = c2 - b * b;
                var r2 = radius * radius;
                if (d2 > r2) {
                    return;
                }
                var a = Math.sqrt(r2 - d2);
                var t0 = b - a;
                var t1 = b + a;
                if (!out) {
                    out = new Vector3();
                }
                if (t0 < 0) {
                    if (t1 < 0) {
                        return null;
                    } else {
                        vec3.scaleAndAdd(out._array, origin, direction, t1);
                        return out;
                    }
                } else {
                    vec3.scaleAndAdd(out._array, origin, direction, t0);
                    return out;
                }
            };
        }(),
        intersectBoundingBox: function (bbox, out) {
            var dir = this.direction._array;
            var origin = this.origin._array;
            var min = bbox.min._array;
            var max = bbox.max._array;
            var invdirx = 1 / dir[0];
            var invdiry = 1 / dir[1];
            var invdirz = 1 / dir[2];
            var tmin, tmax, tymin, tymax, tzmin, tzmax;
            if (invdirx >= 0) {
                tmin = (min[0] - origin[0]) * invdirx;
                tmax = (max[0] - origin[0]) * invdirx;
            } else {
                tmax = (min[0] - origin[0]) * invdirx;
                tmin = (max[0] - origin[0]) * invdirx;
            }
            if (invdiry >= 0) {
                tymin = (min[1] - origin[1]) * invdiry;
                tymax = (max[1] - origin[1]) * invdiry;
            } else {
                tymax = (min[1] - origin[1]) * invdiry;
                tymin = (max[1] - origin[1]) * invdiry;
            }
            if (tmin > tymax || tymin > tmax) {
                return null;
            }
            if (tymin > tmin || tmin !== tmin) {
                tmin = tymin;
            }
            if (tymax < tmax || tmax !== tmax) {
                tmax = tymax;
            }
            if (invdirz >= 0) {
                tzmin = (min[2] - origin[2]) * invdirz;
                tzmax = (max[2] - origin[2]) * invdirz;
            } else {
                tzmax = (min[2] - origin[2]) * invdirz;
                tzmin = (max[2] - origin[2]) * invdirz;
            }
            if (tmin > tzmax || tzmin > tmax) {
                return null;
            }
            if (tzmin > tmin || tmin !== tmin) {
                tmin = tzmin;
            }
            if (tzmax < tmax || tmax !== tmax) {
                tmax = tzmax;
            }
            if (tmax < 0) {
                return null;
            }
            var t = tmin >= 0 ? tmin : tmax;
            if (!out) {
                out = new Vector3();
            }
            vec3.scaleAndAdd(out._array, origin, dir, t);
            return out;
        },
        intersectTriangle: function () {
            var eBA = vec3.create();
            var eCA = vec3.create();
            var AO = vec3.create();
            var vCross = vec3.create();
            return function (a, b, c, singleSided, out, barycenteric) {
                var dir = this.direction._array;
                var origin = this.origin._array;
                a = a._array;
                b = b._array;
                c = c._array;
                vec3.sub(eBA, b, a);
                vec3.sub(eCA, c, a);
                vec3.cross(vCross, eCA, dir);
                var det = vec3.dot(eBA, vCross);
                if (singleSided) {
                    if (det > -EPSILON) {
                        return null;
                    }
                } else {
                    if (det > -EPSILON && det < EPSILON) {
                        return null;
                    }
                }
                vec3.sub(AO, origin, a);
                var u = vec3.dot(vCross, AO) / det;
                if (u < 0 || u > 1) {
                    return null;
                }
                vec3.cross(vCross, eBA, AO);
                var v = vec3.dot(dir, vCross) / det;
                if (v < 0 || v > 1 || u + v > 1) {
                    return null;
                }
                vec3.cross(vCross, eBA, eCA);
                var t = -vec3.dot(AO, vCross) / det;
                if (t < 0) {
                    return null;
                }
                if (!out) {
                    out = new Vector3();
                }
                if (barycenteric) {
                    Vector3.set(barycenteric, 1 - u - v, u, v);
                }
                vec3.scaleAndAdd(out._array, origin, dir, t);
                return out;
            };
        }(),
        applyTransform: function (matrix) {
            Vector3.add(this.direction, this.direction, this.origin);
            Vector3.transformMat4(this.origin, this.origin, matrix);
            Vector3.transformMat4(this.direction, this.direction, matrix);
            Vector3.sub(this.direction, this.direction, this.origin);
            Vector3.normalize(this.direction, this.direction);
        },
        copy: function (ray) {
            Vector3.copy(this.origin, ray.origin);
            Vector3.copy(this.direction, ray.direction);
        },
        clone: function () {
            var ray = new Ray();
            ray.copy(this);
            return ray;
        }
    };
    return Ray;
});define('qtek/math/Plane', [
    'require',
    './Vector3',
    '../dep/glmatrix'
], function (require) {
    'use strict';
    var Vector3 = require('./Vector3');
    var glMatrix = require('../dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var mat4 = glMatrix.mat4;
    var vec4 = glMatrix.vec4;
    var Plane = function (normal, distance) {
        this.normal = normal || new Vector3(0, 1, 0);
        this.distance = distance || 0;
    };
    Plane.prototype = {
        constructor: Plane,
        distanceToPoint: function (point) {
            return vec3.dot(point._array, this.normal._array) - this.distance;
        },
        projectPoint: function (point, out) {
            if (!out) {
                out = new Vector3();
            }
            var d = this.distanceToPoint(point);
            vec3.scaleAndAdd(out._array, point._array, this.normal._array, -d);
            out._dirty = true;
            return out;
        },
        normalize: function () {
            var invLen = 1 / vec3.len(this.normal._array);
            vec3.scale(this.normal._array, invLen);
            this.distance *= invLen;
        },
        intersectFrustum: function (frustum) {
            var coords = frustum.vertices;
            var normal = this.normal._array;
            var onPlane = vec3.dot(coords[0]._array, normal) > this.distance;
            for (var i = 1; i < 8; i++) {
                if (vec3.dot(coords[i]._array, normal) > this.distance != onPlane) {
                    return true;
                }
            }
        },
        intersectLine: function () {
            var rd = vec3.create();
            return function (start, end, out) {
                var d0 = this.distanceToPoint(start);
                var d1 = this.distanceToPoint(end);
                if (d0 > 0 && d1 > 0 || d0 < 0 && d1 < 0) {
                    return null;
                }
                var pn = this.normal._array;
                var d = this.distance;
                var ro = start._array;
                vec3.sub(rd, end._array, start._array);
                vec3.normalize(rd, rd);
                var divider = vec3.dot(pn, rd);
                if (divider === 0) {
                    return null;
                }
                if (!out) {
                    out = new Vector3();
                }
                var t = (vec3.dot(pn, ro) - d) / divider;
                vec3.scaleAndAdd(out._array, ro, rd, -t);
                out._dirty = true;
                return out;
            };
        }(),
        applyTransform: function () {
            var inverseTranspose = mat4.create();
            var normalv4 = vec4.create();
            var pointv4 = vec4.create();
            pointv4[3] = 1;
            return function (m4) {
                m4 = m4._array;
                vec3.scale(pointv4, this.normal._array, this.distance);
                vec4.transformMat4(pointv4, pointv4, m4);
                this.distance = vec3.dot(pointv4, this.normal._array);
                mat4.invert(inverseTranspose, m4);
                mat4.transpose(inverseTranspose, inverseTranspose);
                normalv4[3] = 0;
                vec3.copy(normalv4, this.normal._array);
                vec4.transformMat4(normalv4, normalv4, inverseTranspose);
                vec3.copy(this.normal._array, normalv4);
            };
        }(),
        copy: function (plane) {
            vec3.copy(this.normal._array, plane.normal._array);
            this.normal._dirty = true;
            this.distance = plane.distance;
        },
        clone: function () {
            var plane = new Plane();
            plane.copy(this);
            return plane;
        }
    };
    return Plane;
});define('qtek/StaticGeometry', [
    'require',
    './Geometry',
    './math/BoundingBox',
    './dep/glmatrix',
    './core/glenum'
], function (require) {
    'use strict';
    var Geometry = require('./Geometry');
    var BoundingBox = require('./math/BoundingBox');
    var glMatrix = require('./dep/glmatrix');
    var glenum = require('./core/glenum');
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var StaticGeometry = Geometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', false),
                texcoord0: new Geometry.Attribute('texcoord0', 'float', 2, 'TEXCOORD_0', false),
                texcoord1: new Geometry.Attribute('texcoord1', 'float', 2, 'TEXCOORD_1', false),
                normal: new Geometry.Attribute('normal', 'float', 3, 'NORMAL', false),
                tangent: new Geometry.Attribute('tangent', 'float', 4, 'TANGENT', false),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', false),
                weight: new Geometry.Attribute('weight', 'float', 3, 'WEIGHT', false),
                joint: new Geometry.Attribute('joint', 'float', 4, 'JOINT', false),
                barycentric: new Geometry.Attribute('barycentric', 'float', 3, null, false)
            },
            hint: glenum.STATIC_DRAW,
            faces: null,
            _normalType: 'vertex',
            _enabledAttributes: null
        };
    }, {
        dirty: function () {
            this._cache.dirtyAll();
            this._enabledAttributes = null;
        },
        getVertexNumber: function () {
            var mainAttribute = this.attributes[this.mainAttribute];
            if (!mainAttribute || !mainAttribute.value) {
                return 0;
            }
            return mainAttribute.value.length / mainAttribute.size;
        },
        getFaceNumber: function () {
            if (!this.faces) {
                return 0;
            } else {
                return this.faces.length / 3;
            }
        },
        getFace: function (idx, out) {
            if (idx < this.getFaceNumber() && idx >= 0) {
                if (!out) {
                    out = vec3.create();
                }
                out[0] = this.faces[idx * 3];
                out[1] = this.faces[idx * 3 + 1];
                out[2] = this.faces[idx * 3 + 2];
                return out;
            }
        },
        isUseFace: function () {
            return this.useFace && this.faces != null;
        },
        createAttribute: function (name, type, size, semantic) {
            var attrib = new Geometry.Attribute(name, type, size, semantic, false);
            this.attributes[name] = attrib;
            this._attributeList.push(name);
            return attrib;
        },
        removeAttribute: function (name) {
            var idx = this._attributeList.indexOf(name);
            if (idx >= 0) {
                this._attributeList.splice(idx, 1);
                delete this.attributes[name];
                return true;
            }
            return false;
        },
        getEnabledAttributes: function () {
            if (this._enabledAttributes) {
                return this._enabledAttributes;
            }
            var result = [];
            var nVertex = this.getVertexNumber();
            for (var i = 0; i < this._attributeList.length; i++) {
                var name = this._attributeList[i];
                var attrib = this.attributes[name];
                if (attrib.value) {
                    if (attrib.value.length === nVertex * attrib.size) {
                        result.push(name);
                    }
                }
            }
            this._enabledAttributes = result;
            return result;
        },
        getBufferChunks: function (_gl) {
            this._cache.use(_gl.__GLID__);
            if (this._cache.isDirty()) {
                this._updateBuffer(_gl);
                this._cache.fresh();
            }
            return this._cache.get('chunks');
        },
        _updateBuffer: function (_gl) {
            var chunks = this._cache.get('chunks');
            var firstUpdate = false;
            if (!chunks) {
                chunks = [];
                chunks[0] = {
                    attributeBuffers: [],
                    indicesBuffer: null
                };
                this._cache.put('chunks', chunks);
                firstUpdate = true;
            }
            var chunk = chunks[0];
            var attributeBuffers = chunk.attributeBuffers;
            var indicesBuffer = chunk.indicesBuffer;
            var attributeList = this.getEnabledAttributes();
            var prevSearchIdx = 0;
            var count = 0;
            for (var k = 0; k < attributeList.length; k++) {
                var name = attributeList[k];
                var attribute = this.attributes[name];
                var bufferInfo;
                if (!firstUpdate) {
                    for (var i = prevSearchIdx; i < attributeBuffers.length; i++) {
                        if (attributeBuffers[i].name === name) {
                            bufferInfo = attributeBuffers[i];
                            prevSearchIdx = i + 1;
                            break;
                        }
                    }
                    if (!bufferInfo) {
                        for (var i = prevSearchIdx - 1; i >= 0; i--) {
                            if (attributeBuffers[i].name === name) {
                                bufferInfo = attributeBuffers[i];
                                prevSearchIdx = i;
                                break;
                            }
                        }
                    }
                }
                var buffer;
                if (bufferInfo) {
                    buffer = bufferInfo.buffer;
                } else {
                    buffer = _gl.createBuffer();
                }
                _gl.bindBuffer(_gl.ARRAY_BUFFER, buffer);
                _gl.bufferData(_gl.ARRAY_BUFFER, attribute.value, this.hint);
                attributeBuffers[count++] = new Geometry.AttributeBuffer(name, attribute.type, buffer, attribute.size, attribute.semantic);
            }
            attributeBuffers.length = count;
            if (this.isUseFace()) {
                if (!indicesBuffer) {
                    indicesBuffer = new Geometry.IndicesBuffer(_gl.createBuffer());
                    chunk.indicesBuffer = indicesBuffer;
                }
                indicesBuffer.count = this.faces.length;
                _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer);
                _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, this.faces, this.hint);
            }
        },
        generateVertexNormals: function () {
            var faces = this.faces;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            if (!normals || normals.length !== positions.length) {
                normals = this.attributes.normal.value = new Float32Array(positions.length);
            } else {
                for (var i = 0; i < normals.length; i++) {
                    normals[i] = 0;
                }
            }
            var p1 = vec3.create();
            var p2 = vec3.create();
            var p3 = vec3.create();
            var v21 = vec3.create();
            var v32 = vec3.create();
            var n = vec3.create();
            for (var f = 0; f < faces.length;) {
                var i1 = faces[f++];
                var i2 = faces[f++];
                var i3 = faces[f++];
                vec3.set(p1, positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
                vec3.set(p2, positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
                vec3.set(p3, positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
                vec3.sub(v21, p1, p2);
                vec3.sub(v32, p2, p3);
                vec3.cross(n, v21, v32);
                for (var i = 0; i < 3; i++) {
                    normals[i1 * 3 + i] = normals[i1 * 3 + i] + n[i];
                    normals[i2 * 3 + i] = normals[i2 * 3 + i] + n[i];
                    normals[i3 * 3 + i] = normals[i3 * 3 + i] + n[i];
                }
            }
            for (var i = 0; i < normals.length;) {
                vec3.set(n, normals[i], normals[i + 1], normals[i + 2]);
                vec3.normalize(n, n);
                normals[i++] = n[0];
                normals[i++] = n[1];
                normals[i++] = n[2];
            }
        },
        generateFaceNormals: function () {
            if (!this.isUniqueVertex()) {
                this.generateUniqueVertex();
            }
            var faces = this.faces;
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var p1 = vec3.create();
            var p2 = vec3.create();
            var p3 = vec3.create();
            var v21 = vec3.create();
            var v32 = vec3.create();
            var n = vec3.create();
            if (!normals) {
                normals = this.attributes.position.value = new Float32Array(positions.length);
            }
            for (var f = 0; f < faces.length;) {
                var i1 = faces[f++];
                var i2 = faces[f++];
                var i3 = faces[f++];
                vec3.set(p1, positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
                vec3.set(p2, positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
                vec3.set(p3, positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
                vec3.sub(v21, p1, p2);
                vec3.sub(v32, p2, p3);
                vec3.cross(n, v21, v32);
                vec3.normalize(n, n);
                for (var i = 0; i < 3; i++) {
                    normals[i1 * 3 + i] = n[i];
                    normals[i2 * 3 + i] = n[i];
                    normals[i3 * 3 + i] = n[i];
                }
            }
        },
        generateTangents: function () {
            var nVertex = this.getVertexNumber();
            if (!this.attributes.tangent.value) {
                this.attributes.tangent.value = new Float32Array(nVertex * 4);
            }
            var texcoords = this.attributes.texcoord0.value;
            var positions = this.attributes.position.value;
            var tangents = this.attributes.tangent.value;
            var normals = this.attributes.normal.value;
            var tan1 = [];
            var tan2 = [];
            for (var i = 0; i < nVertex; i++) {
                tan1[i] = [
                    0,
                    0,
                    0
                ];
                tan2[i] = [
                    0,
                    0,
                    0
                ];
            }
            var sdir = [
                0,
                0,
                0
            ];
            var tdir = [
                0,
                0,
                0
            ];
            for (var i = 0; i < this.faces.length;) {
                var i1 = this.faces[i++], i2 = this.faces[i++], i3 = this.faces[i++], st1s = texcoords[i1 * 2], st2s = texcoords[i2 * 2], st3s = texcoords[i3 * 2], st1t = texcoords[i1 * 2 + 1], st2t = texcoords[i2 * 2 + 1], st3t = texcoords[i3 * 2 + 1], p1x = positions[i1 * 3], p2x = positions[i2 * 3], p3x = positions[i3 * 3], p1y = positions[i1 * 3 + 1], p2y = positions[i2 * 3 + 1], p3y = positions[i3 * 3 + 1], p1z = positions[i1 * 3 + 2], p2z = positions[i2 * 3 + 2], p3z = positions[i3 * 3 + 2];
                var x1 = p2x - p1x, x2 = p3x - p1x, y1 = p2y - p1y, y2 = p3y - p1y, z1 = p2z - p1z, z2 = p3z - p1z;
                var s1 = st2s - st1s, s2 = st3s - st1s, t1 = st2t - st1t, t2 = st3t - st1t;
                var r = 1 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r;
                sdir[2] = (t2 * z1 - t1 * z2) * r;
                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;
                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = vec3.create();
            var nCrossT = vec3.create();
            var n = vec3.create();
            for (var i = 0; i < nVertex; i++) {
                n[0] = normals[i * 3];
                n[1] = normals[i * 3 + 1];
                n[2] = normals[i * 3 + 2];
                var t = tan1[i];
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                vec3.cross(nCrossT, n, t);
                tangents[i * 4] = tmp[0];
                tangents[i * 4 + 1] = tmp[1];
                tangents[i * 4 + 2] = tmp[2];
                tangents[i * 4 + 3] = vec3.dot(nCrossT, tan2[i]) < 0 ? -1 : 1;
            }
        },
        isUniqueVertex: function () {
            if (this.isUseFace()) {
                return this.getVertexNumber() === this.faces.length;
            } else {
                return true;
            }
        },
        generateUniqueVertex: function () {
            var vertexUseCount = [];
            for (var i = 0, len = this.getVertexNumber(); i < len; i++) {
                vertexUseCount[i] = 0;
            }
            var cursor = this.getVertexNumber();
            var attributes = this.attributes;
            var faces = this.faces;
            var attributeNameList = this.getEnabledAttributes();
            for (var a = 0; a < attributeNameList.length; a++) {
                var name = attributeNameList[a];
                var expandedArray = new Float32Array(this.faces.length * attributes[name].size);
                var len = attributes[name].value.length;
                for (var i = 0; i < len; i++) {
                    expandedArray[i] = attributes[name].value[i];
                }
                attributes[name].value = expandedArray;
            }
            for (var i = 0; i < faces.length; i++) {
                var ii = faces[i];
                if (vertexUseCount[ii] > 0) {
                    for (var a = 0; a < attributeNameList.length; a++) {
                        var name = attributeNameList[a];
                        var array = attributes[name].value;
                        var size = attributes[name].size;
                        for (var k = 0; k < size; k++) {
                            array[cursor * size + k] = array[ii * size + k];
                        }
                    }
                    faces[i] = cursor;
                    cursor++;
                }
                vertexUseCount[ii]++;
            }
        },
        generateBarycentric: function () {
            if (!this.isUniqueVertex()) {
                this.generateUniqueVertex();
            }
            var array = this.attributes.barycentric.value;
            if (array && array.length === this.faces.length * 3) {
                return;
            }
            array = this.attributes.barycentric.value = new Float32Array(this.faces.length * 3);
            for (var i = 0; i < this.faces.length;) {
                for (var j = 0; j < 3; j++) {
                    var ii = this.faces[i++];
                    array[ii + j] = 1;
                }
            }
        },
        convertToDynamic: function (geometry) {
            for (var i = 0; i < this.faces.length; i += 3) {
                geometry.faces.push(this.face.subarray(i, i + 3));
            }
            var attributes = this.getEnabledAttributes();
            for (var name in attributes) {
                var attrib = attributes[name];
                var geoAttrib = geometry.attributes[name];
                if (!geoAttrib) {
                    geoAttrib = geometry.attributes[name] = {
                        type: attrib.type,
                        size: attrib.size,
                        value: []
                    };
                    if (attrib.semantic) {
                        geoAttrib.semantic = attrib.semantic;
                    }
                }
                for (var i = 0; i < attrib.value.length; i += attrib.size) {
                    if (attrib.size === 1) {
                        geoAttrib.value.push(attrib.array[i]);
                    } else {
                        geoAttrib.value.push(attrib.subarray(i, i + attrib.size));
                    }
                }
            }
            if (this.boundingBox) {
                geometry.boundingBox = new BoundingBox();
                geometry.boundingBox.min.copy(this.boundingBox.min);
                geometry.boundingBox.max.copy(this.boundingBox.max);
            }
            return geometry;
        },
        applyTransform: function (matrix) {
            if (this.boundingBox) {
                this.boundingBox.applyTransform(matrix);
            }
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;
            var tangents = this.attributes.tangent.value;
            matrix = matrix._array;
            var inverseTransposeMatrix = mat4.create();
            mat4.invert(inverseTransposeMatrix, matrix);
            mat4.transpose(inverseTransposeMatrix, inverseTransposeMatrix);
            vec3.forEach(positions, 3, 0, null, vec3.transformMat4, matrix);
            if (normals) {
                vec3.forEach(normals, 3, 0, null, vec3.transformMat4, inverseTransposeMatrix);
            }
            if (tangents) {
                vec3.forEach(tangents, 4, 0, null, vec3.transformMat4, inverseTransposeMatrix);
            }
        },
        dispose: function (_gl) {
            this._cache.use(_gl.__GLID__);
            var chunks = this._cache.get('chunks');
            if (chunks) {
                for (var c = 0; c < chunks.length; c++) {
                    var chunk = chunks[c];
                    for (var k = 0; k < chunk.attributeBuffers.length; k++) {
                        var attribs = chunk.attributeBuffers[k];
                        _gl.deleteBuffer(attribs.buffer);
                    }
                }
            }
            this._cache.deleteContext(_gl.__GLID__);
        }
    });
    return StaticGeometry;
});define('qtek/core/LinkedList', ['require'], function (require) {
    'use strict';
    var LinkedList = function () {
        this.head = null;
        this.tail = null;
        this._length = 0;
    };
    LinkedList.prototype.insert = function (val) {
        var entry = new LinkedList.Entry(val);
        this.insertEntry(entry);
        return entry;
    };
    LinkedList.prototype.insertAt = function (idx, val) {
        if (idx < 0) {
            return;
        }
        var next = this.head;
        var cursor = 0;
        while (next && cursor != idx) {
            next = next.next;
            cursor++;
        }
        if (next) {
            var entry = new LinkedList.Entry(val);
            var prev = next.prev;
            prev.next = entry;
            entry.prev = prev;
            entry.next = next;
            next.prev = entry;
        } else {
            this.insert(val);
        }
    };
    LinkedList.prototype.insertEntry = function (entry) {
        if (!this.head) {
            this.head = this.tail = entry;
        } else {
            this.tail.next = entry;
            entry.prev = this.tail;
            this.tail = entry;
        }
        this._length++;
    };
    LinkedList.prototype.remove = function (entry) {
        var prev = entry.prev;
        var next = entry.next;
        if (prev) {
            prev.next = next;
        } else {
            this.head = next;
        }
        if (next) {
            next.prev = prev;
        } else {
            this.tail = prev;
        }
        entry.next = entry.prev = null;
        this._length--;
    };
    LinkedList.prototype.removeAt = function (idx) {
        if (idx < 0) {
            return;
        }
        var curr = this.head;
        var cursor = 0;
        while (curr && cursor != idx) {
            curr = curr.next;
            cursor++;
        }
        if (curr) {
            this.remove(curr);
            return curr.value;
        }
    };
    LinkedList.prototype.getHead = function () {
        if (this.head) {
            return this.head.value;
        }
    };
    LinkedList.prototype.getTail = function () {
        if (this.tail) {
            return this.tail.value;
        }
    };
    LinkedList.prototype.getAt = function (idx) {
        if (idx < 0) {
            return;
        }
        var curr = this.head;
        var cursor = 0;
        while (curr && cursor != idx) {
            curr = curr.next;
            cursor++;
        }
        return curr.value;
    };
    LinkedList.prototype.indexOf = function (value) {
        var curr = this.head;
        var cursor = 0;
        while (curr) {
            if (curr.value === value) {
                return cursor;
            }
            curr = curr.next;
            cursor++;
        }
    };
    LinkedList.prototype.length = function () {
        return this._length;
    };
    LinkedList.prototype.isEmpty = function () {
        return this._length === 0;
    };
    LinkedList.prototype.forEach = function (cb, context) {
        var curr = this.head;
        var idx = 0;
        var haveContext = typeof context != 'undefined';
        while (curr) {
            if (haveContext) {
                cb.call(context, curr.value, idx);
            } else {
                cb(curr.value, idx);
            }
            curr = curr.next;
            idx++;
        }
    };
    LinkedList.prototype.clear = function () {
        this.tail = this.head = null;
        this._length = 0;
    };
    LinkedList.Entry = function (val) {
        this.value = val;
        this.next = null;
        this.prev = null;
    };
    return LinkedList;
});define('echarts-x/entity/marker/Base', ['require'], function (require) {
    var MarkerBase = function (chart) {
        this.chart = chart;
    };
    MarkerBase.prototype.setSeries = function (series, seriesIndex) {
    };
    MarkerBase.prototype.clear = function () {
    };
    MarkerBase.prototype.onframe = function (deltaTime) {
    };
    MarkerBase.prototype.getSceneNode = function () {
    };
    MarkerBase.prototype.dispose = function () {
        var renderer = this.chart.baseLayer.renderer;
        renderer.dispose(this.getSceneNode(), true, true);
    };
    return MarkerBase;
});define('echarts-x/util/geometry/Lines', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/Geometry',
    'qtek/math/Vector3',
    'qtek/dep/glmatrix'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var Vector3 = require('qtek/math/Vector3');
    var vec3 = require('qtek/dep/glmatrix').vec3;
    var LinesGeometry = DynamicGeometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true)
            }
        };
    }, {
        clearLines: function () {
            this.attributes.position.value.length = 0;
            this.attributes.color.value.length = 0;
        },
        addLine: function (p0, p1, color) {
            this.attributes.position.value.push(p0._array, p1._array);
            this.attributes.color.value.push(color, color);
        },
        addCubicCurve: function (p0, p1, p2, p3, color) {
            p0 = p0._array;
            p1 = p1._array;
            p2 = p2._array;
            p3 = p3._array;
            var x0 = p0[0], y0 = p0[1], z0 = p0[2];
            var x1 = p1[0], y1 = p1[1], z1 = p1[2];
            var x2 = p2[0], y2 = p2[1], z2 = p2[2];
            var x3 = p3[0], y3 = p3[1], z3 = p3[2];
            var len = vec3.dist(p0, p1) + vec3.len(p2, p1) + vec3.len(p3, p2);
            var step = 1 / (len + 1) * 15;
            var step2 = step * step;
            var step3 = step2 * step;
            var pre1 = 3 * step;
            var pre2 = 3 * step2;
            var pre4 = 6 * step2;
            var pre5 = 6 * step3;
            var tmp1x = x0 - x1 * 2 + x2;
            var tmp1y = y0 - y1 * 2 + y2;
            var tmp1z = z0 - z1 * 2 + z2;
            var tmp2x = (x1 - x2) * 3 - x0 + x3;
            var tmp2y = (y1 - y2) * 3 - y0 + y3;
            var tmp2z = (z1 - z2) * 3 - z0 + z3;
            var fx = x0;
            var fy = y0;
            var fz = z0;
            var dfx = (x1 - x0) * pre1 + tmp1x * pre2 + tmp2x * step3;
            var dfy = (y1 - y0) * pre1 + tmp1y * pre2 + tmp2y * step3;
            var dfz = (z1 - z0) * pre1 + tmp1z * pre2 + tmp2z * step3;
            var ddfx = tmp1x * pre4 + tmp2x * pre5;
            var ddfy = tmp1y * pre4 + tmp2y * pre5;
            var ddfz = tmp1z * pre4 + tmp2z * pre5;
            var dddfx = tmp2x * pre5;
            var dddfy = tmp2y * pre5;
            var dddfz = tmp2z * pre5;
            var positionArr = this.attributes.position.value;
            var colorArr = this.attributes.color.value;
            var offset = positionArr.length;
            var len = 0;
            var t = 0;
            while (t < 1 + step) {
                if (len > 1) {
                    positionArr.push(positionArr[offset + len - 1]);
                    colorArr.push(colorArr[offset + len - 1]);
                    len++;
                }
                positionArr.push(vec3.fromValues(fx, fy, fz));
                colorArr.push(color);
                len++;
                fx += dfx;
                fy += dfy;
                fz += dfz;
                dfx += ddfx;
                dfy += ddfy;
                dfz += ddfz;
                ddfx += dddfx;
                ddfy += dddfy;
                ddfz += dddfz;
                t += step;
            }
        }
    });
    return LinesGeometry;
});define('echarts-x/util/geometry/CurveAnimatingPoints', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/Geometry'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var Attribute = Geometry.Attribute;
    var CurveAnimatingPoints = DynamicGeometry.derive(function () {
        return {
            attributes: {
                p0: new Attribute('p0', 'float', 3, '', true),
                p1: new Attribute('p1', 'float', 3, '', true),
                p2: new Attribute('p2', 'float', 3, '', true),
                p3: new Attribute('p3', 'float', 3, '', true),
                offset: new Attribute('offset', 'float', 1, '', true),
                size: new Attribute('size', 'float', 1, '', true),
                color: new Attribute('color', 'float', 4, 'COLOR', true)
            },
            mainAttribute: 'p0'
        };
    }, {
        clearPoints: function () {
            var attributes = this.attributes;
            attributes.p0.value.length = 0;
            attributes.p1.value.length = 0;
            attributes.p2.value.length = 0;
            attributes.p3.value.length = 0;
            attributes.offset.value.length = 0;
            attributes.size.value.length = 0;
            attributes.color.value.length = 0;
        },
        addPoint: function (p0, p1, p2, p3, color) {
            var attributes = this.attributes;
            var offset = Math.random();
            for (var i = 0; i < 15; i++) {
                attributes.p0.value.push(p0._array);
                attributes.p1.value.push(p1._array);
                attributes.p2.value.push(p2._array);
                attributes.p3.value.push(p3._array);
                attributes.offset.value.push(offset);
                attributes.size.value.push(i / 15);
                attributes.color.value.push(color);
                offset += 0.004;
            }
        }
    });
    return CurveAnimatingPoints;
});define('echarts-x/util/geometry/Bars', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/Geometry',
    'qtek/geometry/Cube',
    'qtek/math/Matrix4',
    'qtek/math/Vector3',
    'qtek/dep/glmatrix'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var CubeGeometry = require('qtek/geometry/Cube');
    var Matrix4 = require('qtek/math/Matrix4');
    var Vector3 = require('qtek/math/Vector3');
    var glMatrix = require('qtek/dep/glmatrix');
    var vec3 = glMatrix.vec3;
    var cubePositions = [
        [
            -1,
            -1,
            0
        ],
        [
            1,
            -1,
            0
        ],
        [
            1,
            1,
            0
        ],
        [
            -1,
            1,
            0
        ],
        [
            -1,
            -1,
            -2
        ],
        [
            1,
            -1,
            -2
        ],
        [
            1,
            1,
            -2
        ],
        [
            -1,
            1,
            -2
        ]
    ];
    var cubeFaces = [
        [
            1,
            5,
            6
        ],
        [
            1,
            6,
            2
        ],
        [
            0,
            3,
            7
        ],
        [
            0,
            7,
            4
        ],
        [
            3,
            2,
            7
        ],
        [
            2,
            6,
            7
        ],
        [
            1,
            4,
            5
        ],
        [
            1,
            0,
            4
        ],
        [
            4,
            6,
            5
        ],
        [
            4,
            7,
            6
        ]
    ];
    var BarsGeometry = DynamicGeometry.derive(function () {
        return {
            _barMat: new Matrix4(),
            _barScaleVec: new Vector3()
        };
    }, {
        clearBars: function () {
            this.attributes.position.value.length = 0;
            this.attributes.color.value.length = 0;
            this.faces.length = 0;
        },
        addBar: function (start, end, size, color) {
            var cubeGeo = this._cubeGeometry;
            var barMat = this._barMat;
            var scaleVec = this._barScaleVec;
            var height = Vector3.dist(start, end);
            if (height <= 0) {
                return;
            }
            Vector3.set(scaleVec, size * 0.5, size * 0.5, height * 0.5);
            Matrix4.identity(barMat);
            Matrix4.lookAt(barMat, start, end, Vector3.UP);
            Matrix4.invert(barMat, barMat);
            Matrix4.scale(barMat, barMat, scaleVec);
            var nVertexBase = this.getVertexNumber();
            for (var i = 0; i < cubeFaces.length; i++) {
                var face = vec3.clone(cubeFaces[i]);
                face[0] += nVertexBase;
                face[1] += nVertexBase;
                face[2] += nVertexBase;
                this.faces.push(face);
            }
            for (var i = 0; i < cubePositions.length; i++) {
                var pos = vec3.clone(cubePositions[i]);
                vec3.transformMat4(pos, pos, barMat._array);
                this.attributes.position.value.push(pos);
                this.attributes.color.value.push(color);
            }
        }
    });
    return BarsGeometry;
});define('qtek/geometry/Cube', [
    'require',
    '../DynamicGeometry',
    './Plane',
    '../math/Matrix4',
    '../math/Vector3',
    '../math/BoundingBox'
], function (require) {
    'use strict';
    var DynamicGeometry = require('../DynamicGeometry');
    var Plane = require('./Plane');
    var Matrix4 = require('../math/Matrix4');
    var Vector3 = require('../math/Vector3');
    var BoundingBox = require('../math/BoundingBox');
    var planeMatrix = new Matrix4();
    var Cube = DynamicGeometry.derive({
        widthSegments: 1,
        heightSegments: 1,
        depthSegments: 1,
        inside: false
    }, function () {
        this.build();
    }, {
        build: function () {
            this.faces.length = 0;
            this.attributes.position.value.length = 0;
            this.attributes.texcoord0.value.length = 0;
            this.attributes.normal.value.length = 0;
            var planes = {
                'px': createPlane('px', this.depthSegments, this.heightSegments),
                'nx': createPlane('nx', this.depthSegments, this.heightSegments),
                'py': createPlane('py', this.widthSegments, this.depthSegments),
                'ny': createPlane('ny', this.widthSegments, this.depthSegments),
                'pz': createPlane('pz', this.widthSegments, this.heightSegments),
                'nz': createPlane('nz', this.widthSegments, this.heightSegments)
            };
            var cursor = 0;
            var attrList = [
                'position',
                'texcoord0',
                'normal'
            ];
            for (var pos in planes) {
                for (var k = 0; k < attrList.length; k++) {
                    var attrName = attrList[k];
                    var attrArray = planes[pos].attributes[attrName].value;
                    for (var i = 0; i < attrArray.length; i++) {
                        var value = attrArray[i];
                        if (this.inside && attrName === 'normal') {
                            value[0] = -value[0];
                            value[1] = -value[1];
                            value[2] = -value[2];
                        }
                        this.attributes[attrName].value.push(value);
                    }
                }
                var plane = planes[pos];
                for (var i = 0; i < plane.faces.length; i++) {
                    var face = plane.faces[i];
                    this.faces.push([
                        face[0] + cursor,
                        face[1] + cursor,
                        face[2] + cursor
                    ]);
                }
                cursor += planes[pos].getVertexNumber();
            }
            this.boundingBox = new BoundingBox();
            this.boundingBox.max.set(1, 1, 1);
            this.boundingBox.min.set(-1, -1, -1);
        }
    });
    function createPlane(pos, widthSegments, heightSegments) {
        planeMatrix.identity();
        var plane = new Plane({
            widthSegments: widthSegments,
            heightSegments: heightSegments
        });
        switch (pos) {
        case 'px':
            Matrix4.translate(planeMatrix, planeMatrix, Vector3.POSITIVE_X);
            Matrix4.rotateY(planeMatrix, planeMatrix, Math.PI / 2);
            break;
        case 'nx':
            Matrix4.translate(planeMatrix, planeMatrix, Vector3.NEGATIVE_X);
            Matrix4.rotateY(planeMatrix, planeMatrix, -Math.PI / 2);
            break;
        case 'py':
            Matrix4.translate(planeMatrix, planeMatrix, Vector3.POSITIVE_Y);
            Matrix4.rotateX(planeMatrix, planeMatrix, -Math.PI / 2);
            break;
        case 'ny':
            Matrix4.translate(planeMatrix, planeMatrix, Vector3.NEGATIVE_Y);
            Matrix4.rotateX(planeMatrix, planeMatrix, Math.PI / 2);
            break;
        case 'pz':
            Matrix4.translate(planeMatrix, planeMatrix, Vector3.POSITIVE_Z);
            break;
        case 'nz':
            Matrix4.translate(planeMatrix, planeMatrix, Vector3.NEGATIVE_Z);
            Matrix4.rotateY(planeMatrix, planeMatrix, Math.PI);
            break;
        }
        plane.applyTransform(planeMatrix);
        return plane;
    }
    return Cube;
});define('qtek/geometry/Plane', [
    'require',
    '../DynamicGeometry',
    '../math/BoundingBox'
], function (require) {
    'use strict';
    var DynamicGeometry = require('../DynamicGeometry');
    var BoundingBox = require('../math/BoundingBox');
    var Plane = DynamicGeometry.derive({
        widthSegments: 1,
        heightSegments: 1
    }, function () {
        this.build();
    }, {
        build: function () {
            var heightSegments = this.heightSegments;
            var widthSegments = this.widthSegments;
            var positions = this.attributes.position.value;
            var texcoords = this.attributes.texcoord0.value;
            var normals = this.attributes.normal.value;
            var faces = this.faces;
            positions.length = 0;
            texcoords.length = 0;
            normals.length = 0;
            faces.length = 0;
            for (var y = 0; y <= heightSegments; y++) {
                var t = y / heightSegments;
                for (var x = 0; x <= widthSegments; x++) {
                    var s = x / widthSegments;
                    positions.push([
                        2 * s - 1,
                        2 * t - 1,
                        0
                    ]);
                    if (texcoords) {
                        texcoords.push([
                            s,
                            t
                        ]);
                    }
                    if (normals) {
                        normals.push([
                            0,
                            0,
                            1
                        ]);
                    }
                    if (x < widthSegments && y < heightSegments) {
                        var i = x + y * (widthSegments + 1);
                        faces.push([
                            i,
                            i + 1,
                            i + widthSegments + 1
                        ]);
                        faces.push([
                            i + widthSegments + 1,
                            i + 1,
                            i + widthSegments + 2
                        ]);
                    }
                }
            }
            this.boundingBox = new BoundingBox();
            this.boundingBox.min.set(-1, -1, 0);
            this.boundingBox.max.set(1, 1, 0);
        }
    });
    return Plane;
});define('echarts-x/surface/TextureAtlasSurface', [
    'require',
    'qtek/Texture2D',
    './ZRenderSurface'
], function (require) {
    var Texture2D = require('qtek/Texture2D');
    var ZRenderSurface = require('./ZRenderSurface');
    var TextureAtlasSurface = function (zr, width, height) {
        this.zr = zr;
        this._x = 0;
        this._y = 0;
        this._width = width || 1024;
        this._height = height || 1024;
        this._rowHeight = 0;
        this._coords = {};
        this._zrenderSurface = new ZRenderSurface(width, height);
        this._zrenderSurface.onrefresh = function () {
            zr.refreshNextFrame();
        };
    };
    TextureAtlasSurface.prototype = {
        clear: function () {
            this._x = 0;
            this._y = 0;
            this._rowHeight = 0;
            this._zrenderSurface.clearElements();
            this._coords = {};
        },
        getWidth: function () {
            return this._width;
        },
        getHeight: function () {
            return this._height;
        },
        getTexture: function () {
            return this._zrenderSurface.getTexture();
        },
        resize: function (width, height) {
            this._zrenderSurface.resize(width, height);
        },
        addShape: function (shape, width, height) {
            this._fitShape(shape, width, height);
            var x = this._x;
            var y = this._y;
            if (x + width > this._width && y + this._rowHeight > this._height) {
                return null;
            }
            if (x + width > this._width) {
                x = this._x = 0;
                y += this._rowHeight;
                this._y = y;
                this._rowHeight = 0;
            }
            this._x += width;
            this._rowHeight = Math.max(this._rowHeight, height);
            shape.position[0] += x;
            shape.position[1] += y;
            this._zrenderSurface.addElement(shape);
            var coords = [
                [
                    x / this._width,
                    y / this._height
                ],
                [
                    (x + width) / this._width,
                    (y + height) / this._height
                ]
            ];
            this._coords[shape.id] = coords;
            return coords;
        },
        refresh: function () {
            this._zrenderSurface.refresh();
        },
        _fitShape: function (shape, width, height) {
            var rect = shape.getRect(shape.style);
            var lineWidth = shape.style.lineWidth || 0;
            var shadowBlur = shape.style.shadowBlur || 0;
            var margin = lineWidth + shadowBlur;
            rect.x -= margin;
            rect.y -= margin;
            rect.width += margin * 2;
            rect.height += margin * 2;
            var scaleX = width / rect.width;
            var scaleY = height / rect.height;
            var x = rect.x;
            var y = rect.y;
            shape.position = [
                -rect.x * scaleX,
                -rect.y * scaleY
            ];
            shape.scale = [
                scaleX,
                scaleY
            ];
            shape.updateTransform();
        },
        getImageCoords: function (id) {
            return this._coords[id];
        }
    };
    return TextureAtlasSurface;
});define('echarts-x/util/geometry/Sprites', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/math/Matrix4',
    'qtek/math/Vector3',
    'qtek/dep/glmatrix'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Matrix4 = require('qtek/math/Matrix4');
    var Vector3 = require('qtek/math/Vector3');
    var vec3 = require('qtek/dep/glmatrix').vec3;
    var vec2 = require('qtek/dep/glmatrix').vec2;
    var squarePositions = [
        [
            -1,
            -1,
            0
        ],
        [
            1,
            -1,
            0
        ],
        [
            1,
            1,
            0
        ],
        [
            -1,
            1,
            0
        ]
    ];
    var squareTexcoords = [
        [
            0,
            0
        ],
        [
            1,
            0
        ],
        [
            1,
            1
        ],
        [
            0,
            1
        ]
    ];
    var squareFaces = [
        [
            0,
            1,
            2
        ],
        [
            0,
            2,
            3
        ]
    ];
    var SpritesGeometry = DynamicGeometry.derive({}, {
        clearSprites: function () {
            var attributes = this.attributes;
            attributes.position.value.length = 0;
            attributes.texcoord0.value.length = 0;
        },
        addSprite: function (matrix, coords) {
            var nVertexBase = this.getVertexNumber();
            for (var i = 0; i < squareFaces.length; i++) {
                var face = Array.prototype.slice.call(squareFaces[i]);
                face[0] += nVertexBase;
                face[1] += nVertexBase;
                face[2] += nVertexBase;
                this.faces.push(face);
            }
            for (var i = 0; i < squarePositions.length; i++) {
                var pos = vec3.clone(squarePositions[i]);
                vec3.transformMat4(pos, pos, matrix._array);
                this.attributes.position.value.push(pos);
            }
            var texcoord0 = this.attributes.texcoord0.value;
            var create = vec2.fromValues;
            texcoord0.push(create(coords[0][0], coords[1][1]));
            texcoord0.push(create(coords[1][0], coords[1][1]));
            texcoord0.push(create(coords[1][0], coords[0][1]));
            texcoord0.push(create(coords[0][0], coords[0][1]));
        }
    });
    return SpritesGeometry;
});define('echarts-x/util/sprite', ['require'], function (require) {
    function makeSprite(size, inCanvas, draw) {
        var canvas = inCanvas || document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        draw && draw(ctx);
        return canvas;
    }
    var spriteUtil = {
        makeSpriteFromShape: function (size, shape, inCanvas) {
            var rect = shape.getRect(shape.style);
            var lineWidth = shape.style.lineWidth || 0;
            var shadowBlur = shape.style.shadowBlur || 0;
            var margin = lineWidth + shadowBlur;
            rect.x -= margin;
            rect.y -= margin;
            rect.width += margin * 2;
            rect.height += margin * 2;
            var scaleX = size / rect.width;
            var scaleY = size / rect.height;
            var x = rect.x;
            var y = rect.y;
            shape.position = [
                -rect.x * scaleX,
                -rect.y * scaleY
            ];
            shape.scale = [
                scaleX,
                scaleY
            ];
            shape.updateTransform();
            return makeSprite(size, inCanvas, function (ctx) {
                shape.brush(ctx);
            });
        },
        makeSimpleSprite: function (size, inCanvas) {
            return makeSprite(size, inCanvas, function (ctx) {
                var halfSize = size / 2;
                ctx.beginPath();
                ctx.arc(halfSize, halfSize, 60, 0, Math.PI * 2, false);
                ctx.closePath();
                var gradient = ctx.createRadialGradient(halfSize, halfSize, 0, halfSize, halfSize, halfSize);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
                gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.fill();
            });
        }
    };
    return spriteUtil;
});define('echarts-x/util/geometry/Points', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/Geometry'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var PointsGeometry = DynamicGeometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                size: new Geometry.Attribute('size', 'float', 1, '', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true)
            }
        };
    }, {
        clearPoints: function () {
            var attributes = this.attributes;
            attributes.position.value.length = 0;
            attributes.color.value.length = 0;
            attributes.size.value.length = 0;
        },
        addPoint: function (position, color, size) {
            var attributes = this.attributes;
            attributes.position.value.push(position._array);
            attributes.color.value.push(color);
            attributes.size.value.push(size);
        }
    });
    return PointsGeometry;
});define('echarts-x/util/geometry/AnimatingPoints', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/Geometry'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
    var AnimatingPointsGeometry = DynamicGeometry.derive(function () {
        return {
            attributes: {
                position: new Geometry.Attribute('position', 'float', 3, 'POSITION', true),
                size: new Geometry.Attribute('size', 'float', 1, '', true),
                delay: new Geometry.Attribute('delay', 'float', 1, '', true),
                color: new Geometry.Attribute('color', 'float', 4, 'COLOR', true)
            }
        };
    }, {
        clearPoints: function () {
            var attributes = this.attributes;
            attributes.position.value.length = 0;
            attributes.color.value.length = 0;
            attributes.size.value.length = 0;
            attributes.delay.value.length = 0;
        },
        addPoint: function (position, color, size, delayTime) {
            var attributes = this.attributes;
            attributes.position.value.push(position._array);
            attributes.color.value.push(color);
            attributes.size.value.push(size);
            attributes.delay.value.push(delayTime);
        }
    });
    return AnimatingPointsGeometry;
});define('qtek/compositor/Pass', [
    'require',
    '../core/Base',
    '../camera/Orthographic',
    '../geometry/Plane',
    '../Shader',
    '../Material',
    '../Mesh',
    '../core/glinfo',
    '../core/glenum',
    '../shader/source/compositor/vertex.essl'
], function (require) {
    'use strict';
    var Base = require('../core/Base');
    var OrthoCamera = require('../camera/Orthographic');
    var Plane = require('../geometry/Plane');
    var Shader = require('../Shader');
    var Material = require('../Material');
    var Mesh = require('../Mesh');
    var glinfo = require('../core/glinfo');
    var glenum = require('../core/glenum');
    Shader['import'](require('../shader/source/compositor/vertex.essl'));
    var planeGeo = new Plane();
    var mesh = new Mesh({ geometry: planeGeo });
    var camera = new OrthoCamera();
    var Pass = Base.derive(function () {
        return {
            fragment: '',
            outputs: null,
            material: null
        };
    }, function () {
        var shader = new Shader({
            vertex: Shader.source('buildin.compositor.vertex'),
            fragment: this.fragment
        });
        var material = new Material({ shader: shader });
        shader.enableTexturesAll();
        this.material = material;
    }, {
        setUniform: function (name, value) {
            var uniform = this.material.uniforms[name];
            if (uniform) {
                uniform.value = value;
            }
        },
        getUniform: function (name) {
            var uniform = this.material.uniforms[name];
            if (uniform) {
                return uniform.value;
            }
        },
        attachOutput: function (texture, attachment) {
            if (!this.outputs) {
                this.outputs = {};
            }
            attachment = attachment || glenum.COLOR_ATTACHMENT0;
            this.outputs[attachment] = texture;
        },
        detachOutput: function (texture) {
            for (var attachment in this.outputs) {
                if (this.outputs[attachment] === texture) {
                    this.outputs[attachment] = null;
                }
            }
        },
        bind: function (renderer, frameBuffer) {
            if (this.outputs) {
                for (var attachment in this.outputs) {
                    var texture = this.outputs[attachment];
                    if (texture) {
                        frameBuffer.attach(renderer.gl, texture, attachment);
                    }
                }
            }
            if (frameBuffer) {
                frameBuffer.bind(renderer);
            }
        },
        unbind: function (renderer, frameBuffer) {
            frameBuffer.unbind(renderer);
        },
        render: function (renderer, frameBuffer) {
            var _gl = renderer.gl;
            mesh.material = this.material;
            if (frameBuffer) {
                this.bind(renderer, frameBuffer);
                var ext = glinfo.getExtension(_gl, 'EXT_draw_buffers');
                if (ext && this.outputs) {
                    var bufs = [];
                    for (var attachment in this.outputs) {
                        attachment = +attachment;
                        if (attachment >= _gl.COLOR_ATTACHMENT0 && attachment <= _gl.COLOR_ATTACHMENT0 + 8) {
                            bufs.push(attachment);
                        }
                    }
                    ext.drawBuffersEXT(bufs);
                }
            }
            this.trigger('beforerender', this, renderer);
            _gl.disable(_gl.BLEND);
            _gl.clear(_gl.DEPTH_BUFFER_BIT);
            renderer.renderQueue([mesh], camera);
            this.trigger('afterrender', this, renderer);
            if (frameBuffer) {
                this.unbind(renderer, frameBuffer);
            }
        }
    });
    return Pass;
});define('qtek/FrameBuffer', [
    'require',
    './core/Base',
    './TextureCube',
    './core/glinfo',
    './core/glenum',
    './core/Cache'
], function (require) {
    'use strict';
    var Base = require('./core/Base');
    var TextureCube = require('./TextureCube');
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var Cache = require('./core/Cache');
    var FrameBuffer = Base.derive({
        depthBuffer: true,
        _attachedTextures: null,
        _width: 0,
        _height: 0,
        _depthTextureAttached: false,
        _renderBufferWidth: 0,
        _renderBufferHeight: 0,
        _binded: false
    }, function () {
        this._cache = new Cache();
        this._attachedTextures = {};
    }, {
        resize: function (width, height) {
            this._width = width;
            this._height = height;
        },
        bind: function (renderer) {
            var _gl = renderer.gl;
            if (!this._binded) {
                _gl.bindFramebuffer(_gl.FRAMEBUFFER, this.getFrameBuffer(_gl));
                this._binded = true;
            }
            this._cache.put('viewport', renderer.viewport);
            renderer.setViewport(0, 0, this._width, this._height, 1);
            if (this._cache.miss('renderbuffer') && this.depthBuffer && !this._depthTextureAttached) {
                this._cache.put('renderbuffer', _gl.createRenderbuffer());
            }
            if (!this._depthTextureAttached && this.depthBuffer) {
                var width = this._width;
                var height = this._height;
                var renderbuffer = this._cache.get('renderbuffer');
                if (width !== this._renderBufferWidth || height !== this._renderBufferHeight) {
                    _gl.bindRenderbuffer(_gl.RENDERBUFFER, renderbuffer);
                    _gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_COMPONENT16, width, height);
                    this._renderBufferWidth = width;
                    this._renderBufferHeight = height;
                    _gl.bindRenderbuffer(_gl.RENDERBUFFER, null);
                }
                if (!this._cache.get('renderbuffer_attached')) {
                    _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);
                    this._cache.put('renderbuffer_attached', true);
                }
            }
        },
        unbind: function (renderer) {
            var _gl = renderer.gl;
            _gl.bindFramebuffer(_gl.FRAMEBUFFER, null);
            this._binded = false;
            this._cache.use(_gl.__GLID__);
            var viewport = this._cache.get('viewport');
            if (viewport) {
                renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
            }
            for (var attachment in this._attachedTextures) {
                var texture = this._attachedTextures[attachment];
                if (!texture.NPOT && texture.useMipmap) {
                    var target = texture instanceof TextureCube ? _gl.TEXTURE_CUBE_MAP : _gl.TEXTURE_2D;
                    _gl.bindTexture(target, texture.getWebGLTexture(_gl));
                    _gl.generateMipmap(target);
                    _gl.bindTexture(target, null);
                }
            }
        },
        getFrameBuffer: function (_gl) {
            this._cache.use(_gl.__GLID__);
            if (this._cache.miss('framebuffer')) {
                this._cache.put('framebuffer', _gl.createFramebuffer());
            }
            return this._cache.get('framebuffer');
        },
        attach: function (_gl, texture, attachment, target, mipmapLevel) {
            if (!texture.width) {
                throw new Error('The texture attached to color buffer is not a valid.');
            }
            if (!this._binded) {
                _gl.bindFramebuffer(_gl.FRAMEBUFFER, this.getFrameBuffer(_gl));
                this._binded = true;
            }
            this._width = texture.width;
            this._height = texture.height;
            attachment = attachment || _gl.COLOR_ATTACHMENT0;
            target = target || _gl.TEXTURE_2D;
            mipmapLevel = mipmapLevel || 0;
            if (attachment === _gl.DEPTH_ATTACHMENT) {
                var extension = glinfo.getExtension(_gl, 'WEBGL_depth_texture');
                if (!extension) {
                    console.error(' Depth texture is not supported by the browser ');
                    return;
                }
                if (texture.format !== glenum.DEPTH_COMPONENT) {
                    console.error('The texture attached to depth buffer is not a valid.');
                    return;
                }
                this._cache.put('renderbuffer_attached', false);
                this._depthTextureAttached = true;
            }
            this._attachedTextures[attachment] = texture;
            _gl.framebufferTexture2D(_gl.FRAMEBUFFER, attachment, target, texture.getWebGLTexture(_gl), mipmapLevel);
        },
        detach: function () {
        },
        dispose: function (_gl) {
            this._cache.use(_gl.__GLID__);
            var renderBuffer = this._cache.get('renderbuffer');
            if (renderBuffer) {
                _gl.deleteRenderbuffer(renderBuffer);
            }
            var frameBuffer = this._cache.get('framebuffer');
            if (frameBuffer) {
                _gl.deleteFramebuffer(frameBuffer);
            }
            this._cache.deleteContext(_gl.__GLID__);
        }
    });
    FrameBuffer.COLOR_ATTACHMENT0 = glenum.COLOR_ATTACHMENT0;
    FrameBuffer.DEPTH_ATTACHMENT = glenum.DEPTH_ATTACHMENT;
    FrameBuffer.STENCIL_ATTACHMENT = glenum.STENCIL_ATTACHMENT;
    FrameBuffer.DEPTH_STENCIL_ATTACHMENT = glenum.DEPTH_STENCIL_ATTACHMENT;
    return FrameBuffer;
});;
define('qtek/shader/source/compositor/vertex.essl', function() { return '\n@export buildin.compositor.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\n\nvarying vec2 v_Texcoord;\n\nvoid main()\n{\n    v_Texcoord = texcoord;\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n}\n\n@end'});
define('qtek/TextureCube', [
    'require',
    './Texture',
    './core/glinfo',
    './core/glenum',
    './core/util'
], function (require) {
    var Texture = require('./Texture');
    var glinfo = require('./core/glinfo');
    var glenum = require('./core/glenum');
    var util = require('./core/util');
    var targetMap = {
        'px': 'TEXTURE_CUBE_MAP_POSITIVE_X',
        'py': 'TEXTURE_CUBE_MAP_POSITIVE_Y',
        'pz': 'TEXTURE_CUBE_MAP_POSITIVE_Z',
        'nx': 'TEXTURE_CUBE_MAP_NEGATIVE_X',
        'ny': 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
        'nz': 'TEXTURE_CUBE_MAP_NEGATIVE_Z'
    };
    var TextureCube = Texture.derive(function () {
        return {
            image: {
                px: null,
                nx: null,
                py: null,
                ny: null,
                pz: null,
                nz: null
            },
            pixels: {
                px: null,
                nx: null,
                py: null,
                ny: null,
                pz: null,
                nz: null
            }
        };
    }, {
        update: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this._cache.get('webgl_texture'));
            this.beforeUpdate(_gl);
            var glFormat = this.format;
            var glType = this.type;
            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_S, this.wrapS);
            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_T, this.wrapT);
            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MAG_FILTER, this.magFilter);
            _gl.texParameteri(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MIN_FILTER, this.minFilter);
            var anisotropicExt = glinfo.getExtension(_gl, 'EXT_texture_filter_anisotropic');
            if (anisotropicExt && this.anisotropic > 1) {
                _gl.texParameterf(_gl.TEXTURE_CUBE_MAP, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }
            if (glType === 36193) {
                var halfFloatExt = glinfo.getExtension(_gl, 'OES_texture_half_float');
                if (!halfFloatExt) {
                    glType = glenum.FLOAT;
                }
            }
            for (var target in this.image) {
                var img = this.image[target];
                if (img) {
                    _gl.texImage2D(_gl[targetMap[target]], 0, glFormat, glFormat, glType, img);
                } else {
                    _gl.texImage2D(_gl[targetMap[target]], 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels[target]);
                }
            }
            if (!this.NPOT && this.useMipmap) {
                _gl.generateMipmap(_gl.TEXTURE_CUBE_MAP);
            }
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, null);
        },
        generateMipmap: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this._cache.get('webgl_texture'));
            _gl.generateMipmap(_gl.TEXTURE_CUBE_MAP);
        },
        bind: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this.getWebGLTexture(_gl));
        },
        unbind: function (_gl) {
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, null);
        },
        isPowerOfTwo: function () {
            if (this.image.px) {
                return isPowerOfTwo(this.image.px.width) && isPowerOfTwo(this.image.px.height);
            } else {
                return isPowerOfTwo(this.width) && isPowerOfTwo(this.height);
            }
            function isPowerOfTwo(value) {
                return value & value - 1 === 0;
            }
        },
        isRenderable: function () {
            if (this.image.px) {
                return isImageRenderable(this.image.px) && isImageRenderable(this.image.nx) && isImageRenderable(this.image.py) && isImageRenderable(this.image.ny) && isImageRenderable(this.image.pz) && isImageRenderable(this.image.nz);
            } else {
                return this.width && this.height;
            }
        },
        load: function (imageList) {
            var loading = 0;
            var self = this;
            util.each(imageList, function (src, target) {
                var image = new Image();
                image.onload = function () {
                    loading--;
                    if (loading === 0) {
                        self.dirty();
                        self.trigger('success', self);
                    }
                    image.onload = null;
                };
                image.onerror = function () {
                    loading--;
                    image.onerror = null;
                };
                loading++;
                image.src = src;
                self.image[target] = image;
            });
            return this;
        }
    });
    function isImageRenderable(image) {
        return image.nodeName === 'CANVAS' || image.complete;
    }
    return TextureCube;
});define('zrender/shape/ShapeBundle', [
    'require',
    './Base',
    '../tool/util'
], function (require) {
    var Base = require('./Base');
    var ShapeBundle = function (options) {
        Base.call(this, options);
    };
    ShapeBundle.prototype = {
        constructor: ShapeBundle,
        type: 'shape-bundle',
        brush: function (ctx, isHighlight) {
            var style = this.beforeBrush(ctx, isHighlight);
            ctx.beginPath();
            for (var i = 0; i < style.shapeList.length; i++) {
                var subShape = style.shapeList[i];
                var subShapeStyle = subShape.style;
                if (isHighlight) {
                    subShapeStyle = subShape.getHighlightStyle(subShapeStyle, subShape.highlightStyle || {}, subShape.brushTypeOnly);
                }
                subShape.buildPath(ctx, subShapeStyle);
            }
            switch (style.brushType) {
            case 'both':
                ctx.fill();
            case 'stroke':
                style.lineWidth > 0 && ctx.stroke();
                break;
            default:
                ctx.fill();
            }
            this.drawText(ctx, style, this.style);
            this.afterBrush(ctx);
        },
        getRect: function (style) {
            if (style.__rect) {
                return style.__rect;
            }
            var minX = Number.MAX_VALUE;
            var maxX = Number.MIN_VALUE;
            var minY = Number.MAX_VALUE;
            var maxY = Number.MIN_VALUE;
            for (var i = 0; i < style.shapeList.length; i++) {
                var subShape = style.shapeList[i];
                var subRect = subShape.getRect(subShape.style);
                var minX = Math.min(subRect.x, minX);
                var minY = Math.min(subRect.y, minY);
                var maxX = Math.max(subRect.x + subRect.width, maxX);
                var maxY = Math.max(subRect.y + subRect.height, maxY);
            }
            style.__rect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
            return style.__rect;
        },
        isCover: function (x, y) {
            var originPos = this.getTansform(x, y);
            x = originPos[0];
            y = originPos[1];
            var rect = this.style.__rect;
            if (!rect) {
                rect = this.getRect(this.style);
            }
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
                for (var i = 0; i < this.style.shapeList.length; i++) {
                    var subShape = this.style.shapeList[i];
                    if (subShape.isCover(x, y)) {
                        return true;
                    }
                }
            }
            return false;
        }
    };
    require('../tool/util').inherits(ShapeBundle, Base);
    return ShapeBundle;
});