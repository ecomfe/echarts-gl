var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var retrieve = require('../../util/retrieve');
var ViewGL = require('../../core/ViewGL');

var VectorFieldParticleSurface = require('./VectorFieldParticleSurface');

echarts.extendChartView({

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
        planeMesh.material.shader.enableTexture('diffuseMap');

        this.groupGL.add(planeMesh);

        this._planeMesh = planeMesh;
        
    },
    
    render: function (seriesModel, ecModel, api) {
        var particleSurface = this._particleSurface;
        
        this._updateData(seriesModel, api);
        this._updateCamera(api.getWidth(), api.getHeight(), api.getDevicePixelRatio());

        var particleDensity = retrieve.firstNotNull(seriesModel.get('particleDensity'), 128);
        particleSurface.setParticleDensity(particleDensity, particleDensity);
        
        var planeMesh = this._planeMesh;
        
        var time = +(new Date());
        var self = this;
        planeMesh.__percent = 0;
        planeMesh.stopAnimation();
        planeMesh.animate('', { loop: true })
            .when(100000, {
                __percent: 1
            })
            .during(function () {
                var timeNow = + (new Date());
                var dTime = timeNow - time;
                time = timeNow;
                if (self._renderer) {
                    particleSurface.update(self._renderer, dTime / 1000);
                    planeMesh.material.set('diffuseMap', particleSurface.getSurfaceTexture());
                    // planeMesh.material.set('diffuseMap', self._particleSurface.vectorFieldTexture);
                }
            })
            .start();

        var itemStyleModel = seriesModel.getModel('itemStyle');
        var color = graphicGL.parseColor(itemStyleModel.get('color'));
        color[3] *= retrieve.firstNotNull(itemStyleModel.get('opacity'), 1);
        planeMesh.material.set('color', color);
    },

    updateLayout: function (seriesModel, ecModel, api) {
        this._updatePlanePosition(seriesModel, api);
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

        // Half Float needs Uint16Array
        var pixels = new Float32Array(gridWidth * gridHeight * 4);

        var maxMag = 0;
        var minMag = Infinity;
        data.each(['vx', 'vy'], function (vx, vy) {
            var mag = Math.sqrt(vx * vx + vy * vy);
            maxMag = Math.max(maxMag, mag);
            minMag = Math.min(minMag, mag);
        });

        data.each([dims[0], dims[1], 'vx', 'vy'], function (x, y, vx, vy) {
            var xPix = Math.round((x - xExtent[0]) / (xExtent[1] - xExtent[0]) * (gridWidth - 1));
            var yPix = Math.round((y - yExtent[0]) / (yExtent[1] - yExtent[0]) * (gridHeight - 1));

            var idx = yPix * gridWidth + xPix;
            vx /= maxMag;
            vy /= maxMag;
            pixels[idx * 4] = (vx * 0.5 + 0.5);
            pixels[idx * 4 + 1] = (vy * 0.5 + 0.5);
            pixels[idx * 4 + 3] = 1;
        });

        var vectorFieldTexture = this._particleSurface.vectorFieldTexture;

        vectorFieldTexture.pixels = pixels;
        vectorFieldTexture.width = gridWidth;
        vectorFieldTexture.height = gridHeight;
        vectorFieldTexture.dirty();

        this._updatePlanePosition(seriesModel, api);
        this._updateGradientTexture(data.getVisual('visualMeta'), [minMag, maxMag]);
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
                offset = (stop.value - magExtent[0]) / (magExtent[1] - magExtent[0]);
                offset = Math.min(Math.max(offset, 0), 1);
            }

            gradient.addColorStop(offset, stop.color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 1);
        gradientTexture.dirty();

        this._particleSurface.setGradientTexture(this._gradientTexture);
    },

    _updatePlanePosition: function (seriesModel, api) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;
        var dims = coordSys.dimensions.map(function (coordDim) {
            return seriesModel.coordDimToDataDim(coordDim)[0];
        });
        var xExtent = data.getDataExtent(dims[0]);
        var yExtent = data.getDataExtent(dims[1]);

        var corners = [
            coordSys.dataToPoint([xExtent[0], yExtent[0]]),
            coordSys.dataToPoint([xExtent[1], yExtent[0]]),
            coordSys.dataToPoint([xExtent[0], yExtent[1]]),
            coordSys.dataToPoint([xExtent[1], yExtent[1]])
        ];

        var leftTop = [
            Math.min.apply(null, corners.map(function (a) { return a[0]; } )),
            Math.min.apply(null, corners.map(function (a) { return a[1]; } ))
        ];
        var rightBottom = [
            Math.max.apply(null, corners.map(function (a) { return a[0]; } )),
            Math.max.apply(null, corners.map(function (a) { return a[1]; } ))
        ];

        var limitedResult = this._limitInViewport(leftTop, rightBottom, api);
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
            Math.min(width, 2048),
            Math.min(height, 2048)
        );
    },

    _limitInViewport: function (leftTop, rightBottom, api) {
        var newLeftTop = [
            Math.max(leftTop[0], 0),
            Math.max(leftTop[1], 0)
        ];
        var newRightBottom = [
            Math.min(rightBottom[0], api.getWidth()),
            Math.min(rightBottom[1], api.getHeight())
        ];

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
