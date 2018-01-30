import echarts from 'echarts/lib/echarts';
import Mapbox3DLayer from './Mapbox3DLayer';
import SceneHelper from '../common/SceneHelper';
import graphicGL from '../../util/graphicGL';

import displayShadowGLSL from '../../util/shader/displayShadow.glsl.js';

graphicGL.Shader.import(displayShadowGLSL);

var TILE_SIZE = 512;

export default echarts.extendComponentView({

    type: 'mapbox3D',

    __ecgl__: true,

    init: function (ecModel, api) {
        var zr = api.getZr();
        this._zrLayer = new Mapbox3DLayer('mapbox3D', zr);
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

    render: function (mapbox3DModel, ecModel, api) {
        var mapbox = this._zrLayer.getMapbox();
        var styleDesc = mapbox3DModel.get('style');

        var styleStr = JSON.stringify(styleDesc);
        if (styleStr !== this._oldStyleStr) {
            if (styleDesc) {
                mapbox.setStyle(styleDesc);
            }
        }
        this._oldStyleStr = styleStr;

        mapbox.setCenter(mapbox3DModel.get('center'));
        mapbox.setZoom(mapbox3DModel.get('zoom'));
        mapbox.setPitch(mapbox3DModel.get('pitch'));
        mapbox.setBearing(mapbox3DModel.get('bearing'));

        mapbox3DModel.setMapbox(mapbox);

        var coordSys = mapbox3DModel.coordinateSystem;

        // Not add to rootNode. Or light direction will be stretched by rootNode scale
        coordSys.viewGL.scene.add(this._lightRoot);
        coordSys.viewGL.add(this._groundMesh);

        this._updateGroundMesh();

        // Update lights
        this._sceneHelper.setScene(coordSys.viewGL.scene);
        this._sceneHelper.updateLight(mapbox3DModel);

        // Update post effects
        coordSys.viewGL.setPostEffect(mapbox3DModel.getModel('postEffect'), api);
        coordSys.viewGL.setTemporalSuperSampling(mapbox3DModel.getModel('temporalSuperSampling'));

        this._mapbox3DModel = mapbox3DModel;
    },

    afterRender: function (mapbox3DModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._sceneHelper.updateAmbientCubemap(renderer, mapbox3DModel, api);
        this._sceneHelper.updateSkybox(renderer, mapbox3DModel, api);

        // FIXME If other series changes coordinate system.
        // FIXME When doing progressive rendering.
        mapbox3DModel.coordinateSystem.viewGL.scene.traverse(function (mesh) {
            if (mesh.material) {
                mesh.material.define('fragment', 'NORMAL_UP_AXIS', 2);
                mesh.material.define('fragment', 'NORMAL_FRONT_AXIS', 1);
            }
        });
    },

    updateCamera: function (mapbox3DModel, ecModel, api, payload) {
        mapbox3DModel.coordinateSystem.setCameraOption(payload);

        this._updateGroundMesh();

        api.getZr().refresh();
    },

    _dispatchInteractAction: function (api, mapbox, mapbox3DModel) {
        api.dispatchAction({
            type: 'mapbox3DChangeCamera',
            pitch: mapbox.getPitch(),
            zoom: mapbox.getZoom(),
            center: mapbox.getCenter().toArray(),
            bearing: mapbox.getBearing(),
            mapbox3DId: this._mapbox3DModel && this._mapbox3DModel.id
        });
    },

    _updateGroundMesh: function () {
        if (this._mapbox3DModel) {
            var coordSys = this._mapbox3DModel.coordinateSystem;
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
        if (this._zrLayer) {
            this._zrLayer.dispose();
        }
        api.getZr().painter.delLayer(-1000);
    }
});