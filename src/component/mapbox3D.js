import echarts from 'echarts/lib/echarts';

import '../coord/mapbox3DCreator';

import './mapbox3D/Mapbox3DModel';
import './mapbox3D/Mapbox3DView';


echarts.registerAction({
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