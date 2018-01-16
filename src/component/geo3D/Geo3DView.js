import Geo3DBuilder from '../common/Geo3DBuilder';
import echarts from 'echarts/lib/echarts';

import graphicGL from '../../util/graphicGL';
import OrbitControl from '../../util/OrbitControl';
import SceneHelper from '../common/SceneHelper';

export default echarts.extendComponentView({

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
        control.setViewGL(geo3D.viewGL);

        var viewControlModel = geo3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._sceneHelper.setScene(geo3D.viewGL.scene);
        this._sceneHelper.updateLight(geo3DModel);

        // Set post effect
        geo3D.viewGL.setPostEffect(geo3DModel.getModel('postEffect'), api);
        geo3D.viewGL.setTemporalSuperSampling(geo3DModel.getModel('temporalSuperSampling'));

        // Must update after geo3D.viewGL.setPostEffect
        this._geo3DBuilder.update(geo3DModel, ecModel, api, 0, geo3DModel.getData().count());
        var srgbDefineMethod = geo3D.viewGL.isLinearSpace() ? 'define' : 'undefine';
        this._geo3DBuilder.rootNode.traverse(function (mesh) {
            if (mesh.material) {
                mesh.material[srgbDefineMethod]('fragment', 'SRGB_DECODE');
            }
        });

        control.off('update');
        control.on('update', function () {
            api.dispatchAction({
                type: 'geo3DChangeCamera',
                alpha: control.getAlpha(),
                beta: control.getBeta(),
                distance: control.getDistance(),
                center: control.getCenter(),
                from: this.uid,
                geo3DId: geo3DModel.id
            });
        });
        control.update();
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