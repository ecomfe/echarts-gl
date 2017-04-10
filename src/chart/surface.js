var echarts = require('echarts/lib/echarts');

require('./surface/SurfaceSeries');
require('./surface/SurfaceView');
require('./surface/surfaceLayout');

echarts.registerVisual(echarts.util.curry(
    require('./common/opacityVisual'), 'surface'
));
