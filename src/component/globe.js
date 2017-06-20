var echarts = require('echarts/lib/echarts');

require('./globe/GlobeModel');
require('./globe/GlobeView');

require('../coord/globeCreator');

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
    update: 'updateLayout'
}, function (payload, ecModel) {
    // Noop
});