import echarts from 'echarts/lib/echarts';

import './linesGL/LinesGLSeries';
import './linesGL/LinesGLView';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('linesGL'));