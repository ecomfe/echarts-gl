define(function (require) {

    var MarkerBase = function (chart) {
        this.chart = chart;
    };

    MarkerBase.prototype.setSerie = function (serie) {};

    MarkerBase.prototype.clear = function () {};

    MarkerBase.prototype.onframe = function (deltaTime) {};

    MarkerBase.prototype.getSceneNode = function () {};

    MarkerBase.prototype.dispose = function () {
        var renderer = this.chart.baseLayer.renderer;
        renderer.dispose(this.getSceneNode(), true, true);
    }

    return MarkerBase;
});