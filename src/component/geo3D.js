var echarts = require('echarts/lib/echarts');

require('./geo3D/Geo3DModel');
require('./geo3D/Geo3DView');

require('../coord/geo3DCreator');

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