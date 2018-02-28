import echarts from 'echarts/lib/echarts';
import Maptalks3DLayer from './Maptalks3DLayer';
import SceneHelper from '../common/SceneHelper';
import graphicGL from '../../util/graphicGL';

import displayShadowGLSL from '../../util/shader/displayShadow.glsl.js';

graphicGL.Shader.import(displayShadowGLSL);

export default echarts.extendComponentView({

    type: 'maptalks3D',

    __ecgl__: true,

    init: function (ecModel, api) {
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

    _initMaptalksLayer: function (mapbox3DModel, api) {
        var zr = api.getZr();
        this._zrLayer = new Maptalks3DLayer('maptalks3D', zr, mapbox3DModel.get('center'), mapbox3DModel.get('zoom'));
        zr.painter.insertLayer(-1000, this._zrLayer);

        this._lightRoot = new graphicGL.Node();
        this._sceneHelper = new SceneHelper(this._lightRoot);
        this._sceneHelper.initLight(this._lightRoot);

        var maptalks = this._zrLayer.getMaptalks();
        var dispatchInteractAction = this._dispatchInteractAction.bind(this, api, maptalks);

        // PENDING
        ['zoomend', 'zooming', 'zoomstart', 'dragrotating', 'pitch', 'pitchend', 'movestart',
            'moving', 'moveend', 'resize', 'touchstart', 'touchmove', 'touchend'].forEach(function (eName) {
            maptalks.on(eName, dispatchInteractAction);
        });

    },

    render: function (maptalks3DModel, ecModel, api) {
        if (!this._zrLayer) {
            this._initMaptalksLayer(maptalks3DModel, api);
        }

        var mtks = this._zrLayer.getMaptalks();
        var urlTemplate = maptalks3DModel.get('urlTemplate');

        var baseLayer = mtks.getBaseLayer();
        if (urlTemplate !== this._oldUrlTemplate) {
            if (!baseLayer) {
                baseLayer = new maptalks.TileLayer('maptalks-echarts-gl-baselayer', {
                    urlTemplate: urlTemplate,
                    // used sequentially to help with browser parallel requests per domain limitation
                    subdomains: ['a', 'b', 'c'],
                    attribution: maptalks3DModel.get('attribution')
                });
                mtks.setBaseLayer(baseLayer);
            }
            else {
                // PENDING setOptions may not work?
                baseLayer.setOptions({
                    urlTemplate: urlTemplate,
                    attribution: maptalks3DModel.get('attribution')
                });
            }
        }
        this._oldUrlTemplate = urlTemplate;

        mtks.setCenter(maptalks3DModel.get('center'));
        mtks.setZoom(maptalks3DModel.get('zoom'),{ animation: false });
        mtks.setPitch(maptalks3DModel.get('pitch'));
        mtks.setBearing(maptalks3DModel.get('bearing'));

        maptalks3DModel.setMaptalks(mtks);

        var coordSys = maptalks3DModel.coordinateSystem;

        // Not add to rootNode. Or light direction will be stretched by rootNode scale
        coordSys.viewGL.scene.add(this._lightRoot);
        coordSys.viewGL.add(this._groundMesh);

        this._updateGroundMesh();

        // Update lights
        this._sceneHelper.setScene(coordSys.viewGL.scene);
        this._sceneHelper.updateLight(maptalks3DModel);

        // Update post effects
        coordSys.viewGL.setPostEffect(maptalks3DModel.getModel('postEffect'), api);
        coordSys.viewGL.setTemporalSuperSampling(maptalks3DModel.getModel('temporalSuperSampling'));

        this._maptalks3DModel = maptalks3DModel;
    },

    afterRender: function (maptalks3DModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._sceneHelper.updateAmbientCubemap(renderer, maptalks3DModel, api);
        this._sceneHelper.updateSkybox(renderer, maptalks3DModel, api);

        // FIXME If other series changes coordinate system.
        // FIXME When doing progressive rendering.
        maptalks3DModel.coordinateSystem.viewGL.scene.traverse(function (mesh) {
            if (mesh.material) {
                mesh.material.define('fragment', 'NORMAL_UP_AXIS', 2);
                mesh.material.define('fragment', 'NORMAL_FRONT_AXIS', 1);
            }
        });
    },

    updateCamera: function (maptalks3DModel, ecModel, api, payload) {
        maptalks3DModel.coordinateSystem.setCameraOption(payload);

        this._updateGroundMesh();

        api.getZr().refresh();
    },

    _dispatchInteractAction: function (api, maptalks, maptalks3DModel) {
        api.dispatchAction({
            type: 'maptalks3DChangeCamera',
            pitch: maptalks.getPitch(),
            zoom: maptalks.getZoom(),
            center: maptalks.getCenter().toArray(),
            bearing: maptalks.getBearing(),
            maptalks3DId: this._maptalks3DModel && this._maptalks3DModel.id
        });
    },

    _updateGroundMesh: function () {
        if (this._maptalks3DModel) {
            var coordSys = this._maptalks3DModel.coordinateSystem;
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