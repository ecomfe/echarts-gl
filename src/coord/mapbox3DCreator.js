import Mapbox3D from './mapbox3D/Mapbox3D';
import echarts from 'echarts/lib/echarts';
import createMapService3DCreator from './mapServiceCommon/createMapService3DCreator';

var mapbox3DCreator = createMapService3DCreator('mapbox3D', Mapbox3D, function (mapbox3DList) {
    mapbox3DList.forEach(function (mapbox3D) {
        mapbox3D.setCameraOption(mapbox3D.model.getMapboxCameraOption());
    });
});
echarts.registerCoordinateSystem('mapbox3D', mapbox3DCreator);

export default mapbox3DCreator;