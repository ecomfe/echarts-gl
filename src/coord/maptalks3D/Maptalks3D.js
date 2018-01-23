import MapService3D from '../mapServiceCommon/MapService3D';

function Maptalks3D() {
    MapService3D.apply(this, arguments);

    this.maxPitch = 85;
    this.zoomOffset = 1;
}

Maptalks3D.prototype = new MapService3D();
Maptalks3D.prototype.constructor = Maptalks3D;
Maptalks3D.prototype.type = 'maptalks3D';

export default Maptalks3D;