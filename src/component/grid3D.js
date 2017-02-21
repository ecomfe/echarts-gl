require('./grid3D/Axis3DModel');
require('./grid3D/Grid3DModel');
require('./grid3D/Grid3DView');

require('../coord/grid3DCreator');

var echarts = require('echarts/lib/echarts');
echarts.registerAction({
    type: 'grid3DUpdateCamera',
    event: 'grid3dupdatecamera',
    update: 'none'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'grid3D', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});