var echarts = require('echarts/lib/echarts');

require('./globe/GlobeModel');
require('./globe/GlobeView');

require('../coord/globeCreator');

echarts.registerAction({
    type: 'globeChangeView',
    event: 'globeviewchanged',
    update: 'none'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'globe', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});