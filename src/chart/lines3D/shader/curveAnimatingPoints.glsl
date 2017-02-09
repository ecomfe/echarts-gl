@export ecgl.curveAnimatingPoints.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform float percent : 0.0;

attribute vec3 p0;
attribute vec3 p1;
attribute vec3 p2;
attribute vec3 p3;
attribute vec4 color : COLOR;

attribute float offset;
attribute float size;

varying vec4 v_Color;

void main()
{
    float t = mod(offset + percent, 1.0);
    float onet = 1.0 - t;
    vec3 position = onet * onet * (onet * p0 + 3.0 * t * p1)
        + t * t * (t * p3 + 3.0 * onet * p2);

    gl_Position = worldViewProjection * vec4(position, 1.0);

    gl_PointSize = size;

    v_Color = color;
}

@end

@export ecgl.curveAnimatingPoints.fragment

varying vec4 v_Color;

uniform sampler2D sprite;

void main()
{
    gl_FragColor = v_Color;

#ifdef SPRITE_ENABLED
    gl_FragColor *= texture2D(sprite, gl_PointCoord);
#endif

}
@end