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
            renderOrder: -100,
            culling: false,
            castShadow: false,
            $ignorePicking: true,
            renderNormal: true
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

        // Not add to rootNode. Or light direction will be stretched by rootNode scale
        coordSys.viewGL.scene.add(this._lightRoot);
        coordSys.viewGL.add(this._groundMesh);

        this._updateGroundMesh();
        
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

        // FIXME If other series changes coordinate system.
        mapboxModel.coordinateSystem.viewGL.scene.traverse(function (mesh) {
            if (mesh.material) {
                mesh.material.shader.define('fragment', 'NORMAL_UP_AXIS', 2);
                mesh.material.shader.define('fragment', 'NORMAL_FRONT_AXIS', 1);
            }
        });
    },

    updateCamera: function (mapboxModel, ecModel, api, payload) {
        mapboxModel.coordinateSystem.setCameraOption(payload);

        this._updateGroundMesh();

        api.getZr().refresh();
    },

    _dispatchInteractAction: function (api, mapbox, mapboxModel) {
        api.dispatchAction({
            type: 'mapboxChangeCamera',
            pitch: mapbox.getPitch(),
            zoom: mapbox.getZoom(),
            center: mapbox.getCenter().toArray(),
            bearing: mapbox.getBearing(),
            mapboxId: this._mapboxModel && this._mapboxModel.id
        });
    },

    _updateGroundMesh: function () {
        if (this._mapboxModel) {
            var coordSys = this._mapboxModel.coordinateSystem;
            var pt = coordSys.dataToPoint(coordSys.center);
            this._groundMesh.position.set(pt[0], pt[1], -0.001);

            var plane = new graphicGL.Plane(new graphicGL.Vector3(0, 0, 1), 0);
            var ray1 = coordSys.viewGL.camera.castRay(new graphicGL.Vector2(-1, -1));
            var ray2 = coordSys.viewGL.camera.castRay(new graphicGL.Vector2(1, 1));
            var pos0 = ray1.intersectPlane(plane);
            var pos1 = ray2.intersectPlane(plane);
            var scale = pos0.dist(pos1) / coordSys.viewGL.rootNode.scale.x;
            this._groundMesh.scale.set(scale, scale, 1);
        }
    },

    dispose: function (ecModel, api) {
        api.getZr().delLayer(-1000);
    }
});