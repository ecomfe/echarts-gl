import * as echarts from 'echarts/lib/echarts';
import Geo3DBuilder from '../../component/common/Geo3DBuilder';
import graphicGL from '../../util/graphicGL';

export default echarts.ChartView.extend({

    type: 'polygons3D',

    __ecgl__: true,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        this._geo3DBuilderList = [];

        this._currentStep = 0;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
        }

        var geo3DBuilder = this._geo3DBuilderList[0];
        if (!geo3DBuilder) {
            geo3DBuilder = new Geo3DBuilder(api);
            geo3DBuilder.extrudeY = coordSys.type !== 'mapbox3D'
                && coordSys.type !== 'maptalks3D';
            this._geo3DBuilderList[0] = geo3DBuilder;
        }
        this._updateShaderDefines(coordSys, geo3DBuilder);

        geo3DBuilder.update(seriesModel, ecModel, api);
        this._geo3DBuilderList.length = 1;

        this.groupGL.add(geo3DBuilder.rootNode);
    },

    incrementalPrepareRender: function (seriesModel, ecModel, api) {
        this.groupGL.removeAll();

        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
        }

        this._currentStep = 0;
    },

    incrementalRender: function (params, seriesModel, ecModel, api) {
        var geo3DBuilder = this._geo3DBuilderList[this._currentStep];
        var coordSys = seriesModel.coordinateSystem;
        if (!geo3DBuilder) {
            geo3DBuilder = new Geo3DBuilder(api);
            geo3DBuilder.extrudeY = coordSys.type !== 'mapbox3D'
                && coordSys.type !== 'maptalks3D';
            this._geo3DBuilderList[this._currentStep] = geo3DBuilder;
        }
        geo3DBuilder.update(seriesModel, ecModel, api, params.start, params.end);
        this.groupGL.add(geo3DBuilder.rootNode);

        this._updateShaderDefines(coordSys, geo3DBuilder);

        this._currentStep++;
    },

    _updateShaderDefines: function (coordSys, geo3DBuilder) {
        var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
        geo3DBuilder.rootNode.traverse(function (mesh) {
            if (mesh.material) {
                mesh.material[methodName]('fragment', 'SRGB_DECODE');

                // FIXME
                if (coordSys.type === 'mapbox3D' || coordSys.type === 'maptalks3D') {
                    mesh.material.define('fragment', 'NORMAL_UP_AXIS', 2);
                    mesh.material.define('fragment', 'NORMAL_FRONT_AXIS', 1);
                }
            }
        });
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
        this._geo3DBuilderList.forEach(function (geo3DBuilder) {
            geo3DBuilder.dispose();
        })
    }
});