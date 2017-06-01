var echarts = require('echarts/lib/echarts');
var MapboxLayer = require('./MapboxLayer');
var SceneHelper = require('../common/SceneHelper');
var graphicGL = require('../../util/graphicGL');


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
        // Update lights
        this._sceneHelper.setScene(coordSys.viewGL.scene);
        this._sceneHelper.updateLight(mapboxModel);

        // Update post effects
        coordSys.viewGL.setPostEffect(mapboxModel.getModel('postEffect'), api);
        coordSys.viewGL.setTemporalSuperSampling(mapboxModel.getModel('temporalSuperSampling'));
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

        api.getZr().refresh();
    },

    dispose: function (ecModel, api) {
        api.getZr().delLayer(-1000);
    }
});