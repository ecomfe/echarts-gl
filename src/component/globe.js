import echarts from 'echarts/lib/echarts';

import './globe/GlobeModel';
import './globe/GlobeView';

import '../coord/globeCreator';

echarts.registerAction({
    type: 'globeChangeCamera',
    event: 'globecamerachanged',
    update: 'series:updateCamera'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'globe', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});

echarts.registerAction({
    type: 'globeUpdateDisplacment',
    event: 'globedisplacementupdated',
    update: 'update'
}, function (payload, ecModel) {
    // Noop
});