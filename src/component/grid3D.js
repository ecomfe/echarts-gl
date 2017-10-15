import './grid3D/Axis3DModel';
import './grid3D/Grid3DModel';
import './grid3D/Grid3DView';

import '../coord/grid3DCreator';

import echarts from 'echarts/lib/echarts';
echarts.registerAction({
    type: 'grid3DChangeCamera',
    event: 'grid3dcamerachanged',
    update: 'series:updateCamera'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'grid3D', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});

echarts.registerAction({
    type: 'grid3DShowAxisPointer',
    event: 'grid3dshowaxispointer',
    update: 'grid3D:showAxisPointer'
}, function (payload, ecModel) {
});

echarts.registerAction({
    type: 'grid3DHideAxisPointer',
    event: 'grid3dhideaxispointer',
    update: 'grid3D:hideAxisPointer'
}, function (payload, ecModel) {
});