import * as echarts from 'echarts/esm/echarts';

import './linesGL/LinesGLSeries';
import './linesGL/LinesGLView';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('linesGL'));