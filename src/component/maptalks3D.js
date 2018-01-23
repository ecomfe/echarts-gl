// Thanks to https://gitee.com/iverson_hu/maptalks-echarts-gl

import echarts from 'echarts/lib/echarts';

import '../coord/maptalks3DCreator';

import './maptalks3D/Maptalks3DModel';
import './maptalks3D/Maptalks3DView';

echarts.registerAction({
    type: 'maptalks3DChangeCamera',
    event: 'maptalks3dcamerachanged',
    update: 'maptalks3D:updateCamera'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'maptalks3D', query: payload
    }, function (componentModel) {
        componentModel.setMaptalksCameraOption(payload);
    });
});