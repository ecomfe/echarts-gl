import echarts from 'echarts/lib/echarts';

import '../coord/mapboxCreator';

import './mapbox/MapboxModel';
import './mapbox/MapboxView';


echarts.registerAction({
    type: 'mapboxChangeCamera',
    event: 'mapboxcamerachanged',
    update: 'mapbox:updateCamera'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'mapbox', query: payload
    }, function (componentModel) {
        componentModel.setMapboxCameraOption(payload);
    });
});