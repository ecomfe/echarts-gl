/*
 * @module echarts-gl/core/ViewGL
 * @author Yi Shen(http://github.com/pissang)
 */

var Scene = require('qtek/lib/Scene');
var PerspectiveCamera = require('qtek/lib/camera/Perspective');
var OrthographicCamera = require('qtek/lib/camera/Orthographic');


/**
 * @constructor
 * @alias module:echarts-gl/core/ViewGL
 * @param {string} [cameraType='perspective']
 */
function ViewGL(cameraType) {

    cameraType = cameraType || 'perspective';

    /**
     * @type {module:echarts-gl/core/LayerGL}
     */
    this.layer = null;
    /**
     * @type {qtek.Scene}
     */
    this.scene = new Scene();

    this.viewport = {
        x: 0, y: 0, width: 0, height: 0
    };

    this.setCameraType(cameraType);

}

/**
 * Set camera type of group
 * @param {string} cameraType 'perspective' | 'orthographic'
 */
ViewGL.prototype.setCameraType = function (cameraType) {
    this.camera = cameraType === 'perspective'
        ? new PerspectiveCamera() : new OrthographicCamera();
};

/**
 * Set viewport of group
 * @param {number} x Viewport left bottom x
 * @param {number} y Viewport left bottom y
 * @param {number} width Viewport height
 * @param {number} height Viewport height
 */
ViewGL.prototype.setViewport = function (x, y, width, height) {
    if (this.camera instanceof PerspectiveCamera) {
        this.camera.aspect = width / height;
    }

    this.viewport.x = x;
    this.viewport.y = y;
    this.viewport.width = width;
    this.viewport.height = height;
};


/**
 * If contain screen point x, y
 */
ViewGL.prototype.containPoint = function (x, y) {
    var viewport = this.viewport;
    return x >= viewport.x && y >= viewport.y
        && x <= viewport.x + viewport.width && y <= viewport.y + viewport.height;
};

// Proxies
ViewGL.prototype.add = function (node3D) {
    this.scene.add(node3D);
};
ViewGL.prototype.remove = function (node3D) {
    this.scene.remove(node3D);
};
ViewGL.prototype.removeAll = function (node3D) {
    this.scene.removeAll(node3D);
};


module.exports = ViewGL;