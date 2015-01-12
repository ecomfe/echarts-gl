define(function (require) {

    var ecConfig = require('echarts/config');
    var ecxConfig = require('./config');
    var zrUtil = require('zrender/tool/util');

    // Extend echarts config
    zrUtil.merge(ecConfig, ecxConfig, true);

    // Import basic shaders
    var Shader = require('qtek/Shader');
    Shader.import(require('text!./util/shader/albedo.essl'));
    Shader['import'](require('text!./util/shader/points.essl'));
    Shader['import'](require('text!./util/shader/curveAnimatingPoints.essl'));
});