/**
 * @module echarts-x/chart/map3d
 * @author Yi Shen(https://github.com/pissang)
 */

define(function (require) {

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
    var eventTool = require('zrender/tool/event');

    var Node = require('qtek/Node');
    var Mesh = require('qtek/Mesh');
    var SphereGeometry = require('qtek/geometry/Sphere');
    var PlaneGeometry = require('qtek/geometry/Plane');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var Texture2D = require('qtek/Texture2D');
    var Vector3 = require('qtek/math/Vector3');
    var Vector2 = require('qtek/math/Vector2');
    var Matrix4 = require('qtek/math/Matrix4');
    var Plane = require('qtek/math/Plane');
    var Quaternion = require('qtek/math/Quaternion');
    var DirectionalLight = require('qtek/light/Directional');
    var AmbientLight = require('qtek/light/Ambient');
    var Ray = require('qtek/math/Ray');
    var RayPicking = require('qtek/picking/RayPicking');

    var ecConfig = require('../config');
    var ChartBase3D = require('./base3d');
    var OrbitControl = require('../util/OrbitControl');
 
    var ZRenderSurface = require('../surface/ZRenderSurface');
    var VectorFieldParticleSurface = require('../surface/VectorFieldParticleSurface');

    var sunCalc = require('../util/sunCalc');

    var LRU = require('qtek/core/LRU');

    var formatGeoPoint = function (p) {
        //调整俄罗斯东部到地图右侧与俄罗斯相连
        return [
            ((p[0] < -168.5 && p[1] > 63.8) ? p[0] + 360 : p[0]) + 168.5, 
            90 - p[1]
        ];
    };

    var PI = Math.PI;
    var PI2 = PI * 2;
    var sin = Math.sin;
    var cos = Math.cos;
    /**
     * @constructor
     * @extends module:echarts-x/chart/base3d
     * @alias module:echarts-x/chart/map3d
     * @param {Object} ecTheme
     * @param {Object} messageCenter
     * @param {module:zrender~ZRender} zr
     * @param {Object} option
     * @param {module:echarts~ECharts} myChart
     */
    function Map3D(ecTheme, messageCenter, zr, option, myChart) {

        ChartBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);

        // Browser not support WebGL
        if (! this.baseLayer.renderer) {
            return;
        }

        /**
         * Radius of earth sphere mesh
         * @type {number}
         * @private
         */
        this._earthRadius = 100;

        /**
         * Size of base texture mapped on the earth, which is drawed from geoJSON data
         * @type {number}
         * @private
         */
        this._baseTextureSize = 2048;

        /**
         * Root scene node of map3d. Children contains earth mesh, markers mesh etc.
         * @type {qtek.Node}
         * @private
         */
        this._mapRootNode = null;

        /**
         * Cached map data, key is map type
         * @type {Object}
         * @private
         */
        this._mapDataMap = {};

        /**
         * Name map
         * @type {Object}
         * @private
         */
        this._nameMap = {};

        /**
         * @type {module:echarts-x/core/ZRenderSurface}
         * @private
         */
        this._globeSurface = null;

        /**
         * Root scene node of all surface layers.
         * Mounted under globe node
         * @type {qtek.Node}
         * @private
         */
        this._surfaceLayerRoot = null;

        /**
         * @type {qtek.Shader}
         * @private
         */
        this._lambertDiffShader = new Shader({
            vertex: Shader.source('ecx.lambert.vertex'),
            fragment: Shader.source('ecx.lambert.fragment')
        });
        this._lambertDiffShader.enableTexture('diffuseMap');

        /**
         * @type {qtek.Shader}
         * @private
         */
        this._albedoShader = new Shader({
            vertex: Shader.source('ecx.albedo.vertex'),
            fragment: Shader.source('ecx.albedo.fragment')
        });
        this._albedoShader.enableTexture('diffuseMap');
            
        /**
         * @type {qtek.Shader}
         * @private
         */
        this._albedoShaderPA = this._albedoShader.clone();
        this._albedoShaderPA.define('fragment', 'PREMULTIPLIED_ALPHA');

        /**
         * @type {qtek.geometry.Sphere}
         * @private
         */
        this._sphereGeometry = new SphereGeometry({
            widthSegments: 60,
            heightSegments: 60
        });

        /**
         * @type {qtek.geometry.Sphere}
         * @private
         */
        this._sphereGeometryLowRes = new SphereGeometry({
            widthSegments: 30,
            heightSegments: 30
        });

        /**
         * @type {qtek.geometry.Plane}
         */
        this._planeGeometry = new PlaneGeometry();

        /**
         * @type {qtek.core.LRU}
         * @private
         */
        this._imageCache = new LRU(6);

        /**
         * List of all vector field particle surfaces
         * Needs update each frame
         * @type {Array}
         * @private
         */
        this._vfParticleSurfaceList = [];

        /**
         * Skydome mesh
         * @type {qtek.Mesh}
         */
        this._skydome = null;

        this.refresh(option);
    }

    Map3D.prototype = {

        /**
         * @type {string}
         */
        type: ecConfig.CHART_TYPE_MAP3D,

        constructor: Map3D,

        /**
         * Initialize map3d chart
         * @private
         */
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
                    if (series[i].nameMap) {
                        this._nameMap[mapType] = this._nameMap[mapType] || {};
                        zrUtil.merge(
                            this._nameMap[mapType], series[i].nameMap, true
                        );
                    }
                }
            }

            var seriesGroupByMapType = this._groupSeriesByMapType(series);
            var dataMap = this._mergeSeriesData(series);

            var mapDataLoading = 0;
            function loadMapData(mapType) {
                // Load geo json and draw the map on the base texture
                mapParams[mapType].getGeoJson(function (mapData) {
                    mapData.mapType = mapType;
                    self._mapDataMap[mapType] = mapData;

                    mapDataLoading--;
                    if (! mapDataLoading) {
                        afterMapDataLoad();
                    }
                });
            }
            for (var mapType in dataMap) {
                if (this._mapDataMap[mapType]) {
                    continue;
                }
                else if (mapParams[mapType].getGeoJson) {
                    mapDataLoading++;
                    loadMapData(mapType);
                }
                // TODO Only support one mapType here
                break;
            }
            if (! mapDataLoading) {
                afterMapDataLoad();
            }

            function afterMapDataLoad() {
                if (self._disposed) {
                    return;
                }

                for (var mapType in dataMap) {
                    var seriesGroup = seriesGroupByMapType[mapType];
                    self._initMap3D(mapType, seriesGroup, dataMap[mapType]);
                    //TODO Only support one mapType here
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
                    case 'medium':
                    default:
                        this._baseTextureSize = 2048;
                        break;
                }   
            }
            else {
                this._baseTextureSize = mapQuality;
            }

            var isFlatMap = this.deepQuery(seriesGroup, 'flat');
            var mapRootNode = this._mapRootNode;
            if (! mapRootNode || mapRootNode.__isFlatMap !== isFlatMap) {
                if (mapRootNode) {
                    mapRootNode.__control && mapRootNode.__control.dispose();
                    this.baseLayer.renderer.disposeNode(mapRootNode, true, true);
                    // All shaders and textures have been dispose 
                    // So the cached markers is useless and must be disposed
                    this.disposeMark();
                }

                this._createMapRootNode(seriesGroup);
            }

            this._initMapHandlers(seriesGroup);

            this._updateMapLayers(mapType, seriesData, seriesGroup);

            this._setViewport(seriesGroup);

            this._updateOrbitControl(seriesGroup);
        },

        /**
         * Set viewport of map3d layer
         * @param {Array.<Object>} seriesGroup
         */
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

        /**
         * Group series by mapType
         * @param  {Array.<Object>} series
         * @return {Object}
         * @private
         */
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

        /**
         * Merge the series data from same mapType
         * @param  {Array.<Object>} series
         * @return {Object}
         * @private
         */
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

        /**
         * Create globe mesh, and surface canvas, mouse control instance.
         * Stuff only need to create once and used each refresh.
         * @param  {Array.<Object>} seriesGroup
         * @private
         */
        _createMapRootNode: function (seriesGroup) {
            var zr = this.zr;
            var self = this;
            var isFlatMap = this.deepQuery(seriesGroup, 'flat');
            var camera = this.baseLayer.camera;

            this._mapRootNode = new Node({
                name: 'globe'
            });
            var mapRootNode = this._mapRootNode;
            mapRootNode.__isFlatMap = isFlatMap;

            // Put the longitude 0 in the center of view
            if (! isFlatMap) {
                mapRootNode.rotation.rotateY(-Math.PI / 2);
            }
            else {
                // 45 degree angle view
                mapRootNode.rotation.rotateX(-Math.PI / 4);
            }

            var earthMesh = new Mesh({
                name: 'earth',
                geometry: isFlatMap ? this._planeGeometry : this._sphereGeometry,
                material: new Material({
                    shader: this._albedoShader,
                    transparent: true
                })
            });
            
            earthMesh.geometry.pickByRay = isFlatMap ? this._getPlaneRayPickingHooker(earthMesh)
                    : this._getSphereRayPickingHooker(earthMesh);

            var radius = this._earthRadius;

            if (isFlatMap) {
                earthMesh.scale.set(radius * Math.PI, radius * Math.PI / 2, 1);
            }
            else {
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

            this._globeSurface = this._globeSurface || new ZRenderSurface(
                this._baseTextureSize, this._baseTextureSize
            );
            var texture = this._globeSurface.getTexture();
            earthMesh.material.set('diffuseMap', texture);
            texture.flipY = isFlatMap;

            this._globeSurface.onrefresh = function () {
                zr.refreshNextFrame();
            };
        },

        _updateOrbitControl: function (seriesGroup) {
            var mouseControl = this._mapRootNode.__control;

            // Oribit control configuration
            ['autoRotate', 'autoRotateAfterStill', 'maxZoom', 'minZoom'].forEach(function (propName) {
                mouseControl[propName] = this.deepQuery(seriesGroup, 'roam.' + propName);
            }, this);

            mouseControl.stopAllAnimation();

            if (! this.deepQuery(seriesGroup, 'roam.preserve') || mouseControl.__firstInit) {
                var focus = this.deepQuery(seriesGroup, 'roam.focus');
                if (! this._isValueNone(focus)) {
                    var shape = this._globeSurface.getShapeByName(focus);
                    if (shape) {
                        this._focusOnShape(shape);
                    }
                }
                else {
                    if (mouseControl.__firstInit) {
                        mouseControl.setZoom(10.0);
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

        /**
         * Build globe in each refresh operation.
         * Draw base map from geoJSON data. Build markers.
         * @param  {string} mapType
         * @param  {Array.<Object>} data Data preprocessed in _mergeSeriesData
         * @param  {Array.<Object>} seriesGroup seriesGroup created in _groupSeriesByMapType
         */
        _updateMapLayers: function (mapType, data, seriesGroup) {

            var self = this;
            var mapRootNode = this._mapRootNode;
            var mouseControl = mapRootNode.__control;
            var globeSurface = this._globeSurface;

            var deepQuery = this.deepQuery;

            globeSurface.resize(
                this._baseTextureSize, this._baseTextureSize
            );
            // Light configuration
            this._updateLightShading(seriesGroup);

            // Skydome background configuration
            this._updateSkydome(seriesGroup);

            // Update earth base texture background image and color
            var bgColor = deepQuery(seriesGroup, 'baseLayer.backgroundColor');
            var bgImage = deepQuery(seriesGroup, 'baseLayer.backgroundImage');
            globeSurface.backgroundColor = this._isValueNone(bgColor) ? '' : bgColor;
            if (! this._isValueNone(bgImage)) {
                if (typeof(bgImage) == 'string') {
                    var img = this._imageCache.get(bgImage);
                    if (! img) {
                        var img = new Image();
                        img.onload = function () {
                            globeSurface.backgroundImage = img;
                            globeSurface.refresh();
                            self._imageCache.put(bgImage, img);
                        }
                        img.src = bgImage;
                    }
                    else {
                        globeSurface.backgroundImage = img;
                    }
                }
                else {
                    // mapBackgroundImage is a image|canvas object
                    globeSurface.backgroundImage = bgImage;
                }
            }
            else {
                globeSurface.backgroundImage = null;
            }

            if (this._mapDataMap[mapType]) {
                this._updateMapPolygonShapes(data, this._mapDataMap[mapType], seriesGroup);
            }
            globeSurface.refresh();

            // Build surface layers
            if (this._surfaceLayerRoot) {
                this.baseLayer.renderer.disposeNode(
                    this._surfaceLayerRoot, false, true
                );
            }
            this._surfaceLayerRoot = new Node({
                name: 'surfaceLayers'
            });
            mapRootNode.add(this._surfaceLayerRoot);

            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].dispose();
            }
            this._vfParticleSurfaceList = [];

            // Build markers
            seriesGroup.forEach(function (serie) {
                var sIdx = this.series.indexOf(serie);
                this.buildMark(sIdx, mapRootNode);
                this._createSurfaceLayers(sIdx);
            }, this);
        },

        /**
         * @param  {Array.<Object>} seriesGroup
         */
        _updateSkydome: function (seriesGroup) {
            var background = this.deepQuery(seriesGroup, 'background');
            var self = this;

            if (! this._isValueNone(background)) {
                if (! this._skydome) {
                    this._skydome = new Mesh({
                        material: new Material({
                            shader: this._albedoShader
                        }),
                        geometry: this._sphereGeometryLowRes,
                        frontFace: Mesh.CW
                    });
                    this._skydome.scale.set(1000, 1000, 1000);
                }
                var skydome = this._skydome;
                skydome.visible = true;

                var texture = skydome.material.get('diffuseMap');
                if (! texture) {
                    texture = new Texture2D({ flipY: false });
                    skydome.material.set('diffuseMap', texture);
                }
                if (typeof(background) === 'string') {
                    var img = this._imageCache.get(background);
                    if (!img) {
                        texture.load(background).success(function () {
                            self._imageCache.put(background, img);
                            self.zr.refreshNextFrame();
                        });
                    }
                    else {
                        texture.image = img;
                    }
                }
                else if (this._isValueImage(background)) {
                    texture.image = background;
                }
                texture.dirty();

                this.baseLayer.scene.add(skydome);
            }
            else if (this._skydome) {
                this._skydome.visible = false;
            }
        },

        /**
         * Update sun light position and shading config
         * @param  {Array.<Object>} seriesGroup
         */
        _updateLightShading: function (seriesGroup) {
            var self = this;
            var mapRootNode = this._mapRootNode;
            var earthMesh = mapRootNode.queryNode('earth');
            var earthMaterial = earthMesh.material;
            var isFlatMap = mapRootNode.__isFlatMap;

            var deepQuery = this.deepQuery;

            var enableLight = deepQuery(seriesGroup, 'light.enable');
            if (enableLight) {
                var lambertDiffShader = this._lambertDiffShader;
                if (earthMaterial.shader !== lambertDiffShader) {
                    earthMaterial.attachShader(lambertDiffShader, true);
                }
                if (isFlatMap) {
                    lambertDiffShader.define('fragment', 'FLAT');
                }
                else {
                    lambertDiffShader.unDefine('fragment', 'FLAT');   
                }

                var sunLight = mapRootNode.queryNode('sun');
                var ambientLight = mapRootNode.queryNode('ambient');

                if (! sunLight) {
                    sunLight = new DirectionalLight({ name: 'sun' });
                    mapRootNode.add(sunLight);
                    ambientLight = new AmbientLight({ name: 'ambient' });
                    mapRootNode.add(ambientLight);
                }
                sunLight.intensity = deepQuery(seriesGroup, 'light.sunIntensity');
                ambientLight.intensity = deepQuery(seriesGroup, 'light.ambientIntensity');
                // Put sun in the right position
                var time = deepQuery(seriesGroup, 'light.time') || new Date();

                this._getSunPosition(new Date(time).toUTCString(), sunLight.position);
                sunLight.lookAt(Vector3.ZERO);

                var heightImage = deepQuery(seriesGroup, 'baseLayer.heightImage');
                if (! this._isValueNone(heightImage)) {
                    var bumpTexture = earthMaterial.get('bumpMap');
                    if (! bumpTexture) {
                        bumpTexture = new Texture2D({ anisotropic: 32, flipY: isFlatMap });
                    }
                    if (typeof (heightImage) === 'string') {
                        var src = heightImage;
                        heightImage = this._imageCache.get(src);
                        if (! heightImage) {
                            bumpTexture.load(src).success(function () {
                                // FIXME Config changed and refreshed before bum map loaded
                                lambertDiffShader.enableTexture('bumpMap');
                                earthMaterial.set('bumpMap', bumpTexture);
                                self._imageCache.put(src, bumpTexture.image);
                                self.zr.refreshNextFrame();
                            });
                        }
                        else {
                            bumpTexture.image = heightImage;
                        }
                    }
                    else if (this._isValueImage(heightImage)) {
                        bumpTexture.image = heightImage;
                    }
                    bumpTexture.dirty();
                }
                else {
                    lambertDiffShader.disableTexture('bumpMap');
                }
            }
            else if (! enableLight && earthMaterial.shader !== this._albedoShader) {
                earthMaterial.attachShader(this._albedoShader, true);
            }
        },

        _getSunPosition: function (time, out) {
            // http://en.wikipedia.org/wiki/Azimuth
            var pos = sunCalc.getPosition(Date.parse(time), 0, 0);
            var r0 = Math.cos(pos.altitude);
            // FIXME How to calculate the y ?
            out.y = -r0 * Math.cos(pos.azimuth);
            out.x = Math.sin(pos.altitude);
            out.z = r0 * Math.sin(pos.azimuth);
        },

        /**
         * Create surface layers on the globe
         * @param  {number} seriesIdx
         * @private
         */
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
                // Default distance
                if (distance == null) {
                    distance = i + 1;
                }

                if (isFlatMap) {
                    surfaceMesh.position.z = distance;
                    surfaceMesh.scale.copy(this._mapRootNode.queryNode('earth').scale);
                }
                else {
                    var r = this._earthRadius + distance;
                    surfaceMesh.scale.set(r, r, r);   
                }

                switch (surfaceLayer.type) {
                    case 'particle':
                        this._createParticleSurfaceLayer(
                            seriesIdx, surfaceLayer, surfaceMesh
                        );
                        break;
                    case "texture":
                    default:
                        this._createTextureSurfaceLayer(
                            seriesIdx, surfaceLayer, surfaceMesh
                        );
                        break;
                }

                this._surfaceLayerRoot.add(surfaceMesh);
            }
        },

        /**
         * Create single texture layer on the globe
         * @param {number} seriesIdx
         * @param {Object} surfaceLayerCfg
         * @param {qtek.Mesh} surfaceMesh
         * @private
         */
        _createTextureSurfaceLayer: function (
            seriesIdx, surfaceLayerCfg, surfaceMesh
        ) {
            var self = this;
            surfaceMesh.material =  new Material({
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
                // Use a blank place-holder canvas
                image: canvas
            });
            surfaceMesh.material.set('diffuseMap', texture);

            if (typeof(image) === 'string') {
                var src = image;
                image = this._imageCache.get(src);
                if (! image) {
                    texture.load(src).success(function () {
                        self.zr.refreshNextFrame();
                        self._imageCache.put(src, texture.image);
                    });
                }
                else {
                    texture.image = image;
                }
            }
            else if (this._isValueImage(image)) {
                texture.image = image;
            }
        },

        /**
         * Create single vector field layer on the globe
         * @param {number} seriesIdx
         * @param {Object} surfaceLayerCfg
         * @param {qtek.Mesh} surfaceMesh
         * @private
         */
        _createParticleSurfaceLayer: function (
            seriesIdx, surfaceLayerCfg, surfaceMesh
        ) {
            var self = this;
            var serie = this.series[seriesIdx];
            var data = this.query(surfaceLayerCfg, 'particle.vectorField');
            // var name = surfaceLayerCfg.name || serie.name;

            surfaceMesh.material =  new Material({
                shader: this._albedoShaderPA,
                transparent: true,
                depthMask: false
            });

            var vfParticleSurface = new VectorFieldParticleSurface(
                this.baseLayer.renderer, data
            );
            var width = 0;
            var height = 0;
            var vfImage;
            if (data instanceof Array) {
                vfImage = this._createCanvasFromDataMatrix(data);
                width = vfImage.width;
                height = vfImage.height;
                if (! vfImage) {
                    return false;
                }
            }
            else if (this._isValueImage(data)) {
                width = data.width;
                height = data.height;
                vfImage = data;
            }
            else {
                // Invalid data
                return false;
            }
            if (! width || ! height) {
                // Empty data
                return;
            }

            var textureSize = this.query(surfaceLayerCfg, 'size');
            if (typeof(textureSize) === 'number') {
                textureSize = [textureSize, textureSize];
            }
            else if (! textureSize) {
                // Default texture size
                textureSize = [2048, 1024];
            }
            // Particle configuration
            var particleSizeScaling = this.query(surfaceLayerCfg, 'particle.sizeScaling') || 1;
            var particleSpeedScaling = this.query(surfaceLayerCfg, 'particle.speedScaling');
            if (particleSpeedScaling == null) {
                particleSpeedScaling = 1;
            }
            // Scale particle size by texture width
            particleSizeScaling *= textureSize[0] / 1024;

            var particleColor = this.query(surfaceLayerCfg, 'particle.color') || 'white';
            var particleNumber = this.query(surfaceLayerCfg, 'particle.number');
            if (particleNumber == null) {
                // Default 256 x 256
                particleNumber = 256 * 256;
            };
            var motionBlurFactor = this.query(surfaceLayerCfg, 'particle.motionBlurFactor');
            if (motionBlurFactor == null) {
                motionBlurFactor = 0.99;
            }

            vfParticleSurface.vectorFieldTexture = new Texture2D({
                image: vfImage,
                // Vector data column ranges -90 to 90
                flipY: ! this._mapRootNode.__isFlatMap,
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
                // Invalid data
                return null;
            }
            var width = data[0].length;
            if (!(data[0][0] instanceof Array)) {
                // Invalid data
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

            // document.body.appendChild(vfImage);
            // vfImage.style.position = 'absolute';
            return vfImage;
        },

        /**
         * Create polygon shapes from geoJSON data. Shapes will be added to ZRenderSurface
         * and drawed on the canvas(which is attached on the sphere surface).
         * @param  {Array.<Object>} data
         * @param  {Object} mapData map geoJSON data
         * @param  {Array.<Object>} seriesGroup
         */
        _updateMapPolygonShapes: function (data, mapData, seriesGroup) {

            this._globeSurface.clearElements();

            var self = this;
            var dataRange = this.component.dataRange;

            var bbox = this._getMapBBox(mapData);

            var mapType = this.deepQuery(seriesGroup, 'mapType');
            var nameMap = this._nameMap[mapType] || {};

            // Draw map
            // TODO Special area
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
                }
                else {
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
                var lat = (0.5 - cp[1] / this._baseTextureSize) * PI;
                var textScaleX = 1 / cos(lat);
                var baseScale = this._baseTextureSize / 2048;
                var textShape = new TextShape({
                    zlevel: 1,
                    position: cp,
                    scale: [0.5 * textScaleX * baseScale, baseScale],
                    style: {
                        x: 0,
                        y: 0,
                        brushType: 'fill',
                        text: this._getMapLabelText(name, value, queryTarget, 'normal'),
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
                }
                else if (geometry.type == 'MultiPolygon') {
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
                        var coords = self._normalizeGeoCoord(coordinates[k][i], bbox);
                        coords[0] *= self._baseTextureSize;
                        coords[1] *= self._baseTextureSize;
                        polygon.style.pointList.push(coords);
                    }
                    bundleShape.style.shapeList.push(polygon);
                }
            }
        },

        /**
         * Normalize geo coord to [0, 1]
         * @param  {Array.<number>} coords
         * @param  {Object} bbox   {left, top, width, height}
         * @private
         */
        _normalizeGeoCoord: function (coords, bbox) {
            coords = formatGeoPoint(coords);
            coords[0] = (coords[0] - bbox.left) / bbox.width;
            coords[1] = (coords[1] - bbox.top) / bbox.height;

            return coords;
        },

        _getMapBBox: function (mapData) {
            return (this._mapRootNode.__isFlatMap && ! mapData.mapType.match('world'))
                ? (mapData.bbox || normalProj.getBbox(mapData))
                : { top: 0, left: -180 + 168.5, width: 360, height: 180};
        },

        /**
         * Get label position of each polygon.
         * @param  {module:zrender/shape/Polygon} polygonShape
         * @return {Array.<number>}
         * @private
         */
        _getTextPosition: function (polygonShape) {
            var textPosition;
            var name = polygonShape.name;
            var textFixed = textFixedMap[name] || [0, 0];
            var size = this._baseTextureSize;
            if (geoCoordMap[name]) {
                textPosition = [
                    (geoCoordMap[name][0] + 180)  / 360 * size,
                    (90 - geoCoordMap[name][1]) / 180 * size
                ];
            }
            else if (polygonShape.cp) {
                textPosition = [
                    (polygonShape.cp[0] + textFixed[0] + 180) / 360 * size,
                    (90 - (polygonShape.cp[1] + textFixed[1])) / 180 * size
                ];
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
            }
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
            }
        },

        /**-
         * @param  {Array.<Object>} seriesGroup
         * @private
         */
        _initMapHandlers: function (seriesGroup) {
            var earthMesh = this._mapRootNode.queryNode('earth');

            var clickable = this.deepQuery(seriesGroup, 'clickable');
            var hoverable = this.deepQuery(seriesGroup, 'hoverable');

            var isFlatMap = this._mapRootNode.__isFlatMap;

            var mouseEventHandler = function (e) {
                // FIXME
                if (
                    e.type === zrConfig.EVENT.CLICK || e.type === zrConfig.EVENT.DBLCLICK
                ) {
                    if (! clickable) {
                        return;
                    }
                }
                // Hover Events
                else {
                    if (! hoverable) {
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
                }
                else {
                    var geo = this._eulerToGeographic(point.x, point.y, point.z);
                    x = (geo[0] + 180) / 360 * width;
                    y = (90 - geo[1]) / 180 * height;
                }

                var shape = this._globeSurface.hover(x, y);
                if (shape) {
                    // Trigger a global zr event to tooltip
                    this.zr.handler.dispatch(e.type, {
                        target: shape,
                        event: e.event,
                        type: e.type
                    });
                }
            }

            var eventList = ['CLICK', 'DBLCLICK', 'MOUSEOVER', 'MOUSEOUT', 'MOUSEMOVE'];

            eventList.forEach(function (eveName) {
                earthMesh.off(zrConfig.EVENT[eveName]);
                earthMesh.on(zrConfig.EVENT[eveName], mouseEventHandler, this);
            }, this);
        },

        _eulerToGeographic: function (x, y, z) {
            var theta = Math.asin(y);
            var phi = Math.atan2(z, -x);
            if (phi < 0) {
                phi = PI2  + phi;
            }

            var lat = theta * 180 / PI;
            var lon = phi * 180 / PI - 180;

            return [lon, lat];
        },

        _isValueNone: function (value) {
            return value == null || value === ''
                || (typeof value == 'string' && value.toLowerCase() == 'none');
        },

        _isValueImage: function (value) {
            return value instanceof HTMLCanvasElement
                || value instanceof HTMLImageElement
                || value instanceof Image;
        },

        /**
         * @param  {string} name
         * @param  {number} value
         * @param  {Array.<Object?} queryTarget
         * @param  {string} status 'normal' | 'emphasis'
         * @return {string}
         */
        _getMapLabelText : function (name, value, queryTarget, status) {
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

        /**
         * Zoom and rotate to focus on the shape
         */
        _focusOnShape: function (shape) {
            if (!shape) {
                return;
            }

            var mapRootNode = this._mapRootNode;
            var isFlatMap = mapRootNode.__isFlatMap;
            var surface = this._globeSurface;
            var w = surface.getWidth();
            var h = surface.getHeight();
            var r = this._earthRadius;

            function convertCoord(x, y) {
                x /= w;
                y /= h;

                if (! isFlatMap) {
                    var r0 = r * sin(y * PI);
                    return new Vector3(
                        -r0 * cos(x * PI2),
                        r * cos(y * PI),
                        r0 * sin(x * PI2)
                    );
                }
                else {
                    return new Vector3(
                        r * Math.PI * 2 * (x - 0.5),
                        0,
                        r * Math.PI * (0.5 - y)
                    )
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
                var center = new Vector3()
                    add(lt).add(rt).add(lb).add(rb).scale(0.25);

                this._mapRootNode.__control.moveTo({
                    position: center.negate(),
                    easing: 'CubicOut'
                });
            }
            else {
                // Z
                var normal = new Vector3()
                    .add(lt).add(rt).add(lb).add(rb).normalize();
                // Y
                var tangent = new Vector3();
                // X
                var bitangent = new Vector3();
                bitangent.cross(Vector3.UP, normal).normalize();
                tangent.cross(normal, bitangent).normalize();

                var rotation = new Quaternion().setAxes(
                    normal.negate(), bitangent, tangent
                ).invert();
                var self = this;

                this._mapRootNode.__control.rotateTo({
                    rotation: rotation,
                    easing: 'CubicOut',
                });
            }
        },

        // Overwrite getMarkCoord
        getMarkCoord: function (seriesIdx, data, point) {
            var isFlatMap = this._mapRootNode.__isFlatMap;
            var geoCoord = data.geoCoord || geoCoordMap[data.name];
            var coords = [];
            var serie = this.series[seriesIdx];
            var distance = this.deepQuery([
                data, serie.markPoint || serie.markLine || serie.markBar
            ], 'distance');
            coords[0] = geoCoord.x == null ? geoCoord[0] : geoCoord.x;
            coords[1] = geoCoord.y == null ? geoCoord[1] : geoCoord.y;

            var r = this._earthRadius;
            if (isFlatMap) {
                var bbox = this._getMapBBox(this._mapDataMap[serie.mapType]);
                coords = this._normalizeGeoCoord(coords, bbox);

                point._array[0] = (coords[0] - 0.5) * 2 * r * Math.PI;
                point._array[1] = (0.5 - coords[1]) * r * Math.PI;
                point._array[2] = distance;
            }
            else {
                var lon = coords[0];
                var lat = coords[1];

                lon = PI * lon / 180;
                lat = PI * lat / 180;

                r = r + distance;
                var r0 = cos(lat) * r;
                point._array[1] = sin(lat) * r;
                // TODO
                point._array[0] = -r0 * cos(lon + PI);
                point._array[2] = r0 * sin(lon + PI);
            }
        },

        // Overwrite getMarkPointTransform
        getMarkPointTransform: (function () {
            var xAxis = new Vector3();
            var yAxis = new Vector3();
            var zAxis = new Vector3();
            var position = new Vector3();
            return function (seriesIdx, data, matrix) {
                var isFlatMap = this._mapRootNode.__isFlatMap;
                var series = this.series[seriesIdx];
                var queryTarget = [data, series.markPoint];
                var symbolSize = this.deepQuery(queryTarget, 'symbolSize');
                var orientation = this.deepQuery(queryTarget, 'orientation');
                var orientationAngle = this.deepQuery(queryTarget, 'orientationAngle');

                this.getMarkCoord(seriesIdx, data, position);

                if (isFlatMap) {
                    Vector3.set(zAxis, 0, 0, 1);
                    Vector3.set(yAxis, 0, 1, 0);
                    Vector3.set(xAxis, 1, 0, 0);
                }
                else {
                    Vector3.normalize(zAxis, position);
                    Vector3.cross(xAxis, Vector3.UP, zAxis);
                    Vector3.normalize(xAxis, xAxis);
                    Vector3.cross(yAxis, zAxis, xAxis);
                }

                // Scaling
                if (!isNaN(symbolSize)) {
                    symbolSize = [symbolSize, symbolSize];
                }
                if (orientation === 'tangent') {
                    var tmp = zAxis;
                    zAxis = yAxis;
                    yAxis = tmp;
                    Vector3.negate(zAxis, zAxis);
                    // Move along y axis half size
                    Vector3.scaleAndAdd(position, position, yAxis, symbolSize[1]);
                }

                matrix.x = xAxis;
                matrix.y = yAxis;
                matrix.z = zAxis;
                Matrix4.rotateX(
                    // Rotate up if value is positive
                    matrix, matrix, -orientationAngle / 180 * PI
                );

                Matrix4.scale(
                    matrix, matrix, new Vector3(
                        symbolSize[0], symbolSize[1], 1
                    )
                )

                // Set the position
                var arr = matrix._array;
                arr[12] = position.x;
                arr[13] = position.y;
                arr[14] = position.z;
            };
        })(),

        // Overwrite getMarkBarPoints
        getMarkBarPoints: (function () {
            var normal = new Vector3();
            return function (seriesIdx, data, start, end) {
                var isFlatMap = this._mapRootNode.__isFlatMap;
                var barHeight = data.barHeight != null ? data.barHeight : 1;
                if (typeof(barHeight) == 'function') {
                    barHeight = barHeight(data);
                }
                this.getMarkCoord(seriesIdx, data, start);
                if (isFlatMap) {
                    Vector3.set(normal, 0, 0, 1);
                }
                else {
                    Vector3.copy(normal, start);
                    Vector3.normalize(normal, normal);   
                }
                Vector3.scaleAndAdd(end, start, normal, barHeight);
            };
        })(),

        // Overwrite getMarkLinePoints
        getMarkLinePoints: (function () {
            var normal = new Vector3();
            var tangent = new Vector3();
            var bitangent = new Vector3();
            var halfVector = new Vector3();
            return function (seriesIdx, data, p0, p1, p2, p3) {
                var isFlatMap = this._mapRootNode.__isFlatMap;
                var isCurve = !!p2;
                if (!isCurve) { // Mark line is not a curve
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
                    }
                    else {
                        // Get p1
                        normalize(normal, p0);
                        // TODO p0-p3 is parallel with normal
                        sub(tangent, p3, p0);
                        normalize(tangent, tangent);
                        cross(bitangent, tangent, normal);
                        normalize(bitangent, bitangent);
                        cross(tangent, normal, bitangent);
                        // p1 is half vector of p0 and tangent on p0
                        add(p1, normal, tangent);
                        normalize(p1, p1);

                        // Get p2
                        normalize(normal, p3);
                        sub(tangent, p0, p3);
                        normalize(tangent, tangent);
                        cross(bitangent, tangent, normal);
                        normalize(bitangent, bitangent);
                        cross(tangent, normal, bitangent);
                        // p2 is half vector of p3 and tangent on p3
                        add(p2, normal, tangent);
                        normalize(p2, p2);

                        // Project distance of p0 on halfVector
                        add(halfVector, p0, p3);
                        normalize(halfVector, halfVector);
                        var projDist = Vector3.dot(p0, halfVector);
                        // Angle of halfVector and p1
                        var cosTheta = Vector3.dot(halfVector, p1);
                        var len = (this._earthRadius - projDist) / cosTheta * 2;

                        scaleAndAdd(p1, p0, p1, len);
                        scaleAndAdd(p2, p3, p2, len);
                    }
                }
            }
        })(),

        // Overwrite onframe
        onframe: function (deltaTime) {
            if (! this._mapRootNode) {
                return;
            }

            ChartBase3D.prototype.onframe.call(this, deltaTime);

            this._mapRootNode.__control.update(deltaTime);

            for (var i = 0; i < this._vfParticleSurfaceList.length; i++) {
                this._vfParticleSurfaceList[i].update(Math.min(deltaTime / 1000, 0.5));
                this.zr.refreshNextFrame();
            }

            // Background
            if (this._skydome) {
                this._skydome.rotation.copy(this._mapRootNode.rotation);
            }
        },

        // Overwrite refresh
        refresh: function(newOption) {        
            // Browser not support WebGL
            if (! this.baseLayer.renderer) {
                return;
            }

            if (newOption) {
                this.option = newOption;
                this.series = newOption.series;
            }

            this._init();
        },

        // Overwrite ondataRange
        ondataRange: function (param, status) {
            if (this.component.dataRange) {
                this.refresh();
                this.zr.refreshNextFrame();
            }
        },

        // Overwrite dispose
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
    }

    zrUtil.inherits(Map3D, ChartBase3D);

    require('echarts/chart').define(ecConfig.CHART_TYPE_MAP3D, Map3D);

    return Map3D;
});