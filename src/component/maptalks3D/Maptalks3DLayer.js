/**
 * @constructor
 * @alias module:echarts-gl/component/maptalks/Maptalks3DLayer
 * @param {string} id Layer ID
 * @param {module:zrender/ZRender} zr
 */
function Maptalks3DLayer (id, zr, defaultCenter, defaultZoom) {
    this.id = id;
    this.zr = zr;

    this.dom = document.createElement('div');
    this.dom.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;';

    // FIXME If in module environment.
    if (!maptalks) {
        throw new Error('Maptalks library must be included. See https://maptalks.org');
    }

    this._maptalks = new maptalks.Map(this.dom, {
        center: defaultCenter,
        zoom: defaultZoom,
        doubleClickZoom:false,
        fog: false
        // fogColor: [0, 0, 0]
    });

    // Proxy events
    this._initEvents();

}

Maptalks3DLayer.prototype.resize = function () {
    this._maptalks.checkSize();
};

Maptalks3DLayer.prototype.getMaptalks = function () {
    return this._maptalks;
};

Maptalks3DLayer.prototype.clear = function () {};
Maptalks3DLayer.prototype.refresh = function () {
    this._maptalks.checkSize();
};

var EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'mousemove',
    'mousewheel', 'DOMMouseScroll',
    'touchstart', 'touchend', 'touchmove', 'touchcancel'
];
Maptalks3DLayer.prototype._initEvents = function () {
    // Event is bound on canvas container.
    var maptalksRoot = this.dom;
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
            if (eName === 'mousewheel' || eName === 'DOMMouseScroll') {
                // maptalks listens events to different elements?
                maptalksRoot.dispatchEvent(newE);
            }
            else {
                maptalksRoot.firstElementChild.dispatchEvent(newE);
            }
        };
        this.zr.dom.addEventListener(eName, this._handlers[eName]);
    }, this);

    // PENDING
    this.zr.dom.addEventListener('contextmenu', this._handlers.contextmenu);
};

Maptalks3DLayer.prototype.dispose = function () {
    EVENTS.forEach(function (eName) {
        this.zr.dom.removeEventListener(eName, this._handlers[eName]);
    }, this);
    this._maptalks.remove();
};

export default Maptalks3DLayer;
