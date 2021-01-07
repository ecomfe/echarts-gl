import * as echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import retrieve from '../../util/retrieve';
import ViewGL from '../../core/ViewGL';

import VectorFieldParticleSurface from './VectorFieldParticleSurface';


// TODO 百度地图不是 linear 的
export default echarts.ChartView.extend({

    type: 'flowGL',

    __ecgl__: true,

    init: function (ecModel, api) {
        this.viewGL = new ViewGL('orthographic');
        this.groupGL = new graphicGL.Node();
        this.viewGL.add(this.groupGL);

        this._particleSurface = new VectorFieldParticleSurface();

        var planeMesh = new graphicGL.Mesh({
            geometry: new graphicGL.PlaneGeometry(),
            material: new graphicGL.Material({
                shader: new graphicGL.Shader({
                    vertex: graphicGL.Shader.source('ecgl.color.vertex'),
                    fragment: graphicGL.Shader.source('ecgl.color.fragment')
                }),
                // Must enable blending and multiply alpha.
                // Or premultipliedAlpha will let the alpha useless.
                transparent: true
            })
        });
        planeMesh.material.enableTexture('diffuseMap');

        this.groupGL.add(planeMesh);

        this._planeMesh = planeMesh;

    },

    render: function (seriesModel, ecModel, api) {
        var particleSurface = this._particleSurface;
        // Set particleType before set others.
        particleSurface.setParticleType(seriesModel.get('particleType'));
        particleSurface.setSupersampling(seriesModel.get('supersampling'));

        this._updateData(seriesModel, api);
        this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());

        var particleDensity = retrieve.firstNotNull(seriesModel.get('particleDensity'), 128);
        particleSurface.setParticleDensity(particleDensity, particleDensity);

        var planeMesh = this._planeMesh;

        var time = +(new Date());
        var self = this;
        var firstFrame = true;
        planeMesh.__percent = 0;
        planeMesh.stopAnimation();
        planeMesh.animate('', { loop: true })
            .when(100000, {
                __percent: 1
            })
            .during(function () {
                var timeNow = + (new Date());
                var dTime = Math.min(timeNow - time, 20);
                time = time + dTime;
                if (self._renderer) {
                    particleSurface.update(self._renderer, api, dTime / 1000, firstFrame);
                    planeMesh.material.set('diffuseMap', particleSurface.getSurfaceTexture());
                    // planeMesh.material.set('diffuseMap', self._particleSurface.vectorFieldTexture);
                }
                firstFrame = false;
            })
            .start();

        var itemStyleModel = seriesModel.getModel('itemStyle');
        var color = graphicGL.parseColor(itemStyleModel.get('color'));
        color[3] *= retrieve.firstNotNull(itemStyleModel.get('opacity'), 1);
        planeMesh.material.set('color', color);

        particleSurface.setColorTextureImage(seriesModel.get('colorTexture'), api);
        particleSurface.setParticleSize(seriesModel.get('particleSize'));
        particleSurface.particleSpeedScaling = seriesModel.get('particleSpeed');
        particleSurface.motionBlurFactor = 1.0 - Math.pow(0.1, seriesModel.get('particleTrail'));
    },

    updateTransform: function (seriesModel, ecModel, api) {
        this._updateData(seriesModel, api);
    },

    afterRender: function (globeModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._renderer = renderer;
    },

    _updateData: function (seriesModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        var dims = coordSys.dimensions.map(function (coordDim) {
            return seriesModel.coordDimToDataDim(coordDim)[0];
        });

        var data = seriesModel.getData();
        var xExtent = data.getDataExtent(dims[0]);
        var yExtent = data.getDataExtent(dims[1]);

        var gridWidth = seriesModel.get('gridWidth');
        var gridHeight = seriesModel.get('gridHeight');

        if (gridWidth == null || gridWidth === 'auto') {
            // TODO not accurate.
            var aspect = (xExtent[1] - xExtent[0]) / (yExtent[1] - yExtent[0]);
            gridWidth = Math.round(Math.sqrt(aspect * data.count()));
        }
        if (gridHeight == null || gridHeight === 'auto') {
            gridHeight = Math.ceil(data.count() / gridWidth);
        }

        var vectorFieldTexture = this._particleSurface.vectorFieldTexture;

        // Half Float needs Uint16Array
        var pixels = vectorFieldTexture.pixels;
        if (!pixels || pixels.length !== gridHeight * gridWidth * 4) {
            pixels = vectorFieldTexture.pixels = new Float32Array(gridWidth * gridHeight * 4);
        }
        else {
            for (var i = 0; i < pixels.length; i++) {
                pixels[i] = 0;
            }
        }

        var maxMag = 0;
        var minMag = Infinity;

        var points = new Float32Array(data.count() * 2);
        var offset = 0;
        var bbox = [[Infinity, Infinity], [-Infinity, -Infinity]];

        data.each([dims[0], dims[1], 'vx', 'vy'], function (x, y, vx, vy) {
            var pt = coordSys.dataToPoint([x, y]);
            points[offset++] = pt[0];
            points[offset++] = pt[1];
            bbox[0][0] = Math.min(pt[0], bbox[0][0]);
            bbox[0][1] = Math.min(pt[1], bbox[0][1]);
            bbox[1][0] = Math.max(pt[0], bbox[1][0]);
            bbox[1][1] = Math.max(pt[1], bbox[1][1]);

            var mag = Math.sqrt(vx * vx + vy * vy);
            maxMag = Math.max(maxMag, mag);
            minMag = Math.min(minMag, mag);
        });

        data.each(['vx', 'vy'], function (vx, vy, i) {
            var xPix = Math.round((points[i * 2] - bbox[0][0]) / (bbox[1][0] - bbox[0][0]) * (gridWidth - 1));
            var yPix = gridHeight - 1 - Math.round((points[i * 2 + 1] - bbox[0][1]) / (bbox[1][1] - bbox[0][1]) * (gridHeight - 1));

            var idx = (yPix * gridWidth + xPix) * 4;

            pixels[idx] = (vx / maxMag * 0.5 + 0.5);
            pixels[idx + 1] = (vy / maxMag * 0.5 + 0.5);
            pixels[idx + 3] = 1;
        });

        vectorFieldTexture.width = gridWidth;
        vectorFieldTexture.height = gridHeight;

        if (seriesModel.get('coordinateSystem') === 'bmap') {
            this._fillEmptyPixels(vectorFieldTexture);
        }

        vectorFieldTexture.dirty();

        this._updatePlanePosition(bbox[0], bbox[1], seriesModel,api);
        this._updateGradientTexture(data.getVisual('visualMeta'), [minMag, maxMag]);

    },
    // PENDING Use grid mesh ? or delaunay triangulation?
    _fillEmptyPixels: function (texture) {
        var pixels = texture.pixels;
        var width = texture.width;
        var height = texture.height;

        function fetchPixel(x, y, rg) {
            x = Math.max(Math.min(x, width - 1), 0);
            y = Math.max(Math.min(y, height - 1), 0);
            var idx = (y * (width - 1) + x) * 4;
            if (pixels[idx + 3] === 0) {
                return false;
            }
            rg[0] = pixels[idx];
            rg[1] = pixels[idx + 1];
            return true;
        }

        function addPixel(a, b, out) {
            out[0] = a[0] + b[0];
            out[1] = a[1] + b[1];
        }

        var center = [], left = [], right = [], top = [], bottom = [];
        var weight = 0;
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var idx = (y * (width - 1) + x) * 4;
                if (pixels[idx + 3] === 0) {
                    weight = center[0] = center[1] = 0;
                    if (fetchPixel(x - 1, y, left)) {
                        weight++; addPixel(left, center, center);
                    }
                    if (fetchPixel(x + 1, y, right)) {
                        weight++; addPixel(right, center, center);
                    }
                    if (fetchPixel(x, y - 1, top)) {
                        weight++; addPixel(top, center, center);
                    }
                    if (fetchPixel(x, y + 1, bottom)) {
                        weight++; addPixel(bottom, center, center);
                    }
                    center[0] /= weight;
                    center[1] /= weight;
                    // PENDING If overwrite. bilinear interpolation.
                    pixels[idx] = center[0];
                    pixels[idx + 1] = center[1];
                }
                pixels[idx + 3] = 1;
            }
        }
    },

    _updateGradientTexture: function (visualMeta, magExtent) {
        if (!visualMeta || !visualMeta.length) {
            this._particleSurface.setGradientTexture(null);
            return;
        }
        // TODO Different dimensions
        this._gradientTexture = this._gradientTexture || new graphicGL.Texture2D({
            image: document.createElement('canvas')
        });
        var gradientTexture = this._gradientTexture;
        var canvas = gradientTexture.image;
        canvas.width = 200;
        canvas.height = 1;
        var ctx = canvas.getContext('2d');
        var gradient = ctx.createLinearGradient(0, 0.5, canvas.width, 0.5);
        visualMeta[0].stops.forEach(function (stop) {
            var offset;
            if (magExtent[1] === magExtent[0]) {
                offset = 0;
            }
            else {
                offset = stop.value / magExtent[1];
                offset = Math.min(Math.max(offset, 0), 1);
            }

            gradient.addColorStop(offset, stop.color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        gradientTexture.dirty();

        this._particleSurface.setGradientTexture(this._gradientTexture);
    },

    _updatePlanePosition: function (leftTop, rightBottom, seriesModel, api) {
        var limitedResult = this._limitInViewportAndFullFill(leftTop, rightBottom, seriesModel, api);
        leftTop = limitedResult.leftTop;
        rightBottom = limitedResult.rightBottom;
        this._particleSurface.setRegion(limitedResult.region);

        this._planeMesh.position.set(
            (leftTop[0] + rightBottom[0]) / 2,
            api.getHeight() - (leftTop[1] + rightBottom[1]) / 2,
            0
        );

        var width = rightBottom[0] - leftTop[0];
        var height = rightBottom[1] - leftTop[1];
        this._planeMesh.scale.set(width / 2, height / 2, 1);

        this._particleSurface.resize(
            Math.max(Math.min(width, 2048), 1),
            Math.max(Math.min(height, 2048), 1)
        );

        if (this._renderer) {
            this._particleSurface.clearFrame(this._renderer);
        }
    },

    _limitInViewportAndFullFill: function (leftTop, rightBottom, seriesModel, api) {
        var newLeftTop = [
            Math.max(leftTop[0], 0),
            Math.max(leftTop[1], 0)
        ];
        var newRightBottom = [
            Math.min(rightBottom[0], api.getWidth()),
            Math.min(rightBottom[1], api.getHeight())
        ];
        // Tiliing in lng orientation.
        if (seriesModel.get('coordinateSystem') === 'bmap') {
            var lngRange = seriesModel.getData().getDataExtent(seriesModel.coordDimToDataDim('lng')[0]);
            // PENDING, consider grid density
            var isContinuous = Math.floor(lngRange[1] - lngRange[0]) >= 359;
            if (isContinuous) {
                if (newLeftTop[0] > 0) {
                    newLeftTop[0] = 0;
                }
                if (newRightBottom[0] < api.getWidth()) {
                    newRightBottom[0] = api.getWidth();
                }
            }
        }

        var width = rightBottom[0] - leftTop[0];
        var height = rightBottom[1] - leftTop[1];
        var newWidth = newRightBottom[0] - newLeftTop[0];
        var newHeight = newRightBottom[1] - newLeftTop[1];

        var region = [
            (newLeftTop[0] - leftTop[0]) / width,
            1.0 - newHeight / height - (newLeftTop[1] - leftTop[1]) / height,
            newWidth / width,
            newHeight / height
        ];

        return {
            leftTop: newLeftTop,
            rightBottom: newRightBottom,
            region: region
        };
    },

    _updateCamera: function (width, height, dpr) {
        this.viewGL.setViewport(0, 0, width, height, dpr);
        var camera = this.viewGL.camera;
        // FIXME  bottom can't be larger than top
        camera.left = camera.bottom = 0;
        camera.top = height;
        camera.right = width;
        camera.near = 0;
        camera.far = 100;
        camera.position.z = 10;
    },

    remove: function () {
        this._planeMesh.stopAnimation();
        this.groupGL.removeAll();
    },

    dispose: function () {
        if (this._renderer) {
            this._particleSurface.dispose(this._renderer);
        }
        this.groupGL.removeAll();
    }
});
