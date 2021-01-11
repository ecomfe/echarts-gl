// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import Map3DSeries from './Map3DSeries';
import Map3DView from './Map3DView';

import {install as installGeo3D} from '../../component/geo3D/install';

export function install(registers) {
    // Depends on geo3d
    installGeo3D(registers);

    registers.registerChartView(Map3DView);
    registers.registerSeriesModel(Map3DSeries);
    registers.registerAction({
        type: 'map3DChangeCamera',
        event: 'map3dcamerachanged',
        update: 'series:updateCamera'
    }, function (payload, ecModel) {
        ecModel.eachComponent({
            mainType: 'series', subType: 'map3D', query: payload
        }, function (componentModel) {
            componentModel.setView(payload);
        });
    });
}