import Globe from './globe/Globe';
import * as echarts from 'echarts/lib/echarts';
import {getLayoutRect} from 'echarts/lib/util/layout';
import ViewGL from '../core/ViewGL';
import retrieve from '../util/retrieve';
import graphicGL from '../util/graphicGL';

function getDisplacementData(img, displacementScale) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var width = img.width;
    var height = img.height;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    var rgbaArr = ctx.getImageData(0, 0, width, height).data;

    var displacementArr = new Float32Array(rgbaArr.length / 4);
    for (var i = 0; i < rgbaArr.length / 4; i++) {
        var x = rgbaArr[i * 4];
        displacementArr[i] = x / 255 * displacementScale;
    }
    return {
        data: displacementArr,
        width: width,
        height: height
    };
}

function resizeGlobe(globeModel, api) {
    // Use left/top/width/height
    var boxLayoutOption = globeModel.getBoxLayoutParams();

    var viewport = getLayoutRect(boxLayoutOption, {
        width: api.getWidth(),
        height: api.getHeight()
    });

    // Flip Y
    viewport.y = api.getHeight() - viewport.y - viewport.height;

    this.viewGL.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, api.getDevicePixelRatio());

    this.radius = globeModel.get('globeRadius');

    var outerRadius = globeModel.get('globeOuterRadius');
    if (this.altitudeAxis) {
        this.altitudeAxis.setExtent(0, outerRadius - this.radius);
    }
}

function updateGlobe(ecModel, api) {

    var altitudeDataExtent = [Infinity, -Infinity];

    ecModel.eachSeries(function (seriesModel) {
        if (seriesModel.coordinateSystem !== this) {
            return;
        }

        // Get altitude data extent.
        var data = seriesModel.getData();
        var altDims = seriesModel.coordDimToDataDim('alt');
        var altDim = altDims && altDims[0];
        if (altDim) {
            // TODO altitiude is in coords of lines.
            var dataExtent = data.getDataExtent(altDim, true);
            altitudeDataExtent[0] = Math.min(
                altitudeDataExtent[0], dataExtent[0]
            );
            altitudeDataExtent[1] = Math.max(
                altitudeDataExtent[1], dataExtent[1]
            );
        }
    }, this);
    // Create altitude axis
    if (altitudeDataExtent && isFinite(altitudeDataExtent[1] - altitudeDataExtent[0])) {
        var scale = echarts.helper.createScale(
            altitudeDataExtent, {
                type: 'value',
                // PENDING
                min: 'dataMin',
                max: 'dataMax'
            }
        );
        this.altitudeAxis = new echarts.Axis('altitude', scale);
        // Resize again
        this.resize(this.model, api);
    }
}

var globeCreator = {

    dimensions: Globe.prototype.dimensions,

    create: function (ecModel, api) {

        var globeList = [];

        ecModel.eachComponent('globe', function (globeModel) {

            // FIXME
            globeModel.__viewGL = globeModel.__viewGL || new ViewGL();

            var globe = new Globe();
            globe.viewGL = globeModel.__viewGL;

            globeModel.coordinateSystem = globe;
            globe.model = globeModel;
            globeList.push(globe);

            // Inject resize
            globe.resize = resizeGlobe;
            globe.resize(globeModel, api);

            globe.update = updateGlobe;
        });

        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'globe') {
                var globeModel = seriesModel.getReferringComponents('globe').models[0];
                if (!globeModel) {
                    globeModel = ecModel.getComponent('globe');
                }

                if (!globeModel) {
                    throw new Error('globe "' + retrieve.firstNotNull(
                        seriesModel.get('globe3DIndex'),
                        seriesModel.get('globe3DId'),
                        0
                    ) + '" not found');
                }

                var coordSys = globeModel.coordinateSystem;

                seriesModel.coordinateSystem = coordSys;
            }
        });

        ecModel.eachComponent('globe', function (globeModel, idx) {
            var globe = globeModel.coordinateSystem;

            // Update displacement data
            var displacementTextureValue = globeModel.getDisplacementTexture();
            var displacementScale = globeModel.getDisplacemenScale();

            if (globeModel.isDisplacementChanged()) {
                if (globeModel.hasDisplacement()) {
                    var immediateLoaded = true;
                    graphicGL.loadTexture(displacementTextureValue, api, function (texture) {
                        var img = texture.image;
                        var displacementData = getDisplacementData(img, displacementScale);
                        globeModel.setDisplacementData(displacementData.data, displacementData.width, displacementData.height);
                        if (!immediateLoaded) {
                            // Update layouts
                            api.dispatchAction({
                                type: 'globeUpdateDisplacment'
                            });
                        }
                    });
                    immediateLoaded = false;
                }
                else {
                    globe.setDisplacementData(null, 0, 0);
                }

                globe.setDisplacementData(
                    globeModel.displacementData, globeModel.displacementWidth, globeModel.displacementHeight
                );
            }
        });

        return globeList;
    }
};

export default globeCreator;