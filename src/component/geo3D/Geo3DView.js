var Geo3DBuilder = require('../common/Geo3DBuilder');
var echarts = require('echarts/lib/echarts');

var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var SceneHelper = require('../common/SceneHelper');

module.exports = echarts.extendComponentView({

    type: 'geo3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this._geo3DBuilder = new Geo3DBuilder(api);
        this.groupGL = new graphicGL.Node();

        this._lightRoot = new graphicGL.Node();
        this._sceneHelper = new SceneHelper(this._lightRoot);
        this._sceneHelper.initLight(this._lightRoot);

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();
    },

    render: function (geo3DModel, ecModel, api) {
        this.groupGL.add(this._geo3DBuilder.rootNode);

        var geo3D = geo3DModel.coordinateSystem;

        if (!geo3D || !geo3D.viewGL) {
            return;
        }

        // Always have light.
        geo3D.viewGL.add(this._lightRoot);

        if (geo3DModel.get('show')) {
            geo3D.viewGL.add(this.groupGL);
        }
        else {
            geo3D.viewGL.remove(this.groupGL);
        }

        var control = this._control;
        control.setCamera(geo3D.viewGL.camera);
        control.setViewGL(geo3D.viewGL);

        var viewControlModel = geo3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._sceneHelper.setScene(geo3D.viewGL.scene);
        this._sceneHelper.updateLight(geo3DModel);

        // Set post effect
        geo3D.viewGL.setPostEffect(geo3DModel.getModel('postEffect'));
        geo3D.viewGL.setTemporalSuperSampling(geo3DModel.getModel('temporalSuperSampling'));

        // Must update after geo3D.viewGL.setPostEffect
        this._geo3DBuilder.update(geo3DModel, ecModel, api);

        var silent = geo3DModel.get('silent');
        this.groupGL && this.groupGL.traverse(function (mesh) {
            if (mesh.isRenderable && mesh.isRenderable()) {
                mesh.ignorePicking = mesh.$ignorePicking != null
                    ? mesh.$ignorePicking : silent;
            }
        });

        control.off('update');
        control.on('update', function () {
            api.dispatchAction({
                type: 'geo3DChangeCamera',
                alpha: control.getAlpha(),
                beta: control.getBeta(),
                distance: control.getDistance(),
                from: this.uid,
                geo3DId: geo3DModel.id
            });
        });
    },

    afterRender: function (geo3DModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._sceneHelper.updateAmbientCubemap(renderer, geo3DModel, api);

        this._sceneHelper.updateSkybox(renderer, geo3DModel, api);
    },

    dispose: function () {
        this._control.dispose();
    }
});