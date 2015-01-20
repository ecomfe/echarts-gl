/**
 * ECharts-X
 * Extension pack of ECharts providing 3d plots and globe visualization  
 * 
 * Copyright (c) 2014, ECharts-X
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
 * @module echarts-x
 * @author Yi Shen(http://github.com/pissang)
 */

define(function (require) {

    var ecConfig = require('echarts/config');
    var ecxConfig = require('./config');
    var zrUtil = require('zrender/tool/util');

    // Extend echarts config
    zrUtil.merge(ecConfig, ecxConfig, true);

    // Import basic shaders
    var Shader = require('qtek/Shader');
    Shader['import'](require('text!./util/shader/albedo.essl'));
    Shader['import'](require('text!./util/shader/points.essl'));
    Shader['import'](require('text!./util/shader/curveAnimatingPoints.essl'));
    Shader['import'](require('text!./util/shader/vectorFieldParticle.essl'));
    Shader['import'](require('text!./util/shader/motionBlur.essl'));
});