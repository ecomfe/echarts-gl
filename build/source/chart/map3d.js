define('echarts-x/chart/map3d', [
    'require',
    'zrender/tool/util',
    'zrender/config',
    'echarts/util/ecData',
    'echarts/util/mapData/params',
    'echarts/util/mapData/geoCoord',
    'echarts/util/mapData/textFixed',
    'echarts/util/projection/normal',
    'zrender/shape/Polygon',
    'zrender/shape/ShapeBundle',
    'zrender/shape/Text',
    'qtek/Node',
    'qtek/Mesh',
    'qtek/geometry/Sphere',
    'qtek/geometry/Plane',
    'qtek/Material',
    'qtek/Shader',
    'qtek/Texture2D',
    'qtek/math/Vector3',
    'qtek/math/Matrix4',
    'qtek/math/Plane',
    'qtek/math/Quaternion',
    'qtek/light/Directional',
    'qtek/light/Ambient',
    'qtek/picking/RayPicking',
    '../config',
    './base3d',
    '../util/OrbitControl',
    '../surface/ZRenderSurface',
    '../surface/VectorFieldParticleSurface',
    '../util/sunCalc',
    'qtek/core/LRU',
    'echarts/chart'
], function (require) {
    var zrUtil = require('zrender/tool/util');
    var zrConfig = require('zrender/config');
    var ecData = require('echarts/util/ecData');
    var mapParams = require('echarts/util/mapData/params').params;
    var geoCoordMap = require('echarts/util/mapData/geoCoord');
    var textFixedMap = require('echarts/util/mapData/textFixed');
    var normalProj = require('echarts/util/projection/normal');
    var PolygonShape = require('zrender/shape/Polygon');
    var ShapeBundle = require('zrender/shape/ShapeBundle');
    var TextShape = require('zrender/shape/Text');
    var Node = require('qtek/Node');
    var Mesh = require('qtek/Mesh');
    var SphereGeometry = require('qtek/geometry/Sphere');
    var PlaneGeometry = require('qtek/geometry/Plane');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Texture2D = require('qtek/Texture2D');
    var Vector3 = require('qtek/math/Vector3');
    var Matrix4 = require('qtek/math/Matrix4');
    var Plane = require('qtek/math/Plane');
    var Quaternion = require('qtek/math/Quaternion');
    var DirectionalLight = require('qtek/light/Directional');
    var AmbientLight = require('qtek/light/Ambient');
    var RayPicking = require('qtek/picking/RayPicking');
    var ecConfig = require('../config');
    var ChartBase3D = require('./base3d');
    var OrbitControl = require('../util/OrbitControl');
    var ZRenderSurface = require('../surface/ZRenderSurface');
    var VectorFieldParticleSurface = require('../surface/VectorFieldParticleSurface');
    var sunCalc = require('../util/sunCalc');
    var LRU = require('qtek/core/LRU');
    var formatGeoPoint = function (p) {
        return [
            (p[0] < -168.5 && p[1] > 63.8 ? p[0] + 360 : p[0]) + 168.5,
            90 - p[1]
        ];
    };
    var PI = Math.PI;
    var PI2 = PI * 2;
    var sin = Math.sin;
    var cos = Math.cos;
    function Map3D(ecTheme, messageCenter, zr, option, myChart) {
        ChartBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);
        if (!this.baseLayer.renderer) {
            return;
        }
        this._earthRadius = 100;
        this._baseTextureSize = 2048;
        this._mapRootNode = null;
        this._mapDataMap = {};
        this._nameMap = {};
        this._globeSurface = null;
        this._surfaceLayerRoot = null;
        this._lambertDiffShader = new Shader({
            vertex: Shader.source('ecx.lambert.vertex'),
            fragment: Shader.source('ecx.lambert.fragment')
        });
        this._lambertDiffShader.enableTexture('diffuseMap');
        this._albedoShader = new Shader({
            vertex: Shader.source('ecx.albedo.vertex'),
            fragment: Shader.source('ecx.albedo.fragment')
        });
        this._albedoShader.enableTexture('diffuseMap');
        this._albedoShaderPA = this._albedoShader.clone();
        this._albedoShaderPA.define('fragment', 'PREMULTIPLIED_ALPHA');
        this._sphereGeometry = new SphereGeometry({
            widthSegments: 60,
            heightSegments: 60
        });
        this._sphereGeometryLowRes = new SphereGeometry({
            widthSegments: 30,
            heightSegments: 30
        });
        this._planeGeometry = new PlaneGeometry();
        this._imageCache = new LRU(6);
        this._vfParticleSurfaceList = [];
        this._skydome = null;
        this._selectedShapeMap = {};
        this._selectedShapeList = [];
        this._selectedMode = false;
        this.refresh(option);
    }
    Map3D.prototype = {
        type: ecConfig.CHART_TYPE_MAP3D,
        constructor: Map3D,
        _init: function () {
            var legend = this.component.legend;
            var series = this.series;
            var self = this;
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
            var mapDataLoading = 0;
            var noAsyncData = true;
            function loadMapData(mapType) {
                mapParams[mapType].getGeoJson(function (mapData) {
                    mapData.mapType = mapType;
                    self._mapDataMap[mapType] = mapData;
                    mapDataLoading--;
                    if (!mapDataLoading) {
                        afterMapDataLoad();
                    }
                });
            }
            for (var mapType in dataMap) {
                if (!this._mapDataMap[mapType] && mapParams[mapType].getGeoJson) {
                    mapDataLoading++;
                    noAsyncData = false;
                    loadMapData(mapType);
                }
                break;
            }
            if (noAsyncData) {
                afterMapDataLoad();
            }
            function afterMapDataLoad() {
                if (self._disposed) {
                    return;
                }
                for (var mapType in dataMap) {
                    var seriesGroup = seriesGroupByMapType[mapType];
                    self._initMap3D(mapType, seriesGroup, dataMap[mapType]);
                    break;
                }
                self.afterBuildMark();
            }
        },
        _initMap3D: function (mapType, seriesGroup, seriesData) {
            var mapQuality = this.deepQuery(seriesGroup, 'baseLayer.quality');
            if (isNaN(mapQuality)) {
                switch (mapQuality) {
                case 'low':
                    this._baseTextureSize = 1024;
                    break;
                case 'high':
                    this._baseTextureSize = 4096;
                    break;
                default:
                    this._baseTextureSize = 2048;
                    break;
                }
            } else {
                this._baseTextureSize = mapQuality;
            }
            this._selectedShapeMap = {};
            this._selectedShapeList = [];
            this._selectedMode = this.deepQuery(seriesGroup, 'selectedMode');
            var isFlatMap = this.deepQuery(seriesGroup, 'flat');
            var mapRootNode = this._mapRootNode;
            if (!mapRootNode || mapRootNode.__isFlatMap !== isFlatMap) {
                if (mapRootNode) {
                    mapRootNode.__control && mapRootNode.__control.dispose();
                    this.baseLayer.renderer.disposeNode(mapRootNode, true, true);
                    this.disposeMark();
                }
                this._createMapRootNode(seriesGroup);
            }
            if (isFlatMap) {
                var radian = this.deepQuery(seriesGroup, 'flatAngle') * Math.PI / 180;
                radian = Math.max(Math.min(Math.PI / 2, radian), 0);
                this._mapRootNode.rotation.identity().rotateX(-radian);
                var bbox = this._getMapBBox(this._mapDataMap[mapType]);
                var aspect = bbox.height / bbox.width;
                var earthMesh = this._mapRootNode.queryNode('earth');
                earthMesh.scale.y = earthMesh.scale.x * aspect;
            }
            this._initMapHandlers(seriesGroup);
            this._updateMapLayers(mapType, seriesData, seriesGroup);
            this._setViewport(seriesGroup);
            this._updateOrbitControl(seriesGroup);
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
        _createMapRootNode: function (seriesGroup) {
            var zr = this.zr;
            var isFlatMap = this.deepQuery(seriesGroup, 'flat');
            var camera = this.baseLayer.camera;
            this._mapRootNode = new Node({ name: 'globe' });
            var mapRootNode = this._mapRootNode;
            mapRootNode.__isFlatMap = isFlatMap;
            if (!isFlatMap) {
                mapRootNode.rotation.rotateY(-Math.PI / 2);
            }
            var earthMesh = new Mesh({
                name: 'earth',
                geometry: isFlatMap ? this._planeGeometry : this._sphereGeometry,
                material: new Material({
                    shader: this._albedoShader,
                    transparent: true
                })
            });
            earthMesh.geometry.pickByRay = isFlatMap ? this._getPlaneRayPickingHooker(earthMesh) : this._getSphereRayPickingHooker(earthMesh);
            var radius = this._earthRadius;
            if (isFlatMap) {
                earthMesh.scale.set(radius * Math.PI, radius * Math.PI / 2, 1);
            } else {
                earthMesh.scale.set(radius, radius, radius);
            }
            camera.position.z = radius * (isFlatMap ? 1 : 2.5);
            camera.position.y = 0;
            camera.lookAt(Vector3.ZERO);
            mapRootNode.add(earthMesh);
            var scene = this.baseLayer.scene;
            scene.add(mapRootNode);
            var control = new OrbitControl(mapRootNode, this.zr, this.baseLayer);
            control.__firstInit = true;
            control.mode = isFlatMap ? 'pan' : 'rotate';
            control.init();
            mapRootNode.__control = control;
            this._globeSurface = this._globeSurface || new ZRenderSurface(this._baseTextureSize, this._baseTextureSize);
            var texture = this._globeSurface.getTexture();
            earthMesh.material.set('diffuseMap', texture);
            texture.flipY = isFlatMap;
            this._globeSurface.onrefresh = function () {
                zr.refreshNextFrame();
            };
        },
        _updateOrbitControl: function (seriesGroup) {
            var mouseControl = this._mapRootNode.__control;
            [
                'autoRotate',
                'autoRotateAfterStill',
                'maxZoom',
                'minZoom'
            ].forEach(function (propName) {
                mouseControl[propName] = this.deepQuery(seriesGroup, 'roam.' + propName);
            }, this);
            mouseControl.stopAllAnimation();
            if (!this.deepQuery(seriesGroup, 'roam.preserve') || mouseControl.__firstInit) {
                var focus = this.deepQuery(seriesGroup, 'roam.focus');
                if (!this._isValueNone(focus)) {
                    var shape = this._globeSurface.getShapeByName(focus);
                    if (shape) {
                        this._focusOnShape(shape);
                    }
                } else {
                    if (mouseControl.__firstInit) {
                        mouseControl.setZoom(10);
                    }
                    var zoom = this.deepQuery(seriesGroup, 'roam.zoom');
                    if (zoom !== mouseControl.getZoom()) {
                        mouseControl.zoomTo({
                            zoom: zoom,
                            easing: 'CubicOut'
                        });
                    }
                }
            }
            mouseControl.__firstInit = false;
        },
        _updateMapLayers: function (mapType, data, seriesGroup) {
            var self = this;
            var mapRootNode = this._mapRootNode;
            var globeSurface = this._globeSurface;
            var deepQuery = this.deepQuery;
            globeSurface.resize(this._baseTextureSize, this._baseTextureSize);
            this._updateLightShading(seriesGroup);
            this._updateSkydome(seriesGroup);
            var bgColor = deepQuery(seriesGroup, 'baseLayer.backgroundColor');
            var bgImage = deepQuery(seriesGroup, 'baseLayer.backgroundImage');
            globeSurface.backgroundColor = this._isValueNone(bgColor) ? '' : bgColor;
            if (!this._isValueNone(bgImage)) {
                if (typeof bgImage == 'string') {
                    var img = this._imageCache.get(bgImage);
                    if (!img) {
                        var img = new Image();
                        img.onload = function () {
                            globeSurface.backgroundImage = img;
                            globeSurface.refresh();
                            self._imageCache.put(bgImage, img);
                        };
                        img.src = bgImage;
                    } else {
                        globeSurface.backgroundImage = img;
                    }
                } else {
                    globeSurface.backgroundImage = bgImage;
                }
            } else {
                globeSurface.backgroundImage = null;
            }
            if (this._mapDataMap[mapType]) {
                this._updateMapPolygonShapes(data, this._mapDataMap[mapType], seriesGroup);
            }
            globeSurface.refresh();
            if (this._surfaceLayerRoot) {
                this.baseLayer.renderer.disposeNode(this._surfaceLayerRoot, false, true);
            }
            this._surfaceLayerRoot = new Node({ name: 'surfaceLayers' });
            mapRootNode.add(this._surfaceLayerRoot);
            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].dispose();
            }
            this._vfParticleSurfaceList = [];
            seriesGroup.forEach(function (serie) {
                var sIdx = this.series.indexOf(serie);
                this.buildMark(sIdx, mapRootNode);
                this._createSurfaceLayers(sIdx);
            }, this);
        },
        _updateSkydome: function (seriesGroup) {
            var background = this.deepQuery(seriesGroup, 'background');
            var self = this;
            if (!this._isValueNone(background)) {
                if (!this._skydome) {
                    this._skydome = new Mesh({
                        material: new Material({ shader: this._albedoShader }),
                        geometry: this._sphereGeometryLowRes,
                        frontFace: Mesh.CW
                    });
                    this._skydome.scale.set(1000, 1000, 1000);
                }
                var skydome = this._skydome;
                skydome.visible = true;
                var texture = skydome.material.get('diffuseMap');
                if (!texture) {
                    texture = new Texture2D({ flipY: false });
                    skydome.material.set('diffuseMap', texture);
                }
                if (typeof background === 'string') {
                    var img = this._imageCache.get(background);
                    if (!img) {
                        texture.load(background).success(function () {
                            self._imageCache.put(background, img);
                            self.zr.refreshNextFrame();
                        });
                    } else {
                        texture.image = img;
                    }
                } else if (this._isValueImage(background)) {
                    texture.image = background;
                }
                texture.dirty();
                this.baseLayer.scene.add(skydome);
            } else if (this._skydome) {
                this._skydome.visible = false;
            }
        },
        _updateLightShading: function (seriesGroup) {
            var self = this;
            var mapRootNode = this._mapRootNode;
            var earthMesh = mapRootNode.queryNode('earth');
            var earthMaterial = earthMesh.material;
            var isFlatMap = mapRootNode.__isFlatMap;
            var deepQuery = this.deepQuery;
            var enableLight = deepQuery(seriesGroup, 'light.show');
            if (enableLight) {
                var lambertDiffShader = this._lambertDiffShader;
                if (earthMaterial.shader !== lambertDiffShader) {
                    earthMaterial.attachShader(lambertDiffShader, true);
                }
                if (isFlatMap) {
                    lambertDiffShader.define('fragment', 'FLAT');
                } else {
                    lambertDiffShader.unDefine('fragment', 'FLAT');
                }
                var sunLight = mapRootNode.queryNode('sun');
                var ambientLight = mapRootNode.queryNode('ambient');
                if (!sunLight) {
                    sunLight = new DirectionalLight({ name: 'sun' });
                    mapRootNode.add(sunLight);
                    ambientLight = new AmbientLight({ name: 'ambient' });
                    mapRootNode.add(ambientLight);
                }
                sunLight.intensity = deepQuery(seriesGroup, 'light.sunIntensity');
                ambientLight.intensity = deepQuery(seriesGroup, 'light.ambientIntensity');
                var time = deepQuery(seriesGroup, 'light.time') || new Date();
                this._getSunPosition(new Date(time).toUTCString(), sunLight.position);
                sunLight.lookAt(Vector3.ZERO);
                var heightImage = deepQuery(seriesGroup, 'baseLayer.heightImage');
                if (!this._isValueNone(heightImage)) {
                    var bumpTexture = earthMaterial.get('bumpMap');
                    if (!bumpTexture) {
                        bumpTexture = new Texture2D({
                            anisotropic: 32,
                            flipY: isFlatMap
                        });
                    }
                    if (typeof heightImage === 'string') {
                        var src = heightImage;
                        heightImage = this._imageCache.get(src);
                        if (!heightImage) {
                            bumpTexture.load(src).success(function () {
                                lambertDiffShader.enableTexture('bumpMap');
                                earthMaterial.set('bumpMap', bumpTexture);
                                self._imageCache.put(src, bumpTexture.image);
                                self.zr.refreshNextFrame();
                            });
                        } else {
                            bumpTexture.image = heightImage;
                        }
                    } else if (this._isValueImage(heightImage)) {
                        bumpTexture.image = heightImage;
                    }
                    bumpTexture.dirty();
                } else {
                    lambertDiffShader.disableTexture('bumpMap');
                }
            } else if (!enableLight && earthMaterial.shader !== this._albedoShader) {
                earthMaterial.attachShader(this._albedoShader, true);
            }
        },
        _getSunPosition: function (time, out) {
            var pos = sunCalc.getPosition(Date.parse(time), 0, 0);
            var r0 = Math.cos(pos.altitude);
            out.y = -r0 * Math.cos(pos.azimuth);
            out.x = Math.sin(pos.altitude);
            out.z = r0 * Math.sin(pos.azimuth);
        },
        _createSurfaceLayers: function (seriesIdx) {
            var serie = this.series[seriesIdx];
            var isFlatMap = this._mapRootNode.__isFlatMap;
            for (var i = 0; i < serie.surfaceLayers.length; i++) {
                var surfaceLayer = serie.surfaceLayers[i];
                var surfaceMesh = new Mesh({
                    name: 'surfaceLayer' + i,
                    geometry: isFlatMap ? this._planeGeometry : this._sphereGeometryLowRes,
                    ignorePicking: true
                });
                var distance = surfaceLayer.distance;
                if (distance == null) {
                    distance = i + 1;
                }
                if (isFlatMap) {
                    surfaceMesh.position.z = distance;
                    surfaceMesh.scale.copy(this._mapRootNode.queryNode('earth').scale);
                } else {
                    var r = this._earthRadius + distance;
                    surfaceMesh.scale.set(r, r, r);
                }
                switch (surfaceLayer.type) {
                case 'particle':
                    this._createParticleSurfaceLayer(seriesIdx, surfaceLayer, surfaceMesh);
                    break;
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
                    texture.load(src).success(function () {
                        self.zr.refreshNextFrame();
                        self._imageCache.put(src, texture.image);
                    });
                } else {
                    texture.image = image;
                }
            } else if (this._isValueImage(image)) {
                texture.image = image;
            }
        },
        _createParticleSurfaceLayer: function (seriesIdx, surfaceLayerCfg, surfaceMesh) {
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
            particleSizeScaling *= textureSize[0] / 1024;
            var particleColor = this.query(surfaceLayerCfg, 'particle.color') || 'white';
            var particleNumber = this.query(surfaceLayerCfg, 'particle.number');
            if (particleNumber == null) {
                particleNumber = 256 * 256;
            }
            var motionBlurFactor = this.query(surfaceLayerCfg, 'particle.motionBlurFactor');
            if (motionBlurFactor == null) {
                motionBlurFactor = 0.99;
            }
            vfParticleSurface.vectorFieldTexture = new Texture2D({
                image: vfImage,
                flipY: !this._mapRootNode.__isFlatMap
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
        _updateMapPolygonShapes: function (data, mapData, seriesGroup) {
            this._globeSurface.clearElements();
            var self = this;
            var dataRange = this.component.dataRange;
            var bbox = this._getMapBBox(mapData);
            var isFlatMap = this._mapRootNode.__isFlatMap;
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
                if (dataItem.selected) {
                    this._selectShape(shape);
                }
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
                var cp = this._getTextPosition(shape, bbox);
                var textScaleX = 1;
                if (!isFlatMap) {
                    var lat = (0.5 - cp[1] / this._baseTextureSize) * PI;
                    var textScaleX = 0.5 / cos(lat);
                }
                var baseScale = this._baseTextureSize / 2048 * Math.sqrt(Math.min(360 / bbox.width, 180 / bbox.height));
                var textShape = new TextShape({
                    zlevel: 1,
                    position: cp,
                    scale: [
                        textScaleX * baseScale,
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
                        var coords = self._normalizeGeoCoord(coordinates[k][i], bbox);
                        coords[0] *= self._baseTextureSize;
                        coords[1] *= self._baseTextureSize;
                        polygon.style.pointList.push(coords);
                    }
                    bundleShape.style.shapeList.push(polygon);
                }
            }
        },
        _normalizeGeoCoord: function (coords, bbox) {
            coords = formatGeoPoint(coords);
            coords[0] = (coords[0] - bbox.left) / bbox.width;
            coords[1] = (coords[1] - bbox.top) / bbox.height;
            return coords;
        },
        _getMapBBox: function (mapData) {
            return this._mapRootNode.__isFlatMap && !mapData.mapType.match('world') ? mapData.bbox || normalProj.getBbox(mapData) : {
                top: 0,
                left: -180 + 168.5,
                width: 360,
                height: 180
            };
        },
        _selectShape: function (shape) {
            if (shape.__selected) {
                return;
            }
            this._selectedShapeMap[shape.name] = shape;
            this._selectedShapeList.push(shape);
            if (this._selectedMode === 'single') {
                if (this._selectedShapeList.length > 1) {
                    var previousShape = this._selectedShapeList.shift();
                    this._unselectShape(previousShape);
                }
            }
            shape.__selected = true;
            shape._style = shape.style;
            shape.style = shape.highlightStyle;
            shape.style.shapeList = shape._style.shapeList;
            shape.style.brushType = shape._style.brushType;
            shape.modSelf();
        },
        _unselectShape: function (shape) {
            if (!shape.__selected) {
                return;
            }
            delete this._selectedShapeMap[shape.name];
            var idx = this._selectedShapeList.indexOf(shape);
            if (idx >= 0) {
                this._selectedShapeList.splice(idx, 1);
            }
            shape.__selected = false;
            shape.style = shape._style;
            shape.modSelf();
        },
        _getTextPosition: function (polygonShape, bbox) {
            var textPosition;
            var name = polygonShape.name;
            var textFixed = textFixedMap[name] || [
                0,
                0
            ];
            var size = this._baseTextureSize;
            if (geoCoordMap[name]) {
                textPosition = this._normalizeGeoCoord(geoCoordMap[name], bbox);
                textPosition[0] *= size;
                textPosition[1] *= size;
            } else if (polygonShape.cp) {
                textPosition = this._normalizeGeoCoord(polygonShape.cp, bbox);
                textPosition[0] *= size;
                textPosition[1] *= size;
            } else {
                var bbox = polygonShape.getRect(polygonShape.style);
                textPosition = [
                    bbox.x + bbox.width / 2 + textFixed[0],
                    bbox.y + bbox.height / 2 + textFixed[1]
                ];
            }
            return textPosition;
        },
        _getSphereRayPickingHooker: function (sphereMesh) {
            var originWorld = new Vector3();
            return function (ray) {
                var r = sphereMesh.geometry.radius;
                var point = ray.intersectSphere(Vector3.ZERO, r);
                if (point) {
                    var pointWorld = new Vector3();
                    Vector3.transformMat4(pointWorld, point, sphereMesh.worldTransform);
                    Vector3.transformMat4(originWorld, ray.origin, sphereMesh.worldTransform);
                    var dist = Vector3.distance(originWorld, point);
                    return new RayPicking.Intersection(point, pointWorld, sphereMesh, null, dist);
                }
            };
        },
        _getPlaneRayPickingHooker: function (planeMesh) {
            var originWorld = new Vector3();
            var plane = new Plane();
            plane.normal.set(0, 0, 1);
            return function (ray) {
                var point = ray.intersectPlane(plane);
                if (point.x >= -1 && point.x <= 1 && point.y >= -1 && point.y <= 1) {
                    var pointWorld = new Vector3();
                    Vector3.transformMat4(pointWorld, point, planeMesh.worldTransform);
                    Vector3.transformMat4(originWorld, ray.origin, planeMesh.worldTransform);
                    var dist = Vector3.distance(originWorld, point);
                    return new RayPicking.Intersection(point, pointWorld, planeMesh, null, dist);
                }
            };
        },
        _initMapHandlers: function (seriesGroup) {
            var earthMesh = this._mapRootNode.queryNode('earth');
            var clickable = this.deepQuery(seriesGroup, 'clickable');
            var hoverable = this.deepQuery(seriesGroup, 'hoverable');
            var isFlatMap = this._mapRootNode.__isFlatMap;
            var mouseEventHandler = function (e) {
                if (e.type === zrConfig.EVENT.CLICK || e.type === zrConfig.EVENT.DBLCLICK) {
                    if (!clickable) {
                        return;
                    }
                } else {
                    if (!hoverable) {
                        return;
                    }
                }
                var point = e.point;
                var x, y;
                var width = this._globeSurface.getWidth();
                var height = this._globeSurface.getWidth();
                if (isFlatMap) {
                    x = (point.x + 1) * width / 2;
                    y = (1 - point.y) * height / 2;
                } else {
                    var geo = this._eulerToGeographic(point.x, point.y, point.z);
                    x = (geo[0] + 180) / 360 * width;
                    y = (90 - geo[1]) / 180 * height;
                }
                var shape = this._globeSurface.hover(x, y);
                if (shape) {
                    if (e.type === zrConfig.EVENT.CLICK && this._selectedMode) {
                        shape.__selected ? this._unselectShape(shape) : this._selectShape(shape);
                        var selected = {};
                        for (var name in this._selectedShapeMap) {
                            selected[name] = true;
                        }
                        this.messageCenter.dispatch(ecConfig.EVENT.MAP3D_SELECTED, e.event, {
                            selected: selected,
                            target: shape.name
                        }, this.myChart);
                    }
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
                'MOUSEMOVE'
            ];
            eventList.forEach(function (eveName) {
                earthMesh.off(zrConfig.EVENT[eveName]);
                earthMesh.on(zrConfig.EVENT[eveName], mouseEventHandler, this);
            }, this);
        },
        _eulerToGeographic: function (x, y, z) {
            var theta = Math.asin(y);
            var phi = Math.atan2(z, -x);
            if (phi < 0) {
                phi = PI2 + phi;
            }
            var lat = theta * 180 / PI;
            var lon = phi * 180 / PI - 180;
            return [
                lon,
                lat
            ];
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
        _focusOnShape: function (shape) {
            if (!shape) {
                return;
            }
            var mapRootNode = this._mapRootNode;
            var earthMesh = mapRootNode.queryNode('earth');
            var isFlatMap = mapRootNode.__isFlatMap;
            var surface = this._globeSurface;
            var w = surface.getWidth();
            var h = surface.getHeight();
            var r = this._earthRadius;
            function convertCoord(x, y) {
                x /= w;
                y /= h;
                if (!isFlatMap) {
                    var r0 = r * sin(y * PI);
                    return new Vector3(-r0 * cos(x * PI2), r * cos(y * PI), r0 * sin(x * PI2));
                } else {
                    return new Vector3(earthMesh.scale.x * 2 * (x - 0.5), earthMesh.scale.y * 2 * (0.5 - y), 0);
                }
            }
            var rect = shape.getRect(shape.style);
            var x = rect.x, y = rect.y;
            var width = rect.width, height = rect.height;
            var lt = convertCoord(x, y);
            var rt = convertCoord(x + width, y);
            var lb = convertCoord(x, y + height);
            var rb = convertCoord(x + width, y + height);
            if (isFlatMap) {
                var center = new Vector3().add(lt).add(rt).add(lb).add(rb).scale(0.25);
                var yAxis = mapRootNode.worldTransform.y;
                var xAxis = mapRootNode.worldTransform.x;
                var x = center.x;
                var y = center.y;
                center.set(0, 0, 0).scaleAndAdd(yAxis, -y).scaleAndAdd(xAxis, -x);
                this._mapRootNode.__control.moveTo({
                    position: center,
                    easing: 'CubicOut'
                });
            } else {
                var normal = new Vector3().add(lt).add(rt).add(lb).add(rb).normalize();
                var tangent = new Vector3();
                var bitangent = new Vector3();
                bitangent.cross(Vector3.UP, normal).normalize();
                tangent.cross(normal, bitangent).normalize();
                var rotation = new Quaternion().setAxes(normal.negate(), bitangent, tangent).invert();
                this._mapRootNode.__control.rotateTo({
                    rotation: rotation,
                    easing: 'CubicOut'
                });
            }
        },
        getMarkCoord: function (seriesIdx, data, point) {
            var mapRootNode = this._mapRootNode;
            var earthMesh = mapRootNode.queryNode('earth');
            var isFlatMap = mapRootNode.__isFlatMap;
            var geoCoord = data.geoCoord || geoCoordMap[data.name];
            var coords = [];
            var serie = this.series[seriesIdx];
            var distance = this.deepQuery([
                data,
                serie.markPoint || serie.markLine || serie.markBar
            ], 'distance');
            coords[0] = geoCoord.x == null ? geoCoord[0] : geoCoord.x;
            coords[1] = geoCoord.y == null ? geoCoord[1] : geoCoord.y;
            var r = this._earthRadius;
            if (isFlatMap) {
                var bbox = this._getMapBBox(this._mapDataMap[serie.mapType]);
                coords = this._normalizeGeoCoord(coords, bbox);
                point._array[0] = (coords[0] - 0.5) * earthMesh.scale.x * 2;
                point._array[1] = (0.5 - coords[1]) * earthMesh.scale.y * 2;
                point._array[2] = distance;
            } else {
                var lon = coords[0];
                var lat = coords[1];
                lon = PI * lon / 180;
                lat = PI * lat / 180;
                r = r + distance;
                var r0 = cos(lat) * r;
                point._array[1] = sin(lat) * r;
                point._array[0] = -r0 * cos(lon + PI);
                point._array[2] = r0 * sin(lon + PI);
            }
        },
        getMarkPointTransform: function () {
            var xAxis = new Vector3();
            var yAxis = new Vector3();
            var zAxis = new Vector3();
            var position = new Vector3();
            return function (seriesIdx, data, matrix) {
                var isFlatMap = this._mapRootNode.__isFlatMap;
                var series = this.series[seriesIdx];
                var queryTarget = [
                    data,
                    series.markPoint
                ];
                var symbolSize = this.deepQuery(queryTarget, 'symbolSize');
                var orientation = this.deepQuery(queryTarget, 'orientation');
                var orientationAngle = this.deepQuery(queryTarget, 'orientationAngle');
                this.getMarkCoord(seriesIdx, data, position);
                if (isFlatMap) {
                    Vector3.set(zAxis, 0, 0, 1);
                    Vector3.set(yAxis, 0, 1, 0);
                    Vector3.set(xAxis, 1, 0, 0);
                } else {
                    Vector3.normalize(zAxis, position);
                    Vector3.cross(xAxis, Vector3.UP, zAxis);
                    Vector3.normalize(xAxis, xAxis);
                    Vector3.cross(yAxis, zAxis, xAxis);
                }
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
                Matrix4.rotateX(matrix, matrix, -orientationAngle / 180 * PI);
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
                var isFlatMap = this._mapRootNode.__isFlatMap;
                var barHeight = data.barHeight != null ? data.barHeight : 1;
                if (typeof barHeight == 'function') {
                    barHeight = barHeight(data);
                }
                this.getMarkCoord(seriesIdx, data, start);
                if (isFlatMap) {
                    Vector3.set(normal, 0, 0, 1);
                } else {
                    Vector3.copy(normal, start);
                    Vector3.normalize(normal, normal);
                }
                Vector3.scaleAndAdd(end, start, normal, barHeight);
            };
        }(),
        getMarkLinePoints: function () {
            var normal = new Vector3();
            var tangent = new Vector3();
            var bitangent = new Vector3();
            var halfVector = new Vector3();
            return function (seriesIdx, data, p0, p1, p2, p3) {
                var isFlatMap = this._mapRootNode.__isFlatMap;
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
                var scaleAndAdd = Vector3.scaleAndAdd;
                if (isCurve) {
                    if (isFlatMap) {
                        var len = Vector3.dist(p0, p3);
                        add(p1, p0, p3);
                        Vector3.scale(p1, p1, 0.5);
                        Vector3.set(normal, 0, 0, 1);
                        scaleAndAdd(p1, p1, normal, Math.min(len * 0.1, 10));
                        Vector3.copy(p2, p1);
                    } else {
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
                        scaleAndAdd(p1, p0, p1, len);
                        scaleAndAdd(p2, p3, p2, len);
                    }
                }
            };
        }(),
        onframe: function (deltaTime) {
            if (!this._mapRootNode) {
                return;
            }
            ChartBase3D.prototype.onframe.call(this, deltaTime);
            this._mapRootNode.__control.update(deltaTime);
            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].update(Math.min(deltaTime / 1000, 0.5));
                this.zr.refreshNextFrame();
            }
            if (this._skydome) {
                this._skydome.rotation.copy(this._mapRootNode.rotation);
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
            if (this._mapRootNode.__control) {
                this._mapRootNode.__control.dispose();
            }
            this._mapRootNode = null;
            this._disposed = true;
            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].dispose();
            }
        }
    };
    zrUtil.inherits(Map3D, ChartBase3D);
    require('echarts/chart').define(ecConfig.CHART_TYPE_MAP3D, Map3D);
    return Map3D;
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
});define('qtek/light/Directional', [
    'require',
    '../Light',
    '../math/Vector3'
], function (require) {
    'use strict';
    var Light = require('../Light');
    var Vector3 = require('../math/Vector3');
    var DirectionalLight = Light.derive({
        shadowBias: 0.0002,
        shadowSlopeScale: 2
    }, {
        type: 'DIRECTIONAL_LIGHT',
        uniformTemplates: {
            'directionalLightDirection': {
                type: '3f',
                value: function () {
                    var z = new Vector3();
                    return function (instance) {
                        return z.copy(instance.worldTransform.z).negate()._array;
                    };
                }()
            },
            'directionalLightColor': {
                type: '3f',
                value: function (instance) {
                    var color = instance.color;
                    var intensity = instance.intensity;
                    return [
                        color[0] * intensity,
                        color[1] * intensity,
                        color[2] * intensity
                    ];
                }
            }
        },
        clone: function () {
            var light = Light.prototype.clone.call(this);
            light.shadowBias = this.shadowBias;
            light.shadowSlopeScale = this.shadowSlopeScale;
            return light;
        }
    });
    return DirectionalLight;
});define('qtek/light/Ambient', [
    'require',
    '../Light'
], function (require) {
    'use strict';
    var Light = require('../Light');
    var AmbientLight = Light.derive({ castShadow: false }, {
        type: 'AMBIENT_LIGHT',
        uniformTemplates: {
            'ambientLightColor': {
                type: '3f',
                value: function (instance) {
                    var color = instance.color, intensity = instance.intensity;
                    return [
                        color[0] * intensity,
                        color[1] * intensity,
                        color[2] * intensity
                    ];
                }
            }
        }
    });
    return AmbientLight;
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
                        return;
                    }
                }
                if (geometry.pickByRay) {
                    var intersection = geometry.pickByRay(ray);
                    if (intersection) {
                        out.push(intersection);
                    }
                    return;
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
        line: require('../entity/marker/MarkLine'),
        bar: require('../entity/marker/MarkBar'),
        point: require('../entity/marker/MarkPoint'),
        largePoint: require('../entity/marker/LargeMarkPoint')
    };
    function Base3D(ecTheme, messageCenter, zr, option, myChart) {
        ComponentBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);
        this._markers = {
            line: {
                list: [],
                count: 0
            },
            point: {
                list: [],
                count: 0
            },
            bar: {
                list: [],
                count: 0
            },
            largePoint: {
                list: [],
                count: 0
            }
        };
    }
    Base3D.prototype = {
        constructor: Base3D,
        beforeBuildMark: function () {
            for (var markerType in this._markers) {
                var marker = this._markers[markerType];
                for (var i = 0; i < marker.list.length; i++) {
                    marker.list[i].clear();
                }
                marker.count = 0;
            }
        },
        buildMark: function (seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];
            if (serie.markPoint) {
                zrUtil.merge(zrUtil.merge(serie.markPoint, this.ecTheme.markPoint || {}), ecConfig.markPoint);
                if (serie.markPoint.large) {
                    this._buildSingleTypeMarker('largePoint', seriesIndex, parentNode);
                } else {
                    this._buildSingleTypeMarker('point', seriesIndex, parentNode);
                }
            }
            if (serie.markLine) {
                zrUtil.merge(zrUtil.merge(serie.markLine, this.ecTheme.markLine || {}), ecConfig.markLine);
                this._buildSingleTypeMarker('line', seriesIndex, parentNode);
            }
            if (serie.markBar) {
                zrUtil.merge(zrUtil.merge(serie.markBar, this.ecTheme.markBar || {}), ecConfig.markBar);
                this._buildSingleTypeMarker('bar', seriesIndex, parentNode);
            }
        },
        afterBuildMark: function () {
            for (var markerType in this._markers) {
                var marker = this._markers[markerType];
                for (var i = marker.count; i < marker.list.length; i++) {
                    this._disposeSingleSerieMark(marker.list[i]);
                }
                marker.list.length = marker.count;
            }
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
            var markerObj = this._markers[markerType];
            var list = markerObj.list;
            var count = markerObj.count;
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
            markerObj.count++;
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
        disposeMark: function () {
            for (var markerType in this._markers) {
                var marker = this._markers[markerType];
                for (var i = 0; i < marker.list.length; i++) {
                    this._disposeSingleSerieMark(marker.list[i]);
                }
                marker.list.length = marker.count = 0;
            }
        },
        dispose: function () {
            ComponentBase3D.prototype.dispose.call(this);
            this.disposeMark();
        },
        onframe: function (deltaTime) {
            for (var markerType in this._markers) {
                var marker = this._markers[markerType];
                for (var i = 0; i < marker.count; i++) {
                    marker.list[i].onframe(deltaTime);
                }
            }
        }
    };
    zrUtil.inherits(Base3D, ComponentBase3D);
    return Base3D;
});define('echarts-x/util/OrbitControl', [
    'require',
    'zrender/config',
    'qtek/math/Vector2',
    'qtek/math/Vector3',
    'qtek/math/Quaternion'
], function (require) {
    'use strict';
    var zrConfig = require('zrender/config');
    var Vector2 = require('qtek/math/Vector2');
    var Vector3 = require('qtek/math/Vector3');
    var Quaternion = require('qtek/math/Quaternion');
    var EVENT = zrConfig.EVENT;
    var OrbitControl = function (target, zr, layer) {
        this.zr = zr;
        this.layer = layer;
        this.target = target;
        var autoRotate = false;
        Object.defineProperty(this, 'autoRotate', {
            get: function (val) {
                return autoRotate;
            },
            set: function (val) {
                autoRotate = val;
                this._rotating = autoRotate;
            }
        });
        this.minZoom = 0.5;
        this.maxZoom = 1.5;
        this.autoRotateAfterStill = 0;
        this.mode = 'rotate';
        this._rotating = false;
        this._rotateY = 0;
        this._rotateX = 0;
        this._mouseX = 0;
        this._mouseY = 0;
        this._rotateVelocity = new Vector2();
        this._panVelocity = new Vector2();
        this._cameraStartPos = new Vector3();
        this._zoom = 1;
        this._zoomSpeed = 0;
        this._animating = false;
        this._stillTimeout = 0;
        this._animators = [];
    };
    OrbitControl.prototype = {
        constructor: OrbitControl,
        init: function () {
            this._animating = false;
            this.layer.bind(EVENT.MOUSEDOWN, this._mouseDownHandler, this);
            this.layer.bind(EVENT.MOUSEWHEEL, this._mouseWheelHandler, this);
            this._rotating = this.autoRotate;
            Vector3.copy(this._cameraStartPos, this.layer.camera.position);
            this._decomposeRotation();
        },
        dispose: function () {
            this.layer.unbind(EVENT.MOUSEDOWN, this._mouseDownHandler);
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler);
            this.layer.unbind(EVENT.MOUSEWHEEL, this._mouseWheelHandler);
            this.stopAllAnimation();
        },
        getZoom: function () {
            return this._zoom;
        },
        setZoom: function (zoom) {
            this._zoom = zoom;
            this.zr.refreshNextFrame();
        },
        rotateTo: function (opts) {
            var toQuat;
            var self = this;
            if (!opts.rotation) {
                toQuat = new Quaternion();
                var view = new Vector3();
                Vector3.negate(view, opts.z);
                toQuat.setAxes(view, opts.x, opts.y);
            } else {
                toQuat = opts.rotation;
            }
            var zr = this.zr;
            var obj = { p: 0 };
            var target = this.target;
            var fromQuat = target.rotation.clone();
            this._animating = true;
            return this._addAnimator(zr.animation.animate(obj).when(opts.time || 1000, { p: 1 }).during(function () {
                Quaternion.slerp(target.rotation, fromQuat, toQuat, obj.p);
                zr.refreshNextFrame();
            }).done(function () {
                self._animating = false;
                self._decomposeRotation();
            }).start(opts.easing || 'Linear'));
        },
        zoomTo: function (opts) {
            var zr = this.zr;
            var zoom = opts.zoom;
            var self = this;
            zoom = Math.max(Math.min(this.maxZoom, zoom), this.minZoom);
            this._animating = true;
            return this._addAnimator(zr.animation.animate(this).when(opts.time || 1000, { _zoom: zoom }).during(function () {
                self._setZoom(self._zoom);
                zr.refreshNextFrame();
            }).done(function () {
                self._animating = false;
            }).start(opts.easing || 'Linear'));
        },
        stopAllAnimation: function () {
            for (var i = 0; i < this._animators.length; i++) {
                this._animators[i].stop();
            }
            this._animators.length = 0;
            this._animating = false;
        },
        moveTo: function (opts) {
            var zr = this.zr;
            var position = opts.position;
            var self = this;
            this._animating = true;
            return this._addAnimator(zr.animation.animate(this.target.position).when(opts.time || 1000, {
                x: position.x,
                y: position.y,
                z: position.z
            }).during(function () {
                zr.refreshNextFrame();
            }).done(function () {
                self._animating = false;
            }).start(opts.easing || 'Linear'));
        },
        update: function (deltaTime) {
            if (this._animating) {
                return;
            }
            if (this.mode === 'rotate') {
                this._updateRotate(deltaTime);
            } else if (this.mode === 'pan') {
                this._updatePan(deltaTime);
            }
            this._updateZoom(deltaTime);
        },
        _updateRotate: function (deltaTime) {
            var velocity = this._rotateVelocity;
            this._rotateY = (velocity.y + this._rotateY) % (Math.PI * 2);
            this._rotateX = (velocity.x + this._rotateX) % (Math.PI * 2);
            this._rotateX = Math.max(Math.min(this._rotateX, Math.PI / 2), -Math.PI / 2);
            this.target.rotation.identity().rotateX(this._rotateX).rotateY(this._rotateY);
            this._vectorDamping(velocity, 0.8);
            if (this._rotating) {
                this._rotateY -= deltaTime * 0.0001;
                this.zr.refreshNextFrame();
            } else if (velocity.len() > 0) {
                this.zr.refreshNextFrame();
            }
        },
        _updateZoom: function (deltaTime) {
            this._setZoom(this._zoom + this._zoomSpeed);
            this._zoomSpeed *= 0.8;
            if (Math.abs(this._zoomSpeed) > 0.001) {
                this.zr.refreshNextFrame();
            }
        },
        _setZoom: function (zoom) {
            this._zoom = Math.max(Math.min(zoom, this.maxZoom), this.minZoom);
            var zoom = this._zoom;
            var camera = this.layer.camera;
            var len = this._cameraStartPos.len() * zoom;
            camera.position.normalize().scale(len);
        },
        _updatePan: function (deltaTime) {
            var velocity = this._panVelocity;
            var target = this.target;
            var yAxis = target.worldTransform.y;
            var xAxis = target.worldTransform.x;
            var len = this.layer.camera.position.len();
            target.position.scaleAndAdd(xAxis, velocity.x * len / 400).scaleAndAdd(yAxis, velocity.y * len / 400);
            this._vectorDamping(velocity, 0.8);
            if (velocity.len() > 0) {
                this.zr.refreshNextFrame();
            }
        },
        _startCountingStill: function () {
            clearTimeout(this._stillTimeout);
            var time = this.autoRotateAfterStill;
            var self = this;
            if (!isNaN(time) && time > 0) {
                this._stillTimeout = setTimeout(function () {
                    self._rotating = true;
                }, time * 1000);
            }
        },
        _vectorDamping: function (v, damping) {
            var speed = v.len();
            speed = speed * damping;
            if (speed < 0.0001) {
                speed = 0;
            }
            v.normalize().scale(speed);
        },
        _decomposeRotation: function () {
            var euler = new Vector3();
            euler.eulerFromQuaternion(this.target.rotation.normalize(), 'ZXY');
            this._rotateX = euler.x;
            this._rotateY = euler.y;
        },
        _mouseDownHandler: function (e) {
            if (this._animating) {
                return;
            }
            this.layer.bind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.bind(EVENT.MOUSEUP, this._mouseUpHandler, this);
            e = e.event;
            if (this.mode === 'rotate') {
                this._rotateVelocity.set(0, 0);
                this._rotating = false;
                if (this.autoRotate) {
                    this._startCountingStill();
                }
            }
            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
        },
        _mouseMoveHandler: function (e) {
            if (this._animating) {
                return;
            }
            e = e.event;
            if (this.mode === 'rotate') {
                this._rotateVelocity.y = (e.pageX - this._mouseX) / 500;
                this._rotateVelocity.x = (e.pageY - this._mouseY) / 500;
            } else if (this.mode === 'pan') {
                this._panVelocity.x = e.pageX - this._mouseX;
                this._panVelocity.y = -e.pageY + this._mouseY;
            }
            this._mouseX = e.pageX;
            this._mouseY = e.pageY;
        },
        _mouseWheelHandler: function (e) {
            if (this._animating) {
                return;
            }
            e = e.event;
            var delta = e.wheelDelta || -e.detail;
            this._zoomSpeed = delta > 0 ? this._zoom / 20 : -this._zoom / 20;
            this._rotating = false;
            if (this.autoRotate && this.mode === 'rotate') {
                this._startCountingStill();
            }
        },
        _mouseUpHandler: function () {
            this.layer.unbind(EVENT.MOUSEMOVE, this._mouseMoveHandler, this);
            this.layer.unbind(EVENT.MOUSEUP, this._mouseUpHandler, this);
        },
        _addAnimator: function (animator) {
            var animators = this._animators;
            animators.push(animator);
            animator.done(function () {
                var idx = animators.indexOf(animator);
                if (idx >= 0) {
                    animators.splice(idx, 1);
                }
            });
            return animator;
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
        hover: function (x, y) {
            var list = this._storage.getShapeList();
            var shape;
            if (typeof x == 'number') {
                shape = this.pickByCoord(x, y);
            } else {
                var e = x;
                shape = this.pick(e.target, e.face, e.point, list);
            }
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
                this.refreshNextTick();
            }
            return shape;
        },
        getShapeByName: function (name) {
            var shapeList = this._storage.getShapeList();
            for (var i = 0; i < shapeList.length; i++) {
                if (shapeList[i].name === name) {
                    return shapeList[i];
                }
            }
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
            return function (attachedMesh, triangle, point, list) {
                var geo = attachedMesh.geometry;
                var position = geo.attributes.position;
                var texcoord = geo.attributes.texcoord0;
                var dot = Vector3.dot;
                var cross = Vector3.cross;
                position.get(triangle[0], p0);
                position.get(triangle[1], p1);
                position.get(triangle[2], p2);
                texcoord.get(triangle[0], uv0);
                texcoord.get(triangle[1], uv1);
                texcoord.get(triangle[2], uv2);
                cross(vCross, p1, p2);
                var det = dot(p0, vCross);
                var t = dot(point, vCross) / det;
                cross(vCross, p2, p0);
                var u = dot(point, vCross) / det;
                cross(vCross, p0, p1);
                var v = dot(point, vCross) / det;
                Vector2.scale(uv, uv0, t);
                Vector2.scaleAndAdd(uv, uv, uv1, u);
                Vector2.scaleAndAdd(uv, uv, uv2, v);
                var x = uv.x * this._width;
                var y = uv.y * this._height;
                return this.pickByCoord(x, y, list);
            };
        }(),
        pickByCoord: function (x, y, list) {
            var list = list || this._storage.getShapeList();
            for (var i = list.length - 1; i >= 0; i--) {
                var shape = list[i];
                if (!shape.isSilent() && shape.isCover(x, y)) {
                    return shape;
                }
            }
        }
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
});define('echarts-x/util/sunCalc', [], function (require) {
    'use strict';
    var PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan, asin = Math.asin, atan = Math.atan2, rad = PI / 180;
    var dayMs = 1000 * 60 * 60 * 24, J1970 = 2440588, J2000 = 2451545;
    function toJulian(date) {
        return date.valueOf() / dayMs - 0.5 + J1970;
    }
    function toDays(date) {
        return toJulian(date) - J2000;
    }
    var e = rad * 23.4397;
    function rightAscension(l, b) {
        return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
    }
    function declination(l, b) {
        return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
    }
    function azimuth(H, phi, dec) {
        return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi));
    }
    function altitude(H, phi, dec) {
        return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H));
    }
    function siderealTime(d, lw) {
        return rad * (280.16 + 360.9856235 * d) - lw;
    }
    function solarMeanAnomaly(d) {
        return rad * (357.5291 + 0.98560028 * d);
    }
    function eclipticLongitude(M) {
        var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), P = rad * 102.9372;
        return M + C + P + PI;
    }
    function sunCoords(d) {
        var M = solarMeanAnomaly(d), L = eclipticLongitude(M);
        return {
            dec: declination(L, 0),
            ra: rightAscension(L, 0)
        };
    }
    var SunCalc = {};
    SunCalc.getPosition = function (date, lat, lng) {
        var lw = rad * -lng, phi = rad * lat, d = toDays(date), c = sunCoords(d), H = siderealTime(d, lw) - c.ra;
        return {
            azimuth: azimuth(H, phi, c.dec),
            altitude: altitude(H, phi, c.dec)
        };
    };
    return SunCalc;
}());define('qtek/core/LRU', [
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
define('qtek/math/Ray', [
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
                center = center._array;
                vec3.sub(v, center, origin);
                var b = vec3.dot(v, direction);
                var c2 = vec3.squaredLength(v);
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
            if (this.boundingBox) {
                this.updateBoundingBox();
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
            var serieDefaultColor = zr.getColor(seriesIndex);
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
        this._albedoShader = new Shader({
            vertex: Shader.source('ecx.albedo.vertex'),
            fragment: Shader.source('ecx.albedo.fragment')
        });
    };
    MarkBar.prototype = {
        constructor: MarkBar,
        _createMarkBarRenderable: function () {
            var material = new Material({ shader: this._albedoShader });
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
                geometry.addBar(start, end, barSize, colorArr);
            }
            geometry.dirty();
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
    'qtek/Texture',
    '../../surface/TextureAtlasSurface',
    '../../util/geometry/Sprites',
    'echarts/util/shape/Icon',
    'zrender/shape/Image',
    'echarts/util/ecData',
    'qtek/math/Matrix4',
    'zrender/config'
], function (require) {
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
    var eventList = [
        'CLICK',
        'DBLCLICK',
        'MOUSEOVER',
        'MOUSEOUT',
        'MOUSEMOVE'
    ];
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
            var serieDefaultColor = zr.getColor(seriesIndex);
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
                ecData.pack(shape, serie, seriesIndex, dataItem, i, dataItem.name, value);
                var labelQueryPrefix = 'itemStyle.normal.label';
                if (chart.deepQuery(queryTarget, labelQueryPrefix + '.show')) {
                    shapeStyle.text = chart.getSerieLabelText(markPoint, dataItem, dataItem.name, 'normal');
                    shapeStyle.textPosition = chart.deepQuery(queryTarget, labelQueryPrefix + '.position');
                    shapeStyle.textColor = chart.deepQuery(queryTarget, labelQueryPrefix + '.textStyle.color');
                    shapeStyle.textFont = chart.getFont(chart.deepQuery(queryTarget, labelQueryPrefix + '.textStyle'));
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
                    if (!shape.clickable) {
                        return;
                    }
                } else {
                    if (!shape.hoverable) {
                        return;
                    }
                }
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
            var serieDefaultColor = zr.getColor(seriesIndex);
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
    'qtek/picking/RayPicking',
    'zrender/mixin/Eventful',
    'zrender/tool/util',
    'zrender/tool/event'
], function (require) {
    var Renderer = require('qtek/Renderer');
    var Scene = require('qtek/Scene');
    var PerspectiveCamera = require('qtek/camera/Perspective');
    var RayPicking = require('qtek/picking/RayPicking');
    var Eventful = require('zrender/mixin/Eventful');
    var zrUtil = require('zrender/tool/util');
    var eventTool = require('zrender/tool/event');
    var Layer3D = function (id, painter) {
        Eventful.call(this);
        this.id = id;
        try {
            this.renderer = new Renderer({});
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
    Layer3D.prototype.getViewportWidth = function () {
        return this._viewport.width * this.renderer.getWidth();
    };
    Layer3D.prototype.getViewportHeight = function () {
        return this._viewport.height * this.renderer.getHeight();
    };
    Layer3D.prototype.clear = function () {
        var gl = this.renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
    };
    Layer3D.prototype.clearDepth = function () {
        var gl = this.renderer.gl;
        gl.clear(gl.DEPTH_BUFFER_BIT);
    };
    Layer3D.prototype.clearColor = function () {
        var gl = this.renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };
    Layer3D.prototype.refresh = function () {
        this.clear();
        this.renderer.render(this.scene, this.camera);
    };
    Layer3D.prototype.renderScene = function (scene) {
        this.renderer.render(scene, this.camera);
    };
    Layer3D.prototype.dispose = function () {
        this.renderer.disposeScene(this.scene);
    };
    Layer3D.prototype.onmousedown = function (e) {
        e = e.event;
        var obj = this.pickObject(eventTool.getX(e), eventTool.getY(e));
        if (obj) {
            this._dispatchEvent('mousedown', e, obj);
        }
    };
    Layer3D.prototype.onmousemove = function (e) {
        e = e.event;
        var obj = this.pickObject(eventTool.getX(e), eventTool.getY(e));
        if (obj) {
            this._dispatchEvent('mousemove', e, obj);
        }
    };
    Layer3D.prototype.onmouseup = function (e) {
        e = e.event;
        var obj = this.pickObject(eventTool.getX(e), eventTool.getY(e));
        if (obj) {
            this._dispatchEvent('mouseup', e, obj);
        }
    };
    Layer3D.prototype.onclick = function (e) {
        e = e.event;
        var obj = this.pickObject(eventTool.getX(e), eventTool.getY(e));
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
            throw 'Error creating WebGL Context ' + e;
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
        getExtension: function (name) {
            return glinfo.getExtension(this.gl, name);
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
                _gl.colorMask(true, true, true, true);
                _gl.depthMask(true);
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
            this._sceneRendering = null;
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
                _gl.enable(_gl.DEPTH_TEST);
                for (var i = 0; i < queue.length; i++) {
                    var renderable = queue[i];
                    var worldM = renderable.worldTransform._array;
                    var geometry = renderable.geometry;
                    mat4.multiply(matrices.WORLDVIEW, matrices.VIEW, worldM);
                    mat4.multiply(matrices.WORLDVIEWPROJECTION, matrices.VIEWPROJECTION, worldM);
                    if (geometry.boundingBox) {
                        if (this.isFrustumCulled(renderable, camera, matrices.WORLDVIEW, matrices.PROJECTION)) {
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
            culling = null;
            cullFace = null;
            frontFace = null;
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
                    if (this.isFrustumCulled(renderable, camera, matrices.WORLDVIEW, matrices.PROJECTION)) {
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
            if (preZ) {
                _gl.depthFunc(_gl.LESS);
            }
            return renderInfo;
        },
        isFrustumCulled: function () {
            var cullingBoundingBox = new BoundingBox();
            var cullingMatrix = new Matrix4();
            return function (object, camera, worldViewMat, projectionMat) {
                var geoBBox = object.boundingBox || object.geometry.boundingBox;
                cullingMatrix._array = worldViewMat;
                cullingBoundingBox.copy(geoBBox);
                cullingBoundingBox.applyTransform(cullingMatrix);
                if (object.isRenderable() && object.castShadow) {
                    camera.sceneBoundingBoxLastFrame.union(cullingBoundingBox);
                }
                if (object.frustumCulling) {
                    if (!cullingBoundingBox.intersectBoundingBox(camera.frustum.boundingBox)) {
                        return true;
                    }
                    cullingMatrix._array = projectionMat;
                    if (cullingBoundingBox.max._array[2] > 0 && cullingBoundingBox.min._array[2] < 0) {
                        cullingBoundingBox.max._array[2] = -1e-20;
                    }
                    cullingBoundingBox.applyProjection(cullingMatrix);
                    var min = cullingBoundingBox.min._array;
                    var max = cullingBoundingBox.max._array;
                    if (max[0] < -1 || min[0] > 1 || max[1] < -1 || min[1] > 1 || max[2] < -1 || min[2] > 1) {
                        return true;
                    }
                }
                return false;
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
        update: function (force, notUpdateLights) {
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
            if (!notUpdateLights) {
                for (var type in this._lightNumber) {
                    this._lightNumber[type] = 0;
                }
                for (var i = 0; i < lights.length; i++) {
                    var light = lights[i];
                    this._lightNumber[light.type]++;
                }
                this._updateLightUniforms();
            }
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
});define('qtek/Camera', [
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
        renderer.disposeNode(this.getSceneNode(), true, true);
    };
    return MarkerBase;
});define('echarts-x/util/geometry/Lines', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/Geometry',
    'qtek/dep/glmatrix'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var Geometry = require('qtek/Geometry');
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
    'qtek/math/Matrix4',
    'qtek/math/Vector3',
    'qtek/dep/glmatrix'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
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
});define('echarts-x/surface/TextureAtlasSurface', [
    'require',
    './ZRenderSurface',
    'zrender/tool/area'
], function (require) {
    var ZRenderSurface = require('./ZRenderSurface');
    var area = require('zrender/tool/area');
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
            var aspect = shape.scale[1] / shape.scale[0];
            width = height * aspect;
            shape.position[0] *= aspect;
            shape.scale[0] = shape.scale[1];
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
        refreshNextTick: function () {
            this._zrenderSurface.refreshNextTick();
        },
        _fitShape: function (shape, spriteWidth, spriteHeight) {
            var shapeStyle = shape.style;
            var rect = shape.getRect(shapeStyle);
            var lineWidth = shapeStyle.lineWidth || 0;
            var shadowBlur = shapeStyle.shadowBlur || 0;
            var margin = lineWidth + shadowBlur;
            var textWidth = 0, textHeight = 0;
            if (shapeStyle.text) {
                textHeight = area.getTextHeight('国', shapeStyle.textFont);
                textWidth = area.getTextWidth(shapeStyle.text, shapeStyle.textFont);
            }
            rect.x -= margin;
            rect.y -= margin;
            rect.width += margin * 2;
            rect.height += margin * 2;
            if (shapeStyle.text) {
                var width = rect.width;
                var height = rect.height;
                var dd = 10;
                switch (shapeStyle.textPosition) {
                case 'inside':
                    width = Math.max(textWidth, width);
                    height = Math.max(textHeight, height);
                    rect.x -= (width - rect.width) / 2;
                    rect.y -= (height - rect.height) / 2;
                    break;
                case 'top':
                    width = Math.max(textWidth, width);
                    height += textHeight + dd;
                    rect.x -= (width - rect.width) / 2;
                    rect.y -= textHeight + dd;
                    break;
                case 'bottom':
                    width = Math.max(textWidth, width);
                    height += textHeight + dd;
                    rect.x -= (width - rect.width) / 2;
                    break;
                case 'left':
                    width += textWidth + dd;
                    height = Math.max(textHeight, height);
                    rect.x -= textWidth + dd;
                    rect.y -= (height - rect.height) / 2;
                    break;
                case 'right':
                    width += textWidth + dd;
                    height = Math.max(textHeight, height);
                    rect.y -= (height - rect.height) / 2;
                    break;
                }
                rect.width = width;
                rect.height = height;
            }
            var scaleX = spriteWidth / rect.width;
            var scaleY = spriteHeight / rect.height;
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
        hover: function (x, y) {
            return this._zrenderSurface.hover(x, y);
        },
        getImageCoords: function (id) {
            return this._coords[id];
        }
    };
    return TextureAtlasSurface;
});define('echarts-x/util/geometry/Sprites', [
    'require',
    'qtek/DynamicGeometry',
    'qtek/dep/glmatrix'
], function (require) {
    var DynamicGeometry = require('qtek/DynamicGeometry');
    var vec3 = require('qtek/dep/glmatrix').vec3;
    var vec2 = require('qtek/dep/glmatrix').vec2;
    var fromValues = vec3.fromValues;
    function getSquarePositions(w, h) {
        return [
            fromValues(-w, -h, 0),
            fromValues(w, -h, 0),
            fromValues(w, h, 0),
            fromValues(-w, h, 0)
        ];
    }
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
            var scaling = (coords[1][0] - coords[0][0]) / (coords[1][1] - coords[0][1]);
            var squarePositions = getSquarePositions(scaling, 1);
            for (var i = 0; i < squarePositions.length; i++) {
                var pos = squarePositions[i];
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
            this.renderQuad(renderer);
            this.trigger('afterrender', this, renderer);
            if (frameBuffer) {
                this.unbind(renderer, frameBuffer);
            }
        },
        renderQuad: function (renderer) {
            mesh.material = this.material;
            renderer.renderQueue([mesh], camera);
        }
    });
    return Pass;
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
            var cache = this._cache;
            cache.put('viewport', renderer.viewport);
            renderer.setViewport(0, 0, this._width, this._height, 1);
            if (!cache.get('depthtexture_attached') && this.depthBuffer) {
                if (cache.miss('renderbuffer')) {
                    cache.put('renderbuffer', _gl.createRenderbuffer());
                }
                var width = this._width;
                var height = this._height;
                var renderbuffer = cache.get('renderbuffer');
                if (width !== cache.get('renderbuffer_width') || height !== cache.get('renderbuffer_height')) {
                    _gl.bindRenderbuffer(_gl.RENDERBUFFER, renderbuffer);
                    _gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_COMPONENT16, width, height);
                    cache.put('renderbuffer_width', width);
                    cache.put('renderbuffer_height', height);
                    _gl.bindRenderbuffer(_gl.RENDERBUFFER, null);
                }
                if (!cache.get('renderbuffer_attached')) {
                    _gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);
                    cache.put('renderbuffer_attached', true);
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
                    console.error(' Depth texture is not supported by the browser');
                    return;
                }
                if (texture.format !== glenum.DEPTH_COMPONENT) {
                    console.error('The texture attached to depth buffer is not a valid.');
                    return;
                }
                this._cache.put('renderbuffer_attached', false);
                this._cache.put('depthtexture_attached', true);
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
            this._attachedTextures = {};
            this._width = this._height = 0;
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
    var targetList = [
        'px',
        'nx',
        'py',
        'ny',
        'pz',
        'nz'
    ];
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
            },
            mipmaps: []
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
            if (this.mipmaps.length) {
                var width = this.width;
                var height = this.height;
                for (var i = 0; i < this.mipmaps.length; i++) {
                    var mipmap = this.mipmaps[i];
                    this._updateTextureData(_gl, mipmap, i, width, height, glFormat, glType);
                    width /= 2;
                    height /= 2;
                }
            } else {
                this._updateTextureData(_gl, this, 0, this.width, this.height, glFormat, glType);
                if (!this.NPOT && this.useMipmap) {
                    _gl.generateMipmap(_gl.TEXTURE_CUBE_MAP);
                }
            }
            _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, null);
        },
        _updateTextureData: function (_gl, data, level, width, height, glFormat, glType) {
            for (var i = 0; i < 6; i++) {
                var target = targetList[i];
                var img = data.image && data.image[target];
                if (img) {
                    _gl.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, glFormat, glFormat, glType, img);
                } else {
                    _gl.texImage2D(_gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, glFormat, width, height, 0, glFormat, glType, data.pixels && data.pixels[target]);
                }
            }
        },
        generateMipmap: function (_gl) {
            if (this.useMipmap && !this.NPOT) {
                _gl.bindTexture(_gl.TEXTURE_CUBE_MAP, this._cache.get('webgl_texture'));
                _gl.generateMipmap(_gl.TEXTURE_CUBE_MAP);
            }
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
                return (value & value - 1) === 0;
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
            var minX = Infinity;
            var maxX = -Infinity;
            var minY = Infinity;
            var maxY = -Infinity;
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
            var originPos = this.transformCoordToLocal(x, y);
            x = originPos[0];
            y = originPos[1];
            if (this.isCoverRect(x, y)) {
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