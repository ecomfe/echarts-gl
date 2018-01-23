import Maptalks3D from './maptalks3D/Maptalks3D';
import echarts from 'echarts/lib/echarts';
import createMapService3DCreator from './mapServiceCommon/createMapService3DCreator';

var maptalks3DCreator = createMapService3DCreator('maptalks3D', Maptalks3D, function (maptalks3DList) {
    maptalks3DList.forEach(function (maptalks3D) {
        maptalks3D.setCameraOption(maptalks3D.model.getMaptalksCameraOption());
    });
});
echarts.registerCoordinateSystem('maptalks3D', maptalks3DCreator);

export default maptalks3DCreator;