// Inspired by https://github.com/uber/deck.gl/tree/master/examples/trips/trips-layer
@export ecgl.trail2.vertex
attribute vec3 position: POSITION;
attribute vec3 positionPrev;
attribute vec3 positionNext;
attribute float offset;
// Distance to first point.
attribute float dist;
attribute float distAll;
// Start distance/time
attribute float start;

attribute vec4 a_Color : COLOR;

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform vec4 viewport : VIEWPORT;
uniform float near : NEAR;

uniform float speed : 0;
uniform float trailLength: 0.3;
uniform float time;
uniform float period: 1000;

uniform float spotSize: 1;

varying vec4 v_Color;
varying float v_Percent;
varying float v_SpotPercent;

@import ecgl.common.wireframe.vertexHeader

@import ecgl.lines3D.clipNear

void main()
{
    @import ecgl.lines3D.expandLine

    gl_Position = currProj;

    v_Color = a_Color;

    @import ecgl.common.wireframe.vertexMain

#ifdef CONSTANT_SPEED
    float t = mod((speed * time + start) / distAll, 1. + trailLength) - trailLength;
#else
    float t = mod((time + start) / period, 1. + trailLength) - trailLength;
#endif

    float trailLen = distAll * trailLength;

    v_Percent = (dist - t * distAll) / trailLen;

    v_SpotPercent = spotSize / distAll;

    // if (t > 1.0 - trailLength) {
    //     float t2 = t - 1.0;
    //     v_Percent = max(v_Percent, (dist - t2 * distAll) / trailLen);
    // }
}
@end


@export ecgl.trail2.fragment

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];
uniform float spotIntensity: 5;

varying vec4 v_Color;
varying float v_Percent;
varying float v_SpotPercent;

@import ecgl.common.wireframe.fragmentHeader

@import clay.util.srgb

void main()
{
    if (v_Percent > 1.0 || v_Percent < 0.0) {
        discard;
    }

    float fade = v_Percent;

#ifdef SRGB_DECODE
    gl_FragColor = sRGBToLinear(color * v_Color);
#else
    gl_FragColor = color * v_Color;
#endif

    @import ecgl.common.wireframe.fragmentMain

    // Spot part
    // PENDING
    if (v_Percent > (1.0 - v_SpotPercent)) {
        gl_FragColor.rgb *= spotIntensity;
        // gl_FragColor.rgb *= (10.0 * (v_Percent - 1.0 + v_SpotPercent) / v_SpotPercent + 1.0);
    }

    gl_FragColor.a *= fade;
}

@end