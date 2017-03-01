var echarts = require('echarts/lib/echarts');

require('./map3D/Map3DSeries');
require('./map3D/Map3DView');

require('../coord/geo3DCreator');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'map3D'
));

echarts.registerAction({
    type: 'map3DChangeView',
    event: 'map3dviewchanged',
    update: 'none'
}, function (payload, ecModel) {
    ecModel.eachComponent({
        mainType: 'series', subType: 'map3D', query: payload
    }, function (componentModel) {
        componentModel.setView(payload);
    });
});