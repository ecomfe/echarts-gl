import * as echarts from 'echarts/esm/echarts';
import Geo3D from '../coord/geo3D/Geo3D';

import './map3D/Map3DSeries';
import './map3D/Map3DView';

echarts.registerAction({
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