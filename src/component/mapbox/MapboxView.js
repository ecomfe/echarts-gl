var echarts = require('echarts/lib/echarts');
var MapboxLayer = require('./MapboxLayer');
var SceneHelper = require('../common/SceneHelper');
var graphicGL = require('../../util/graphicGL');

graphicGL.Shader.import(require('../../util/shader/displayShadow.glsl.js'));

var TILE_SIZE = 512;

module.exports = echarts.extendComponentView({

    type: 'mapbox',

    __ecgl__: true,

    init: function (ecModel, api) {
        var zr = api.getZr();
        this._zrLayer = new MapboxLayer('mapbox', zr);
        zr.painter.insertLayer(-1000, this._zrLayer);

        this._lightRoot = new graphicGL.Node();
        this._sceneHelper = new SceneHelper(this._lightRoot);
        this._sceneHelper.initLight(this._lightRoot);

        var mapbox = this._zrLayer.getMapbox();
        var dispatchInteractAction = this._dispatchInteractAction.bind(this, api, mapbox);

        // PENDING
        ['zoom', 'rotate', 'drag', 'pitch', 'rotate', 'move'].forEach(function (eName) {
            mapbox.on(eName, dispatchInteractAction);
        });

        this._groundMesh = new graphicGL.Mesh({
            geometry: new graphicGL.PlaneGeometry(),
            material: new graphicGL.Material({
                shader: new graphicGL.Shader({
                    vertex: graphicGL.Shader.source('ecgl.displayShadow.vertex'),
                    fragment: graphicGL.Shader.source('ecgl.displayShadow.fragment')
                }),
                depthMask: false
            }),
            // Render first
            frustumCulling: false,
            renderOrder: -100,
            culling: false,
            castShadow: false,
            $ignorePicking: true,
            renderNormal: true
        });
        this._groundMesh.scale.set(1e3, 1e3, 1);
    },

    render: function (mapboxModel, ecModel, api) {
        var mapbox = this._zrLayer.getMapbox();
        var styleDesc = mapboxModel.get('style');
        if (styleDesc) {
            mapbox.setStyle(styleDesc);
        }

        mapbox.setCenter(mapboxModel.get('center'));
        mapbox.setZoom(mapboxModel.get('zoom'));
        mapbox.setPitch(mapboxModel.get('pitch'));
        mapbox.setBearing(mapboxModel.get('bearing'));

        mapboxModel.setMapbox(mapbox);

        var coordSys = mapboxModel.coordinateSystem;

        coordSys.viewGL.scene.add(this._lightRoot);
        coordSys.viewGL.scene.add(this._groundMesh);

        this._updateGroundMeshPosition();
        
        // Update lights
        this._sceneHelper.setScene(coordSys.viewGL.scene);
        this._sceneHelper.updateLight(mapboxModel);

        // Update post effects
        coordSys.viewGL.setPostEffect(mapboxModel.getModel('postEffect'), api);
        coordSys.viewGL.setTemporalSuperSampling(mapboxModel.getModel('temporalSuperSampling'));

        this._mapboxModel = mapboxModel;
    },

    afterRender: function (mapboxModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._sceneHelper.updateAmbientCubemap(renderer, mapboxModel, api);
        this._sceneHelper.updateSkybox(renderer, mapboxModel, api);
    },

    updateCamera: function (mapboxModel, ecModel, api, payload) {
        mapboxModel.coordinateSystem.setCameraOption(payload);
    },

    _dispatchInteractAction: function (api, mapbox) {
        api.dispatchAction({
            type: 'mapboxChangeCamera',
            pitch: mapbox.getPitch(),
            zoom: mapbox.getZoom(),
            center: mapbox.getCenter().toArray(),
            bearing: mapbox.getBearing()
        });

        this._updateGroundMeshPosition();

        api.getZr().refresh();
    },

    _updateGroundMeshPosition: function () {
        if (this._mapboxModel) {
            var coordSys = this._mapboxModel.coordinateSystem;
            var pt = coordSys.projectOnTileWithScale(coordSys.center, TILE_SIZE);
            this._groundMesh.position.set(pt[0], pt[1], -0.01);
        }
    },

    dispose: function (ecModel, api) {
        api.getZr().delLayer(-1000);
    }
});