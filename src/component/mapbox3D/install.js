// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import Mapbox3DModel from './Mapbox3DModel';
import Mapbox3DView from './Mapbox3DView';
import mapbox3DCreator from '../../coord/mapbox3DCreator';

export function install(registers) {
    registers.registerComponentModel(Mapbox3DModel);
    registers.registerComponentView(Mapbox3DView);

    registers.registerCoordinateSystem('mapbox3D', mapbox3DCreator);

    registers.registerAction({
        type: 'mapbox3DChangeCamera',
        event: 'mapbox3dcamerachanged',
        update: 'mapbox3D:updateCamera'
    }, function (payload, ecModel) {
        ecModel.eachComponent({
            mainType: 'mapbox3D', query: payload
        }, function (componentModel) {
            componentModel.setMapboxCameraOption(payload);
        });
    });
}