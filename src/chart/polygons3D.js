import echarts from 'echarts/lib/echarts';

import './polygons3D/Polygons3DSeries';
import './polygons3D/Polygons3DView';

import opacityVisual from './common/opacityVisual';

echarts.registerVisual(opacityVisual('polygons3D'));