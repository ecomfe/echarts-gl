var echarts = require('echarts/lib/echarts');

require('./map3D/Map3DSeries');
require('./map3D/Map3DView');

require('../coord/geo3DCreator');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'map3D'
));