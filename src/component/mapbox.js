var echarts = require('echarts/lib/echarts');

require('../coord/mapboxCreator');

require('./mapbox/MapboxModel');
require('./mapbox/MapboxView');


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