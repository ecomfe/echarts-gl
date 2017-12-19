import echarts from 'echarts/lib/echarts';

import './surface/SurfaceSeries';
import './surface/SurfaceView';
import './surface/surfaceLayout';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('surface'));
