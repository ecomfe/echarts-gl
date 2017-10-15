import echarts from 'echarts/lib/echarts';

import './geo3D/Geo3DModel';
import './geo3D/Geo3DView';

import '../coord/geo3DCreator';

echarts.registerAction({
    type: 'geo3DChangeCamera',
    event: 'geo3dcamerachanged',
    update: 'series:updateCamera'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'geo3D', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});