var echarts = require('echarts/lib/echarts');

var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var LightHelper = require('../../component/common/LightHelper');
var Geo3DBuilder = require('../../component/common/Geo3DBuilder');

module.exports = echarts.extendChartView({

    type: 'map3D',

    __ecgl__: true,

    init: function (ecModel, api) {
        this._geo3DBuilder = new Geo3DBuilder(api);
        this.groupGL = new graphicGL.Node();

        this._lightHelper = new LightHelper(this.groupGL);

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();
    },

    render: function (map3DModel, ecModel, api) {
        this.groupGL.add(this._geo3DBuilder.rootNode);

        var geo3D = map3DModel.coordinateSystem;

        if (!geo3D || !geo3D.viewGL) {
            return;
        }
        geo3D.viewGL.add(this.groupGL);

        var control = this._control;
        control.setCamera(geo3D.viewGL.camera);

        var viewControlModel = map3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._lightHelper.updateLight(map3DModel);

        // Set post effect
        geo3D.viewGL.setPostEffect(map3DModel.getModel('postEffect'));
        geo3D.viewGL.setTemporalSuperSampling(map3DModel.getModel('temporalSuperSampling'));

        // Must update after geo3D.viewGL.setPostEffect
        this._geo3DBuilder.update(map3DModel, ecModel, api);

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
    },

    afterRender: function (map3DModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._lightHelper.updateAmbientCubemap(renderer, map3DModel, api);
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});