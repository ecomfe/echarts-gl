// TODO ECharts GL must be imported whatever component,charts is imported.
import '../../echarts-gl';

import Polygons3DSeries from './Polygons3DSeries';
import Polygons3DView from './Polygons3DView';

export function install(registers) {
    registers.registerChartView(Polygons3DView);
    registers.registerSeriesModel(Polygons3DSeries);
}