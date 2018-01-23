import MapService3D from '../mapServiceCommon/MapService3D';

function Mapbox3D() {
    MapService3D.apply(this, arguments);
}

Mapbox3D.prototype = new MapService3D();
Mapbox3D.prototype.constructor = Mapbox3D;
Mapbox3D.prototype.type = 'mapbox3D';

export default Mapbox3D;