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

varying vec4 v_Color;
varying float v_Percent;

@import ecgl.common.wireframe.vertexHeader

@import ecgl.lines3D.clipNear

void main()
{
    @import ecgl.lines3D.expandLine

    gl_Position = currProj;

    v_Color = a_Color;

    @import ecgl.common.wireframe.vertexMain

#ifdef CONSTANT_SPEED
    v_Percent = mod(speed * time + start - dist, distAll * (1.0 + trailLength)) / distAll;
#else
    v_Percent = mod(time + start - dist / distAll * period, period * (1.0 + trailLength)) / period;
#endif
}
@end


@export ecgl.trail2.fragment

uniform vec4 color : [1.0, 1.0, 1.0, 1.0];

varying vec4 v_Color;
varying float v_Percent;

@import ecgl.common.wireframe.fragmentHeader

@import qtek.util.srgb

void main()
{
if (v_Percent > 1.0 || v_Percent < 0.0) {
    discard;
}

#ifdef SRGB_DECODE
    gl_FragColor = sRGBToLinear(color * v_Color);
#else
    gl_FragColor = color * v_Color;
#endif

    @import ecgl.common.wireframe.fragmentMain

    gl_FragColor.a *= v_Percent;
}

@end