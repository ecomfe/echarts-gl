require('./geo3D/Geo3DModel');
require('./geo3D/Geo3DView');

require('../coord/geo3DCreator');

echarts.registerAction({
    type: 'geo3DChangeView',
    event: 'geo3dviewchanged',
    update: 'none'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'geo3D', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});