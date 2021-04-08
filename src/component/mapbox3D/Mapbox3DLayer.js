/**
 * @constructor
 * @alias module:echarts-gl/component/mapbox3D/Mapbox3DLayer
 * @param {string} id Layer ID
 * @param {module:zrender/ZRender} zr
 */
function Mapbox3DLayer (id, zr) {
    this.id = id;
    this.zr = zr;

    this.dom = document.createElement('div');
    this.dom.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;';

    // FIXME If in module environment.
    if (!mapboxgl) {
        throw new Error('Mapbox GL library must be included. See https://www.mapbox.com/mapbox-gl-js/api/');
    }

    this._mapbox = new mapboxgl.Map({
        container: this.dom
    });

    // Proxy events
    this._initEvents();

}

Mapbox3DLayer.prototype.setUnpainted = function () {};
Mapbox3DLayer.prototype.resize = function () {
    this._mapbox.resize();
};

Mapbox3DLayer.prototype.getMapbox = function () {
    return this._mapbox;
};

Mapbox3DLayer.prototype.clear = function () {};
Mapbox3DLayer.prototype.refresh = function () {
    this._mapbox.resize();
};

var EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'mousemove',
    'mousewheel', 'wheel',
    'touchstart', 'touchend', 'touchmove', 'touchcancel'
];
Mapbox3DLayer.prototype._initEvents = function () {
    // Event is bound on canvas container.
    var mapboxRoot = this._mapbox.getCanvasContainer();
    this._handlers = this._handlers || {
        contextmenu: function (e) {
            e.preventDefault();
            return false;
        }
    };
    EVENTS.forEach(function (eName) {
        this._handlers[eName] = function (e) {
            var obj = {};
            for (var name in e) {
                obj[name] = e[name];
            }
            obj.bubbles = false;
            var newE = new e.constructor(e.type, obj);
            mapboxRoot.dispatchEvent(newE);
        };
        this.zr.dom.addEventListener(eName, this._handlers[eName]);
    }, this);

    // PENDING
    this.zr.dom.addEventListener('contextmenu', this._handlers.contextmenu);
};

Mapbox3DLayer.prototype.dispose = function () {
    EVENTS.forEach(function (eName) {
        this.zr.dom.removeEventListener(eName, this._handlers[eName]);
    }, this);
};

export default Mapbox3DLayer;