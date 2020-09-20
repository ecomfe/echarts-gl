import * as echarts from 'echarts/esm/echarts';

import './surface/SurfaceSeries';
import './surface/SurfaceView';
import './surface/surfaceLayout';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('surface'));
