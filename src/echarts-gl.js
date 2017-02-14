/**
 * echarts-gl
 * Extension pack of ECharts providing 3d plots and globe visualization
 *
 * Copyright (c) 2014, echarts-gl
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @module echarts-gl
 * @author Yi Shen(http://github.com/pissang)
 */

// PENDING Use a single canvas as layer or use image element?
var echartsGl = {
    version: '1.0.0',
    dependencies: {
        echarts: '3.4.0',
        qtek: '0.3.0'
    }
};
var echarts = require('echarts/lib/echarts');
var qtekVersion = require('qtek/lib/version');
var LayerGL = require('./core/LayerGL');

// Version checking
var deps = echartsGl.dependencies;
function versionTooOldMsg(name) {
    throw new Error(
        name + ' version is too old, needs ' + deps[name] + ' or higher'
    );
}
function checkVersion(version, name) {
    if ((version.replace('.', '') - 0) < (deps[name].replace('.', '') - 0)) {
        versionTooOldMsg(name);
    }
    console.log('Loaded ' + name + ', version ' + version);
}
checkVersion(qtekVersion, 'qtek');
checkVersion(echarts.version, 'echarts');

function EChartsGL (zr) {
    this._layers = {};

    this._zr = zr;
}

EChartsGL.prototype.update = function (ecModel, api) {
    var self = this;
    var zr = api.getZr();

    function getLayerGL(model) {
        var zlevel = model.get('zlevel');
        var layers = self._layers;
        var layerGL = layers[zlevel];
        if (!layerGL) {
            layerGL = layers[zlevel] = new LayerGL('gl-' + zlevel, zr);

            if (zr.painter.isSingleCanvas()) {
                layerGL.virtual = true;
                // If container is canvas, use image to represent LayerGL
                // FIXME Performance
                var img = new echarts.graphic.Image({
                    z: 1e4,
                    style: {
                        image: layerGL.renderer.canvas,
                        width: layerGL.renderer.getWidth(),
                        height: layerGL.renderer.getHeight()
                    },
                    silent: true
                });

                zr.add(img);
            }

            zr.painter.insertLayer(zlevel, layerGL);
        }

        return layerGL;
    }

    for (var zlevel in this._layers) {
        this._layers[zlevel].removeViewsAll();
    }

    ecModel.eachComponent(function (componentType, componentModel) {
        if (componentType !== 'series') {
            var view = api.getViewOfComponentModel(componentModel);
            var groupGL = view.groupGL;
            var coordSys = componentModel.coordinateSystem;
            if (groupGL) {
                var viewGL;
                if (coordSys) {
                    if (!coordSys.viewGL) {
                        console.error('Can\'t find viewGL in coordinateSystem of component ' + componentModel.id);
                        return;
                    }
                    viewGL = coordSys.viewGL;
                }
                else {
                    if (!componentModel.viewGL) {
                        console.error('Can\'t find viewGL of component ' + componentModel.id);
                        return;
                    }
                    viewGL = coordSys.viewGL;
                }

                var viewGL = coordSys.viewGL;
                var layerGL = getLayerGL(componentModel);

                layerGL.addView(viewGL);
            }
        }
    });

    ecModel.eachSeries(function (seriesModel) {
        var chartView = api.getViewOfSeriesModel(seriesModel);
        var groupGL = chartView.groupGL;
        var coordSys = seriesModel.coordinateSystem;
        if (groupGL) {
            if ((coordSys && !coordSys.viewGL) && !chartView.viewGL) {
                console.error('Can\'t find viewGL of series ' + chartView.id);
                return;
            }
            var viewGL = (coordSys && coordSys.viewGL) || chartView.viewGL;
            // TODO Check zlevel not same with component of coordinate system ?
            var layerGL = getLayerGL(seriesModel);
            layerGL.addView(viewGL);
        }
    });
};


echarts.registerPostUpdate(function (ecModel, api) {
    var zr = api.getZr();

    var egl = zr.__egl = zr.__egl || new EChartsGL(zr);

    egl.update(ecModel, api);
});

var Shader = require('qtek/lib/Shader');
// Some common shaders
Shader['import'](require('qtek/lib/shader/source/util.essl'));

module.exports = EChartsGL;