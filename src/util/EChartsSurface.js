/**
 * Surface texture in the 3D scene.
 * Provide management and rendering of zrender shapes and groups
 *
 * @module echarts-gl/util/EChartsSurface
 * @author Yi Shen(http://github.com/pissang)
 */

import Texture2D from 'claygl/src/Texture2D';
import Vector3 from 'claygl/src/math/Vector3';
import Vector2 from 'claygl/src/math/Vector2';

var events = ['mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'click', 'dblclick', 'contextmenu'];

function makeHandlerName(eventName) {
    return '_on' + eventName;
}
/**
 * @constructor
 * @alias echarts-gl/util/EChartsSurface
 * @param {module:echarts~ECharts} chart
 */
var EChartsSurface = function (chart) {
    var self = this;
    this._texture = new Texture2D({
        anisotropic: 32,
        flipY: false,

        surface: this,

        dispose: function (renderer) {
            self.dispose();
            Texture2D.prototype.dispose.call(this, renderer);
        }
    });

    events.forEach(function (eventName) {
        this[makeHandlerName(eventName)] = function (eveObj) {
            if (!eveObj.triangle) {
                return;
            }
            this._meshes.forEach(function (mesh) {
                this.dispatchEvent(eventName, mesh, eveObj.triangle, eveObj.point);
            }, this);
        };
    }, this);

    this._meshes = [];

    if (chart) {
        this.setECharts(chart);
    }

    // Texture updated callback;
    this.onupdate = null;
};

EChartsSurface.prototype = {

    constructor: EChartsSurface,

    getTexture: function () {
        return this._texture;
    },

    setECharts: function (chart) {
        this._chart = chart;

        var canvas = chart.getDom();
        if (!(canvas instanceof HTMLCanvasElement)) {
            console.error('ECharts must init on canvas if it is used as texture.');
            // Use an empty canvas
            canvas = document.createElement('canvas');
        }
        else {
            var self = this;
            // Wrap refreshImmediately
            var zr = chart.getZr();
            var oldRefreshImmediately = zr.__oldRefreshImmediately || zr.refreshImmediately;
            zr.refreshImmediately = function () {
                oldRefreshImmediately.call(this);
                self._texture.dirty();

                self.onupdate && self.onupdate();
            };
            zr.__oldRefreshImmediately = oldRefreshImmediately;
        }

        this._texture.image = canvas;
        this._texture.dirty();
        this.onupdate && this.onupdate();
    },

    /**
     * @method
     * @param {clay.Mesh} attachedMesh
     * @param {Array.<number>} triangle Triangle indices
     * @param {clay.math.Vector3} point
     */
    dispatchEvent: (function () {

        var p0 = new Vector3();
        var p1 = new Vector3();
        var p2 = new Vector3();
        var uv0 = new Vector2();
        var uv1 = new Vector2();
        var uv2 = new Vector2();
        var uv = new Vector2();

        var vCross = new Vector3();

        return function (eventName, attachedMesh, triangle, point) {
            var geo = attachedMesh.geometry;
            var position = geo.attributes.position;
            var texcoord = geo.attributes.texcoord0;
            var dot = Vector3.dot;
            var cross = Vector3.cross;

            position.get(triangle[0], p0.array);
            position.get(triangle[1], p1.array);
            position.get(triangle[2], p2.array);
            texcoord.get(triangle[0], uv0.array);
            texcoord.get(triangle[1], uv1.array);
            texcoord.get(triangle[2], uv2.array);

            cross(vCross, p1, p2);
            var det = dot(p0, vCross);
            var t = dot(point, vCross) / det;
            cross(vCross, p2, p0);
            var u = dot(point, vCross) / det;
            cross(vCross, p0, p1);
            var v = dot(point, vCross) / det;

            Vector2.scale(uv, uv0, t);
            Vector2.scaleAndAdd(uv, uv, uv1, u);
            Vector2.scaleAndAdd(uv, uv, uv2, v);

            var x = uv.x * this._chart.getWidth();
            var y = uv.y * this._chart.getHeight();
            this._chart.getZr().handler.dispatch(eventName, {
                zrX: x,
                zrY: y
            });
        };
    })(),

    attachToMesh: function (mesh) {
        if (this._meshes.indexOf(mesh) >= 0) {
            return;
        }

        events.forEach(function (eventName) {
            mesh.on(eventName, this[makeHandlerName(eventName)], this);
        }, this);

        this._meshes.push(mesh);
    },

    detachFromMesh: function (mesh) {
        var idx = this._meshes.indexOf(mesh);
        if (idx >= 0) {
            this._meshes.splice(idx, 1);
        }

        events.forEach(function (eventName) {
            mesh.off(eventName, this[makeHandlerName(eventName)]);
        }, this);
    },

    dispose: function () {
        this._meshes.forEach(function (mesh) {
            this.detachFromMesh(mesh);
        }, this);
    }
};

export default EChartsSurface;