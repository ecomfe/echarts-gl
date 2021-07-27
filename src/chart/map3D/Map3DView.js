import * as echarts from 'echarts/lib/echarts';

import graphicGL from '../../util/graphicGL';
import OrbitControl from '../../util/OrbitControl';
import SceneHelper from '../../component/common/SceneHelper';
import Geo3DBuilder from '../../component/common/Geo3DBuilder';

export default echarts.ChartView.extend({

    type: 'map3D',

    __ecgl__: true,

    init: function (ecModel, api) {
        this._geo3DBuilder = new Geo3DBuilder(api);
        this.groupGL = new graphicGL.Node();
    },

    render: function (map3DModel, ecModel, api) {

        var coordSys = map3DModel.coordinateSystem;

        if (!coordSys || !coordSys.viewGL) {
            return;
        }

        this.groupGL.add(this._geo3DBuilder.rootNode);
        coordSys.viewGL.add(this.groupGL);

        var geo3D;
        if (coordSys.type === 'geo3D') {
            geo3D = coordSys;

            if (!this._sceneHelper) {
                this._sceneHelper = new SceneHelper();
                this._sceneHelper.initLight(this.groupGL);
            }

            this._sceneHelper.setScene(coordSys.viewGL.scene);
            this._sceneHelper.updateLight(map3DModel);

            // Set post effect
            coordSys.viewGL.setPostEffect(map3DModel.getModel('postEffect'), api);
            coordSys.viewGL.setTemporalSuperSampling(map3DModel.getModel('temporalSuperSampling'));

            var control = this._control;
            if (!control) {
                control = this._control = new OrbitControl({
                    zr: api.getZr()
                });
                this._control.init();
            }
            var viewControlModel = map3DModel.getModel('viewControl');
            control.setViewGL(coordSys.viewGL);
            control.setFromViewControlModel(viewControlModel, 0);

            control.off('update');
            control.on('update', function () {
                api.dispatchAction({
                    type: 'map3DChangeCamera',
                    alpha: control.getAlpha(),
                    beta: control.getBeta(),
                    distance: control.getDistance(),
                    from: this.uid,
                    map3DId: map3DModel.id
                });
            });

            this._geo3DBuilder.extrudeY = true;
        }
        else {
            if (this._control) {
                this._control.dispose();
                this._control = null;
            }
            if (this._sceneHelper) {
                this._sceneHelper.dispose();
                this._sceneHelper = null;
            }
            geo3D = map3DModel.getData().getLayout('geo3D');

            this._geo3DBuilder.extrudeY = false;
        }

        this._geo3DBuilder.update(map3DModel, ecModel, api, 0, map3DModel.getData().count());


        // Must update after geo3D.viewGL.setPostEffect to determine linear space
        var srgbDefineMethod = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
        this._geo3DBuilder.rootNode.traverse(function (mesh) {
            if (mesh.material) {
                mesh.material[srgbDefineMethod]('fragment', 'SRGB_DECODE');
            }
        });
    },

    afterRender: function (map3DModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        var coordSys = map3DModel.coordinateSystem;
        if (coordSys && coordSys.type === 'geo3D') {
            this._sceneHelper.updateAmbientCubemap(renderer, map3DModel, api);
            this._sceneHelper.updateSkybox(renderer, map3DModel, api);
        }
    },

    dispose: function () {
        this.groupGL.removeAll();
        this._control.dispose();
        this._geo3DBuilder.dispose();
    }
});